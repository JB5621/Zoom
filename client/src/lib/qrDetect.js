// ============================================================
// qrDetect.js — find a QR code in a camera frame and sample it down to
// the module grid that qrDecode.js reads.
//
// The pipeline is the conventional one: adaptive threshold, locate the
// three finder patterns by their 1:1:3:1:1 signature, work out the
// version from their spacing, then sample the grid through a
// perspective transform so a phone held at an angle still reads.
// ============================================================

import { decodeQR } from "./qrDecode";

// ── Binarization ────────────────────────────────────────────

const BLOCK = 8;          // threshold is computed per 8x8 block
const MIN_DYNAMIC_RANGE = 24;

/** RGBA pixels → one luminance byte per pixel. */
function toLuminance(data, width, height) {
  const lum = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    // Integer weights close to Rec. 601; the exact coefficients do not
    // matter once the result is thresholded.
    lum[i] = (data[p] * 77 + data[p + 1] * 151 + data[p + 2] * 28) >> 8;
  }
  return lum;
}

/**
 * Local-average threshold. A single global cut-off fails on camera
 * frames, where one corner of the code is routinely several stops
 * darker than the other.
 *
 * @returns {Uint8Array} 1 = dark module, 0 = light
 */
function binarize(lum, width, height) {
  const bw = Math.max(1, Math.ceil(width / BLOCK));
  const bh = Math.max(1, Math.ceil(height / BLOCK));
  const averages = new Int32Array(bw * bh);

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let sum = 0, min = 255, max = 0, n = 0;
      const y1 = Math.min(height, (by + 1) * BLOCK);
      const x1 = Math.min(width, (bx + 1) * BLOCK);
      for (let y = by * BLOCK; y < y1; y++) {
        for (let x = bx * BLOCK; x < x1; x++) {
          const v = lum[y * width + x];
          sum += v; n++;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      let avg;
      if (max - min > MIN_DYNAMIC_RANGE) {
        avg = sum / n;
      } else {
        // A block with no real contrast holds no edge, so its own average
        // is meaningless as a threshold. Treat it as paper — half of its
        // darkest pixel is then safely below anything in it — unless the
        // neighbours already resolved above and to the left say the
        // surface is darker than that.
        avg = min / 2;
        if (by > 0 && bx > 0) {
          const neighbour =
            (averages[(by - 1) * bw + bx] +
             2 * averages[by * bw + bx - 1] +
             averages[(by - 1) * bw + bx - 1]) / 4;
          if (min < neighbour) avg = neighbour;
        }
      }
      averages[by * bw + bx] = Math.round(avg);
    }
  }

  const bits = new Uint8Array(width * height);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      // Smooth over a 5x5 window of block averages so the threshold does
      // not step visibly at block boundaries.
      let sum = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const y = by + dy, x = bx + dx;
          if (y < 0 || y >= bh || x < 0 || x >= bw) continue;
          sum += averages[y * bw + x]; n++;
        }
      }
      const threshold = sum / n;
      const y1 = Math.min(height, (by + 1) * BLOCK);
      const x1 = Math.min(width, (bx + 1) * BLOCK);
      for (let y = by * BLOCK; y < y1; y++) {
        for (let x = bx * BLOCK; x < x1; x++) {
          bits[y * width + x] = lum[y * width + x] < threshold ? 1 : 0;
        }
      }
    }
  }
  return bits;
}

// ── Finder patterns ─────────────────────────────────────────

/** Do five alternating run lengths match a finder's 1:1:3:1:1? */
function isFinderRatio(counts) {
  const total = counts[0] + counts[1] + counts[2] + counts[3] + counts[4];
  if (total < 7) return false;
  const module = total / 7;
  const tol = module / 2;
  return (
    Math.abs(module - counts[0]) < tol &&
    Math.abs(module - counts[1]) < tol &&
    Math.abs(3 * module - counts[2]) < 3 * tol &&
    Math.abs(module - counts[3]) < tol &&
    Math.abs(module - counts[4]) < tol
  );
}

