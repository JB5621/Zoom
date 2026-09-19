// ============================================================
// qrDecode.js — the read side of qr.js: a sampled module grid back to
// the text it encodes, error correction included.
//
// Written out for the same reason as the encoder: "join with QR code"
// points a camera at a meeting link, and that link should not have to
// travel through a third-party script to be read.
//
// Scope mirrors the encoder — versions 1 to 10 — but covers all four
// error-correction levels, so a QR produced elsewhere still reads as
// long as it is small enough.
// ============================================================

import { MASKS, reservedModules } from "./qr";
import { gfMul, gfDiv, gfPow, polyEval } from "./gf256";

// Per version, per EC level: [ecCodewordsPerBlock, [[blocks, dataCw], ...]].
// Written out flat rather than nested-and-clever: a wrong entry here is a
// decode failure that looks like a camera problem, so it should be easy
// to check against the spec's table line by line. The M column matches the
// encoder's own table in qr.js.
const EC_BLOCKS = {
  L: {
    1:  [7,  [[1, 19]]],
    2:  [10, [[1, 34]]],
    3:  [15, [[1, 55]]],
    4:  [20, [[1, 80]]],
    5:  [26, [[1, 108]]],
    6:  [18, [[2, 68]]],
    7:  [20, [[2, 78]]],
    8:  [24, [[2, 97]]],
    9:  [30, [[2, 116]]],
    10: [18, [[2, 68], [2, 69]]],
  },
  M: {
    1:  [10, [[1, 16]]],
    2:  [16, [[1, 28]]],
    3:  [26, [[1, 44]]],
    4:  [18, [[2, 32]]],
    5:  [24, [[2, 43]]],
    6:  [16, [[4, 27]]],
    7:  [18, [[4, 31]]],
    8:  [22, [[2, 38], [2, 39]]],
    9:  [22, [[3, 36], [2, 37]]],
    10: [26, [[4, 43], [1, 44]]],
  },
  Q: {
    1:  [13, [[1, 13]]],
    2:  [22, [[1, 22]]],
    3:  [18, [[2, 17]]],
    4:  [26, [[2, 24]]],
    5:  [18, [[2, 15], [2, 16]]],
    6:  [24, [[4, 19]]],
    7:  [18, [[2, 14], [4, 15]]],
    8:  [22, [[4, 18], [2, 19]]],
    9:  [20, [[4, 16], [4, 17]]],
    10: [24, [[6, 19], [2, 20]]],
  },
  H: {
    1:  [17, [[1, 9]]],
    2:  [28, [[1, 16]]],
    3:  [22, [[2, 13]]],
    4:  [16, [[4, 9]]],
    5:  [22, [[2, 11], [2, 12]]],
    6:  [28, [[4, 15]]],
    7:  [26, [[4, 13], [1, 14]]],
    8:  [26, [[4, 14], [2, 15]]],
    9:  [24, [[4, 12], [4, 13]]],
    10: [28, [[6, 15], [2, 16]]],
  },
};

// Format-info bits 4-3 → level. Note L and M are not in alphabetical order.
const EC_LEVELS = { 0b01: "L", 0b00: "M", 0b11: "Q", 0b10: "H" };

const MAX_VERSION = 10;

// ── Format information ──────────────────────────────────────

/** The 15-bit masked format codeword for a level/mask pair. */
function formatCodeword(ecBits, maskIndex) {
  const data = (ecBits << 3) | maskIndex;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
}

// All 32 legal codewords, so a read can be matched to the nearest one
// instead of trusting 15 bits that a blurry frame may have flipped.
const FORMAT_CODEWORDS = [];
for (const ecBits of [0b00, 0b01, 0b10, 0b11]) {
  for (let mask = 0; mask < 8; mask++) {
    FORMAT_CODEWORDS.push({ bits: formatCodeword(ecBits, mask), ecBits, mask });
  }
}

const popcount = (n) => {
  let c = 0;
  while (n) { n &= n - 1; c++; }
  return c;
};

/**
 * Both copies of the format information, as 15-bit integers with bit 0
 * being format bit 0 — the same numbering applyFormat() writes.
 */
function readFormatCopies(modules, size) {
  let a = 0;
  let b = 0;
  for (let i = 0; i < 15; i++) {
    // Copy 1, wrapping the top-left finder — the mirror of applyFormat().
    let bit;
    if (i < 6) bit = modules[i][8];
    else if (i === 6) bit = modules[7][8];
    else if (i === 7) bit = modules[8][8];
    else if (i === 8) bit = modules[8][7];
    else bit = modules[8][14 - i];
    a |= bit << i;

    // Copy 2, split between the other two finders.
    bit = i < 8 ? modules[8][size - 1 - i] : modules[size - 15 + i][8];
    b |= bit << i;
  }
  return [a, b];
}

