// ============================================================
// useTileGrid.js — sizing for the video grid.
//
// The old grid was `repeat(auto-fit, minmax(160px, 480px))`, which only
// reacts to width. Two things go wrong with that in a call:
//   * tiles are hard-capped at 480px, so a wide window wastes most of
//     its space on one or two participants, and
//   * nothing accounts for height, so rows spill under the toolbar and
//     you have to scroll to see who is talking.
// Fitting tiles properly needs the box AND the participant count, which
// CSS cannot express on its own — hence this hook.
// ============================================================
import { useLayoutEffect, useRef, useState } from "react";

// Below this a tile stops being useful, so we stop shrinking and let the
// grid scroll instead (a phone in a 12-person call).
export const MIN_TILE_W = 148;

/**
 * Pick the column count that makes `count` tiles of `ratio` as large as
 * possible inside a boxW x boxH area with `gap` between them.
 *
 * Every column count from 1..count is tried because the best one is not
 * monotonic: it depends on how the resulting row count divides the height.
 */
export function fitTiles(count, boxW, boxH, gap, ratio = 16 / 9) {
  if (!count || boxW <= 0 || boxH <= 0) {
    return { cols: 1, width: 0, height: 0, scroll: false, ready: false };
  }

  let best = { cols: 1, width: 0, height: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const availW = (boxW - gap * (cols - 1)) / cols;
    const availH = (boxH - gap * (rows - 1)) / rows;
    if (availW <= 0 || availH <= 0) continue;

    // Whichever axis runs out first decides the tile size, so the tile
    // keeps its aspect ratio instead of being stretched to fill.
    const width = Math.min(availW, availH * ratio);
    if (width > best.width) best = { cols, width, height: width / ratio };
  }

  // Too cramped to honour the fit: pack as many minimum-width columns as
  // the width allows and hand vertical overflow back to the scroller.
  if (best.width < MIN_TILE_W) {
    const cols = Math.max(1, Math.floor((boxW + gap) / (MIN_TILE_W + gap)));
    const width = (boxW - gap * (cols - 1)) / cols;
    return { cols, width, height: width / ratio, scroll: true, ready: true };
  }

  return { ...best, scroll: false, ready: true };
}

/**
 * Observe an element's content box. Returns [ref, { width, height }].
 * The content box already excludes padding, so callers get exactly the
 * area their children may occupy.
 */
export function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // Bail out when nothing moved: this feeds element sizes, so a new
      // object every callback would re-render the whole grid on any
      // unrelated layout pass.
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}