/** Run lengths of one row or column, as [{dark, start, len}, ...]. */
function runsAlong(bits, width, height, fixed, horizontal) {
  const runs = [];
  const n = horizontal ? width : height;
  let prev = null;
  for (let i = 0; i < n; i++) {
    const dark = (horizontal ? bits[fixed * width + i] : bits[i * width + fixed]) === 1;
    if (dark !== prev) { runs.push({ dark, start: i, len: 1 }); prev = dark; }
    else runs[runs.length - 1].len++;
  }
  return runs;
}

/**
 * Centre and module size of a finder pattern crossing this line through
 * `at`, or null if the 1:1:3:1:1 signature is not there.
 */
function crossCheck(bits, width, height, fixed, at, horizontal) {
  const runs = runsAlong(bits, width, height, fixed, horizontal);
  for (let i = 0; i + 4 < runs.length; i++) {
    if (!runs[i].dark) continue;
    const window = runs.slice(i, i + 5);
    if (window.some((r, k) => r.dark !== (k % 2 === 0))) continue;
    const mid = window[2];
    if (at < mid.start || at >= mid.start + mid.len) continue;
    const counts = window.map((r) => r.len);
    if (!isFinderRatio(counts)) continue;
    const total = counts.reduce((a, b) => a + b, 0);
    return { center: mid.start + mid.len / 2, moduleSize: total / 7 };
  }
  return null;
}

/**
 * Candidate finder-pattern centres, each confirmed in both axes.
 * @returns {{x: number, y: number, moduleSize: number, count: number}[]}
 */
function findFinderPatterns(bits, width, height) {
  const candidates = [];
  const step = Math.max(1, Math.floor(height / 240));   // 3 rows per module at worst

  for (let y = 0; y < height; y += step) {
    const runs = runsAlong(bits, width, height, y, true);
    for (let i = 0; i + 4 < runs.length; i++) {
      if (!runs[i].dark) continue;
      const window = runs.slice(i, i + 5);
      if (window.some((r, k) => r.dark !== (k % 2 === 0))) continue;
      const counts = window.map((r) => r.len);
      if (!isFinderRatio(counts)) continue;

      const x = Math.floor(window[2].start + window[2].len / 2);
      const vertical = crossCheck(bits, width, height, x, y, false);
      if (!vertical) continue;
      const cy = vertical.center;
      const horizontal = crossCheck(bits, width, height, Math.floor(cy), x, true);
      if (!horizontal) continue;

      const moduleSize = (vertical.moduleSize + horizontal.moduleSize) / 2;
      // A true pattern is square, so the two axes must agree.
      if (Math.abs(vertical.moduleSize - horizontal.moduleSize) > moduleSize / 2) continue;

      const found = { x: horizontal.center, y: cy, moduleSize };
      const near = candidates.find(
        (c) =>
          Math.abs(c.x - found.x) <= moduleSize &&
          Math.abs(c.y - found.y) <= moduleSize &&
          Math.abs(c.moduleSize - found.moduleSize) <= Math.max(1, moduleSize / 2)
      );
      if (near) {
        near.x = (near.x * near.count + found.x) / (near.count + 1);
        near.y = (near.y * near.count + found.y) / (near.count + 1);
        near.moduleSize = (near.moduleSize * near.count + moduleSize) / (near.count + 1);
        near.count += 1;
      } else {
        candidates.push({ ...found, count: 1 });
      }
    }
  }
  return candidates;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Triples of candidates that could be one code's three finders, best
 * first. A frame often contains more than three candidates — reflections
 * and text both produce false positives — so the caller tries each
 * triple until one decodes.
 */
function candidateTriples(candidates) {
  const pool = [...candidates].sort((a, b) => b.count - a.count).slice(0, 12);
  const triples = [];

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        const set = [pool[i], pool[j], pool[k]];
        const sizes = set.map((p) => p.moduleSize);
        const meanSize = (sizes[0] + sizes[1] + sizes[2]) / 3;
        const sizeSpread = Math.max(...sizes) - Math.min(...sizes);
        if (sizeSpread > meanSize * 0.7) continue;

        const d = [dist(set[0], set[1]), dist(set[1], set[2]), dist(set[0], set[2])];
        const hyp = Math.max(...d);
        const legs = d.filter((v) => v !== hyp);
        if (legs.length !== 2) continue;
        if (hyp < meanSize * 10) continue;                       // too small to be a code
        const legSkew = Math.abs(legs[0] - legs[1]) / hyp;
        const rightAngle = Math.abs(hyp - Math.hypot(legs[0], legs[1])) / hyp;
        if (legSkew > 0.35 || rightAngle > 0.2) continue;

        triples.push({ set, score: legSkew + rightAngle + sizeSpread / meanSize });
      }
    }
  }
  return triples.sort((a, b) => a.score - b.score).map((t) => t.set);
}