/** @returns {{ level: string, mask: number }} */
function decodeFormat(modules, size) {
  let best = null;
  for (const read of readFormatCopies(modules, size)) {
    for (const cand of FORMAT_CODEWORDS) {
      const d = popcount(read ^ cand.bits);
      if (!best || d < best.d) best = { d, ...cand };
    }
  }
  // Beyond three flipped bits the BCH code can no longer tell which
  // codeword was meant, so a "closest match" would be a guess.
  if (!best || best.d > 3) throw new Error("Could not read the QR format information");
  return { level: EC_LEVELS[best.ecBits], mask: best.mask };
}

// ── Module grid → interleaved codewords ─────────────────────

/** Walk the zigzag in the same order the encoder wrote it. */
function readCodewords(modules, size, reserved, mask, count) {
  const bits = [];
  const total = count * 8;
  let upward = true;

  for (let right = size - 1; right >= 1 && bits.length < total; right -= 2) {
    if (right === 6) right = 5;            // the vertical timing column is skipped
    for (let i = 0; i < size && bits.length < total; i++) {
      const row = upward ? size - 1 - i : i;
      for (const col of [right, right - 1]) {
        if (reserved[row][col]) continue;
        if (bits.length >= total) break;
        const unmasked = MASKS[mask](row, col) ? modules[row][col] ^ 1 : modules[row][col];
        bits.push(unmasked);
      }
    }
    upward = !upward;
  }

  if (bits.length < total) throw new Error("QR grid is missing data modules");

  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
    out[i] = byte;
  }
  return out;
}

/** Undo the block interleave, returning {data, ec} arrays per block. */
function deinterleave(codewords, ecPer, groups) {
  const blocks = [];
  for (const [count, dataLen] of groups) {
    for (let i = 0; i < count; i++) blocks.push({ dataLen, data: [], ec: [] });
  }

  let pos = 0;
  const maxData = Math.max(...blocks.map((b) => b.dataLen));
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.dataLen) b.data.push(codewords[pos++]);
  }
  for (let i = 0; i < ecPer; i++) {
    for (const b of blocks) b.ec.push(codewords[pos++]);
  }
  return blocks;
}

// ── Reed-Solomon decoding ───────────────────────────────────

/** Syndromes of a received block, highest-degree coefficient first. */
function syndromes(received, ecLen) {
  const s = new Array(ecLen);
  for (let i = 0; i < ecLen; i++) s[i] = polyEval(received, gfPow(2, i));
  return s;
}

/**
 * Berlekamp-Massey: the error-locator polynomial for these syndromes,
 * as coefficients lowest-degree-first.
 */
function errorLocator(syn, ecLen) {
  let C = [1];
  let B = [1];
  let L = 0;
  let m = 1;
  let b = 1;

  for (let n = 0; n < ecLen; n++) {
    let d = syn[n];
    for (let i = 1; i <= L; i++) d ^= gfMul(C[i] || 0, syn[n - i]);

    if (d === 0) {
      m += 1;
      continue;
    }

    const scale = gfDiv(d, b);
    const T = C.slice();
    while (C.length < B.length + m) C.push(0);
    for (let i = 0; i < B.length; i++) C[i + m] ^= gfMul(scale, B[i]);

    if (2 * L <= n) {
      L = n + 1 - L;
      B = T;
      b = d;
      m = 1;
    } else {
      m += 1;
    }
  }
  return { sigma: C, count: L };
}

/** Chien search: the positions (as powers of alpha) that are in error. */
function errorPositions(sigma, blockLen) {
  const positions = [];
  for (let i = 0; i < blockLen; i++) {
    // sigma has roots at the inverses of the error locators.
    const x = gfPow(2, (255 - i) % 255);
    let y = 0;
    for (let j = sigma.length - 1; j >= 0; j--) y = gfMul(y, x) ^ sigma[j];
    if (y === 0) positions.push(i);
  }
  return positions;
}

/**
 * Error magnitudes, by solving the Vandermonde system
 * sum_k e_k * X_k^j = syn[j] directly.
 *
 * Forney's formula would avoid the elimination, but its sign and
 * generator-base conventions are easy to get subtly wrong; at these
 * block sizes (at most 14 errors) solving outright costs nothing and is
 * verifiable by inspection.
 */
