// ============================================================
// gf256.js — GF(256) arithmetic and Reed-Solomon coding.
//
// Shared by the QR encoder (qr.js) and decoder (qrDecode.js) so both
// agree on one field. QR uses the primitive polynomial 0x11D.
// ============================================================

const PRIMITIVE = 0x11d;

export const EXP = new Uint8Array(512);
export const LOG = new Uint8Array(256);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= PRIMITIVE;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

export const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** a / b. Dividing by zero is a caller bug, not a recoverable input. */
export function gfDiv(a, b) {
  if (b === 0) throw new Error("GF(256) division by zero");
  if (a === 0) return 0;
  return EXP[(LOG[a] - LOG[b] + 255) % 255];
}

export const gfInv = (a) => gfDiv(1, a);

/** x^n over the field, for any integer n (negative included). */
export const gfPow = (a, n) => (a === 0 ? 0 : EXP[(((LOG[a] * n) % 255) + 255) % 255]);

// ── Polynomials, coefficients highest-degree-first ──────────

/** Multiply two polynomials. */
export function polyMul(p, q) {
  const out = new Array(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) {
    if (p[i] === 0) continue;
    for (let j = 0; j < q.length; j++) out[i + j] ^= gfMul(p[i], q[j]);
  }
  return out;
}

/** Evaluate a polynomial at x (Horner). */
export function polyEval(p, x) {
  let y = 0;
  for (const c of p) y = gfMul(y, x) ^ c;
  return y;
}

/** The Reed-Solomon generator polynomial of the given degree. */
export function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) poly = polyMul(poly, [1, EXP[i]]);
  return poly;
}

/** The `ecLen` error-correction codewords for `data`. */
export function rsEncode(data, ecLen) {
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