/** Label a triple as top-left (the right-angle corner), top-right, bottom-left. */
function orientPatterns([a, b, c]) {
  const pairs = [
    { d: dist(a, b), far: [a, b], corner: c },
    { d: dist(b, c), far: [b, c], corner: a },
    { d: dist(a, c), far: [a, c], corner: b },
  ];
  const hypotenuse = pairs.reduce((m, p) => (p.d > m.d ? p : m));
  const topLeft = hypotenuse.corner;
  let [p, q] = hypotenuse.far;

  // Image y grows downward, so for an upright code the cross product of
  // (topRight - topLeft) and (bottomLeft - topLeft) is positive.
  const cross =
    (p.x - topLeft.x) * (q.y - topLeft.y) - (p.y - topLeft.y) * (q.x - topLeft.x);
  if (cross < 0) [p, q] = [q, p];

  return { topLeft, topRight: p, bottomLeft: q };
}

// ── Version and the fourth corner ───────────────────────────

/** Every legal side length from version 1 to the decoder's limit. */
const DIMENSIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 4 + 17);

/**
 * Candidate side lengths, most likely first.
 *
 * The finder patterns give only a rough module size: a scan line crosses
 * a rotated code diagonally, which stretches every run by the same
 * factor and so leaves the 1:1:3:1:1 ratio intact while inflating the
 * measurement by up to 41%. That is enough to land two versions out.
 * Rather than measure more cleverly, order the ten legal side lengths by
 * how close they are to the estimate and let the format-information BCH
 * check and the Reed-Solomon pass reject the wrong ones — they already
 * have to be trusted for that.
 */
function candidateDimensions(topLeft, topRight, bottomLeft, moduleSize) {
  const across = dist(topLeft, topRight) / moduleSize;
  const down = dist(topLeft, bottomLeft) / moduleSize;
  const estimate = (across + down) / 2 + 7;
  return [...DIMENSIONS].sort((a, b) => Math.abs(a - estimate) - Math.abs(b - estimate));
}

/** Is a run about `want` pixels long, allowing for a blurred edge? */
const nearLength = (len, want) => Math.abs(len - want) <= want / 2 + 1;

/**
 * Locate the bottom-right alignment pattern near `estimate`, so the
 * transform gets a measured fourth point rather than an extrapolated one.
 *
 * The pattern is one dark module inside a light 3x3 ring inside a dark
 * 5x5 ring, so a line through its centre reads dark-light-dark-light-dark
 * at one module each. Only the middle three runs are checked against the
 * module size: the outer two sit against data modules and merge with any
 * that happen to be dark.
 */