function errorMagnitudes(positions, syn) {
  const n = positions.length;
  const X = positions.map((p) => gfPow(2, p));

  // Augmented matrix, n equations from the first n syndromes.
  const M = [];
  for (let j = 0; j < n; j++) {
    const row = X.map((x) => gfPow(x, j));
    row.push(syn[j]);
    M.push(row);
  }

  for (let col = 0; col < n; col++) {
    let pivot = -1;
    for (let r = col; r < n; r++) if (M[r][col] !== 0) { pivot = r; break; }
    if (pivot === -1) throw new Error("QR error correction failed");
    [M[col], M[pivot]] = [M[pivot], M[col]];

    const inv = gfDiv(1, M[col][col]);
    for (let c = col; c <= n; c++) M[col][c] = gfMul(M[col][c], inv);
    for (let r = 0; r < n; r++) {
      if (r === col || M[r][col] === 0) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] ^= gfMul(f, M[col][c]);
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Correct one block and return its data codewords.
 * @param {number[]} block data codewords followed by EC codewords
 */
function rsDecode(block, ecLen) {
  const received = block.slice();
  const syn = syndromes(received, ecLen);

  if (syn.some((s) => s !== 0)) {
    const { sigma, count } = errorLocator(syn, ecLen);
    if (count === 0 || count > ecLen / 2) throw new Error("QR is too damaged to read");

    const positions = errorPositions(sigma, received.length);
    if (positions.length !== count) throw new Error("QR is too damaged to read");

    const magnitudes = errorMagnitudes(positions, syn);
    positions.forEach((p, i) => {
      // Position p is the power of x in the received polynomial, which is
      // stored highest-degree-first.
      received[received.length - 1 - p] ^= magnitudes[i];
    });

    if (syndromes(received, ecLen).some((s) => s !== 0)) {
      throw new Error("QR is too damaged to read");
    }
  }
  return received.slice(0, received.length - ecLen);
}

// ── Codewords → text ────────────────────────────────────────

class BitReader {
  constructor(bytes) { this.bytes = bytes; this.pos = 0; }
  get remaining() { return this.bytes.length * 8 - this.pos; }
  read(n) {
    if (n > this.remaining) throw new Error("QR data ended unexpectedly");
    let v = 0;
    for (let i = 0; i < n; i++, this.pos++) {
      v = (v << 1) | ((this.bytes[this.pos >> 3] >> (7 - (this.pos & 7))) & 1);
    }
    return v;
  }
}

const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

/** Character-count field width, which widens with the version. */
function countBits(mode, version) {
  const tier = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  switch (mode) {
    case 1: return [10, 12, 14][tier];
    case 2: return [9, 11, 13][tier];
    case 4: return [8, 16, 16][tier];
    case 8: return [8, 10, 12][tier];
    default: throw new Error(`Unsupported QR mode ${mode}`);
  }
}

function decodeBytes(bytes) {
  // The spec's default is ISO-8859-1, but everything in practice writes
  // UTF-8, so try that first and only fall back when it is not valid.
  const buf = new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return Array.from(buf, (b) => String.fromCharCode(b)).join("");
  }
}

function decodeSegments(dataCodewords, version) {
  const r = new BitReader(dataCodewords);
  let text = "";

  while (r.remaining >= 4) {
    const mode = r.read(4);
    if (mode === 0) break;                      // terminator

    if (mode === 7) {                           // ECI: charset hint, skipped
      const first = r.read(8);
      if ((first & 0x80) === 0) { /* 7-bit designator, fully consumed */ }
      else if ((first & 0xc0) === 0x80) r.read(8);
      else if ((first & 0xe0) === 0xc0) r.read(16);
      else throw new Error("Malformed QR ECI header");
      continue;
    }

    const count = r.read(countBits(mode, version));

    if (mode === 4) {
      const bytes = [];
      for (let i = 0; i < count; i++) bytes.push(r.read(8));
      text += decodeBytes(bytes);
    } else if (mode === 2) {
      let i = 0;
      for (; i + 1 < count; i += 2) {
        const v = r.read(11);
        text += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45];
      }
      if (i < count) text += ALNUM[r.read(6)];
    } else if (mode === 1) {
      let i = 0;
      for (; i + 2 < count; i += 3) text += String(r.read(10)).padStart(3, "0");
      if (count - i === 2) text += String(r.read(7)).padStart(2, "0");
      else if (count - i === 1) text += String(r.read(4));
    } else {
      // Kanji (mode 8) and anything else would need its own table; a
      // meeting link never uses one.
      throw new Error(`Unsupported QR mode ${mode}`);
    }
  }
  return text;
}

// ── Entry point ─────────────────────────────────────────────

/**
 * Decode a sampled QR module grid.
 *
 * @param {number[][]} modules 1 = dark, 0 = light, indexed [row][col]
 * @param {number} size the grid's side length in modules
 * @returns {string} the encoded text
 * @throws when the grid is not a readable QR of a supported version
 */
export function decodeQR(modules, size) {
  if (size % 4 !== 1 || size < 21) throw new Error(`Not a QR grid size: ${size}`);
  const version = (size - 17) / 4;
  if (version > MAX_VERSION) {
    throw new Error(`QR version ${version} is larger than this reader supports (${MAX_VERSION})`);
  }

  const { level, mask } = decodeFormat(modules, size);
  const [ecPer, groups] = EC_BLOCKS[level][version];
  const totalCodewords =
    groups.reduce((n, [b, d]) => n + b * d, 0) + groups.reduce((n, [b]) => n + b, 0) * ecPer;

  const reserved = reservedModules(version);
  const interleaved = readCodewords(modules, size, reserved, mask, totalCodewords);

  const data = [];
  for (const block of deinterleave(interleaved, ecPer, groups)) {
    data.push(...rsDecode([...block.data, ...block.ec], ecPer));
  }
  return decodeSegments(data, version);
}
