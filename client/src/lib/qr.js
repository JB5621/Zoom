// ============================================================
// qr.js — minimal QR encoder (byte mode, EC level M, versions 1-10).
//
// Written out rather than pulled from npm on purpose: this app is meant to
// be self-hosted and usable on a LAN, so the invite QR must render with no
// third-party script and no outbound request carrying the meeting link.
//
// Scope is deliberately narrow — byte mode at EC level M covers up to 213
// bytes, which is far more than any room URL needs.
// ============================================================

const EC_LEVEL_M_BITS = 0b00;

// Per version: [totalCodewords, ecCodewordsPerBlock, [ [blocks, dataCw], ... ] ]
const VERSIONS = {
  1:  [26,  10, [[1, 16]]],
  2:  [44,  16, [[1, 28]]],
  3:  [70,  26, [[1, 44]]],
  4:  [100, 18, [[2, 32]]],
  5:  [134, 24, [[2, 43]]],
  6:  [172, 16, [[4, 27]]],
  7:  [196, 18, [[4, 31]]],
  8:  [242, 22, [[2, 38], [2, 39]]],
  9:  [292, 22, [[3, 36], [2, 37]]],
  10: [346, 26, [[4, 43], [1, 44]]],
};

const ALIGNMENT = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// ── GF(256) arithmetic for Reed-Solomon, primitive polynomial 0x11D ──
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], 1);
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGenerator(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.shift();
    res.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ecLen; i++) res[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return res;
}

// ── Bit stream ──────────────────────────────────────────────
class Bits {
  constructor() { this.arr = []; }
  push(value, length) {
    for (let i = length - 1; i >= 0; i--) this.arr.push((value >> i) & 1);
  }
  get length() { return this.arr.length; }
}

function byteCapacity(v) {
  const [, , groups] = VERSIONS[v];
  const dataBits = groups.reduce((n, [b, d]) => n + b * d, 0) * 8;
  const lenBits = v < 10 ? 8 : 16;      // byte-mode count field widens at v10
  return Math.floor((dataBits - 4 - lenBits) / 8);
}

function chooseVersion(byteLen) {
  for (let v = 1; v <= 10; v++) {
    if (byteLen <= byteCapacity(v)) return v;
  }
  throw new Error(
    `QR payload is ${byteLen} bytes; the maximum at EC level M is ${byteCapacity(10)}`
  );
}

function buildCodewords(bytes, version) {
  const [, ecPer, groups] = VERSIONS[version];
  const dataCw = groups.reduce((n, [b, d]) => n + b * d, 0);

  const bits = new Bits();
  bits.push(0b0100, 4);                       // byte mode
  bits.push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) bits.push(b, 8);

  // Terminator, then pad to a byte boundary, then alternating pad bytes.
  const capacity = dataCw * 8;
  for (let i = 0; i < 4 && bits.length < capacity; i++) bits.arr.push(0);
  while (bits.length % 8 !== 0) bits.arr.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits.arr[i + j];
    data.push(byte);
  }
  const PAD = [0xec, 0x11];
  while (data.length < dataCw) data.push(PAD[(data.length - bits.length / 8) % 2]);

  // Split into blocks, compute EC per block, then interleave both.
  const dataBlocks = [];
  const ecBlocks = [];
  let pos = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      const block = data.slice(pos, pos + size);
      pos += size;
      dataBlocks.push(block);
      ecBlocks.push(rsEncode(block, ecPer));
    }
  }

  const out = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  }
  for (let i = 0; i < ecPer; i++) {
    for (const b of ecBlocks) out.push(b[i]);
  }
  return out;
}