function findAlignment(bits, width, height, estimate, moduleSize) {
  const radius = Math.max(4, Math.ceil(moduleSize * 4));
  const yFrom = Math.max(0, Math.floor(estimate.y - radius));
  const yTo = Math.min(height - 1, Math.ceil(estimate.y + radius));
  const xFrom = estimate.x - radius;
  const xTo = estimate.x + radius;

  let best = null;
  for (let y = yFrom; y <= yTo; y++) {
    const runs = runsAlong(bits, width, height, y, true);
    for (let i = 0; i + 4 < runs.length; i++) {
      const window = runs.slice(i, i + 5);
      if (window.some((r, k) => r.dark !== (k % 2 === 0))) continue;
      if (!nearLength(window[1].len, moduleSize)) continue;
      if (!nearLength(window[2].len, moduleSize)) continue;
      if (!nearLength(window[3].len, moduleSize)) continue;
      if (window[0].len < moduleSize / 2 || window[4].len < moduleSize / 2) continue;

      const cx = window[2].start + window[2].len / 2;
      if (cx < xFrom || cx > xTo) continue;

      const cy = crossCheckAlignment(bits, width, height, Math.round(cx), y, moduleSize);
      if (cy === null) continue;

      const error = Math.hypot(cx - estimate.x, cy - estimate.y);
      if (!best || error < best.error) best = { error, point: { x: cx, y: cy } };
    }
  }
  return best ? best.point : null;
}

/** The same dark-light-dark-light-dark check vertically; returns its centre. */
function crossCheckAlignment(bits, width, height, x, y, moduleSize) {
  const dark = (row) => bits[row * width + x] === 1;
  if (!dark(y)) return null;

  let top = y;
  let bottom = y;
  while (top > 0 && dark(top - 1)) top--;
  while (bottom < height - 1 && dark(bottom + 1)) bottom++;
  if (!nearLength(bottom - top + 1, moduleSize)) return null;

  const limit = moduleSize * 2 + 2;
  let light = 0;
  let row = top - 1;
  for (; row >= 0 && !dark(row) && light <= limit; row--) light++;
  if (!nearLength(light, moduleSize) || row < 0 || !dark(row)) return null;

  light = 0;
  row = bottom + 1;
  for (; row < height && !dark(row) && light <= limit; row++) light++;
  if (!nearLength(light, moduleSize) || row >= height || !dark(row)) return null;

  return (top + bottom + 1) / 2;
}

// ── Perspective transform ───────────────────────────────────
// 3x3 homographies as flat row-major arrays.

function mul3(a, b) {
  const out = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[r * 3 + k] * b[k * 3 + c];
      out[r * 3 + c] = s;
    }
  }
  return out;
}

/** Adjugate, which inverts a homography up to the scale that cancels out. */
function adjugate(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  return [
    e * i - f * h, c * h - b * i, b * f - c * e,
    f * g - d * i, a * i - c * g, c * d - a * f,
    d * h - e * g, b * g - a * h, a * e - b * d,
  ];
}

/** Maps (0,0),(1,0),(1,1),(0,1) onto the four given points in order. */
function squareToQuad([p0, p1, p2, p3]) {
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  if (dx3 === 0 && dy3 === 0) {
    return [
      p1.x - p0.x, p3.x - p0.x, p0.x,
      p1.y - p0.y, p3.y - p0.y, p0.y,
      0, 0, 1,
    ];
  }
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
  const den = dx1 * dy2 - dx2 * dy1;
  const a13 = (dx3 * dy2 - dx2 * dy3) / den;
  const a23 = (dx1 * dy3 - dx3 * dy1) / den;
  return [
    p1.x - p0.x + a13 * p1.x, p3.x - p0.x + a23 * p3.x, p0.x,
    p1.y - p0.y + a13 * p1.y, p3.y - p0.y + a23 * p3.y, p0.y,
    a13, a23, 1,
  ];
}

const quadToQuad = (from, to) => mul3(squareToQuad(to), adjugate(squareToQuad(from)));

function project(m, x, y) {
  const w = m[6] * x + m[7] * y + m[8];
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
}

/**
 * Read the module grid through `transform`, taking each module as the
 * majority of five samples so a single noisy pixel cannot flip it.
 */
function sampleGrid(bits, width, height, transform, dimension) {
  const modules = [];
  const OFFSETS = [[0, 0], [-0.25, 0], [0.25, 0], [0, -0.25], [0, 0.25]];

  for (let row = 0; row < dimension; row++) {
    const line = new Array(dimension);
    for (let col = 0; col < dimension; col++) {
      let dark = 0;
      let seen = 0;
      for (const [dx, dy] of OFFSETS) {
        const p = project(transform, col + 0.5 + dx, row + 0.5 + dy);
        const x = Math.round(p.x), y = Math.round(p.y);
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        seen++;
        dark += bits[y * width + x];
      }
      if (seen === 0) throw new Error("QR extends past the edge of the frame");
      line[col] = dark * 2 > seen ? 1 : 0;
    }
    modules.push(line);
  }
  return modules;
}

// ── Entry points ────────────────────────────────────────────

// Each attempt is one grid sample plus one decode. Bounding them keeps a
// frame full of false positives from stalling the scan loop, which has
// the next frame to get to anyway.
const MAX_ATTEMPTS = 48;

/**
 * Try to read a QR code out of one frame.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 *        RGBA pixels, i.e. exactly a canvas ImageData.
 * @returns {string|null} the decoded text, or null when no code was read
 */
export function scanImageData(image) {
  const { data, width, height } = image;
  if (!width || !height) return null;

  const lum = toLuminance(data, width, height);
  const bits = binarize(lum, width, height);
  const candidates = findFinderPatterns(bits, width, height);
  if (candidates.length < 3) return null;

  const budget = { left: MAX_ATTEMPTS };
  for (const triple of candidateTriples(candidates)) {
    const text = tryTriple(bits, width, height, triple, budget);
    if (text !== null) return text;
    if (budget.left <= 0) break;
  }
  return null;
}

function tryTriple(bits, width, height, triple, budget) {
  const { topLeft, topRight, bottomLeft } = orientPatterns(triple);
  const moduleSize = (topLeft.moduleSize + topRight.moduleSize + bottomLeft.moduleSize) / 3;
  if (!(moduleSize > 0)) return null;

  // Extrapolating the parallelogram puts the fourth corner where it would
  // be with no perspective at all — usable, but least accurate exactly
  // where the distortion is largest.
  const parallelogram = {
    x: topRight.x - topLeft.x + bottomLeft.x,
    y: topRight.y - topLeft.y + bottomLeft.y,
  };

  for (const dimension of candidateDimensions(topLeft, topRight, bottomLeft, moduleSize)) {
    // The bottom-right alignment pattern, present from version 2 up, is a
    // real fourth point and pins that corner properly.
    const corners = [];
    if (dimension >= 25) {
      const pull = 1 - 3 / (dimension - 7);
      const estimate = {
        x: topLeft.x + pull * (parallelogram.x - topLeft.x),
        y: topLeft.y + pull * (parallelogram.y - topLeft.y),
      };
      const found = findAlignment(bits, width, height, estimate, moduleSize);
      if (found) corners.push({ point: found, gridCoord: dimension - 6.5 });
    }
    corners.push({ point: parallelogram, gridCoord: dimension - 3.5 });

    for (const { point, gridCoord } of corners) {
      if (budget.left <= 0) return null;
      budget.left -= 1;

      const from = [
        { x: 3.5, y: 3.5 },
        { x: dimension - 3.5, y: 3.5 },
        { x: gridCoord, y: gridCoord },
        { x: 3.5, y: dimension - 3.5 },
      ];
      try {
        const transform = quadToQuad(from, [topLeft, topRight, point, bottomLeft]);
        return decodeQR(sampleGrid(bits, width, height, transform, dimension), dimension);
      } catch {
        // A failed sample or decode only rules out this geometry; there
        // are other side lengths and other triples still to try.
      }
    }
  }
  return null;
}