// ── Matrix construction ─────────────────────────────────────
function buildMatrix(version) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setF = (r, c, v) => { m[r][c] = v; reserved[r][c] = true; };

  // Finder patterns plus their separators, at three corners.
  const finder = (top, left) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = top + r, cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                       (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setF(rr, cc, inRing || inCore ? 1 : 0);
      }
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    setF(6, i, i % 2 === 0 ? 1 : 0);
    setF(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Alignment patterns, skipping the three finder corners.
  const centers = ALIGNMENT[version];
  for (const r of centers) {
    for (const c of centers) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          setF(r + dr, c + dc, ring === 1 ? 0 : 1);
        }
      }
    }
  }

  // Dark module, always set.
  setF(size - 8, 8, 1);

  // Reserve the format-information areas.
  for (let i = 0; i <= 8; i++) {
    if (m[8][i] === null) { m[8][i] = 0; reserved[8][i] = true; }
    if (m[i][8] === null) { m[i][8] = 0; reserved[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) { m[8][size - 1 - i] = 0; reserved[8][size - 1 - i] = true; }
    if (m[size - 1 - i][8] === null) { m[size - 1 - i][8] = 0; reserved[size - 1 - i][8] = true; }
  }

  // Version information, versions 7 and up.
  if (version >= 7) {
    let rem = version << 12;
    for (let i = 0; i < 12; i++) {
      if (rem >> (17 - i) & 1) rem ^= 0x1f25 << (5 - i);
    }
    const bits = (version << 12) | (rem & 0xfff);
    for (let i = 0; i < 18; i++) {
      const bit = (bits >> i) & 1;
      const r = Math.floor(i / 3), c = i % 3;
      setF(size - 11 + c, r, bit);
      setF(r, size - 11 + c, bit);
    }
  }

  return { m, reserved, size };
}

function placeData(m, reserved, size, codewords) {
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  const nextBit = () => {
    if (bitIndex >= totalBits) return 0;   // remainder bits are 0
    const bit = (codewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
    bitIndex++;
    return bit;
  };

  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;            // the vertical timing column is skipped
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (const col of [right, right - 1]) {
        if (!reserved[row][col] && m[row][col] === null) m[row][col] = nextBit();
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function formatBits(maskIndex) {
  const data = (EC_LEVEL_M_BITS << 3) | maskIndex;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
}

function applyFormat(m, size, maskIndex) {
  const bits = formatBits(maskIndex);
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> i) & 1;
    // Copy 1 — around the top-left finder.
    if (i < 6) m[8][i] = bit;
    else if (i === 6) m[8][7] = bit;
    else if (i === 7) m[8][8] = bit;
    else if (i === 8) m[7][8] = bit;
    else m[14 - i][8] = bit;
    // Copy 2 — split between the other two finders.
    if (i < 8) m[size - 1 - i][8] = bit;
    else m[8][size - 15 + i] = bit;
  }
  m[size - 8][8] = 1; // dark module
}

function penalty(m, size) {
  let score = 0;
  // Rule 1: runs of five or more same-coloured modules.
  for (let i = 0; i < size; i++) {
    for (const line of [m[i], m.map((row) => row[i])]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (line[j] === line[j - 1]) run++;
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  }
  // Rule 2: 2x2 blocks of one colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }
  // Rule 3: finder-like 1:1:3:1:1 patterns.
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j <= size - 11; j++) {
      const row = m[i].slice(j, j + 11);
      const col = m.slice(j, j + 11).map((r) => r[i]);
      for (const line of [row, col]) {
        if (A.every((v, k) => v === line[k]) || B.every((v, k) => v === line[k])) score += 40;
      }
    }
  }
  // Rule 4: deviation from an even split of dark and light.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += m[r][c];
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/**
 * Encode text as a QR matrix.
 * @returns {{ size: number, modules: number[][] }} 1 = dark, 0 = light
 */
export function encodeQR(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const version = chooseVersion(bytes.length);
  const codewords = buildCodewords(bytes, version);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const { m, reserved, size } = buildMatrix(version);
    placeData(m, reserved, size, codewords);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && MASKS[mask](r, c)) m[r][c] ^= 1;
      }
    }
    applyFormat(m, size, mask);
    const score = penalty(m, size);
    if (!best || score < best.score) best = { score, modules: m, size };
  }
  return { size: best.size, modules: best.modules };
}

/**
 * Render a QR as an SVG path string. SVG rather than canvas so it stays
 * crisp at any size and prints cleanly.
 */
export function qrToSvgPath(modules, size, quiet = 4) {
  let d = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return { path: d, extent: size + quiet * 2 };
}
