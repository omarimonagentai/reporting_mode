"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared resizable-width state for every right-side Sheet in the app
 * (Mode preview, Dry-run, Prompt Assistant, History drawer). A single
 * localStorage key — `right-sheet:width` — backs all four so the user
 * has a coherent visual rhythm when alternating between Sheets.
 *
 * Consumers receive `{ width, handleProps }` and own the markup for
 * the handle element. The hook covers drag logic, persistence, and
 * the min/max/default clamps.
 *
 * Drag mechanics: on pointerdown we attach pointermove + pointerup
 * to `window` and only detach on pointerup. We deliberately avoid
 * relying on React's synthetic event system or pointer-capture on
 * the handle element, because shadcn's Sheet wraps the Content in a
 * Radix DismissableLayer whose native pointer listeners run at the
 * document level. Earlier versions used `setPointerCapture` + React
 * `onPointerMove` on the handle, which left a window of opportunity
 * for Radix to interpret the drag's first event as an "interact
 * outside" and dismiss the Sheet mid-resize — visually equivalent to
 * "the resize does nothing".
 */

const MIN_WIDTH = 480;
const MAX_WIDTH = 1400;
const DEFAULT_WIDTH = 672;
const STORAGE_KEY = "right-sheet:width";

function loadWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < MIN_WIDTH || n > MAX_WIDTH) {
    return DEFAULT_WIDTH;
  }
  return n;
}

type HandleProps = {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
};

export function useResizableSheetWidth(): {
  width: number;
  handleProps: HandleProps;
} {
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const widthRef = useRef(DEFAULT_WIDTH);
  widthRef.current = width;

  // Rehydrate from localStorage after mount so SSR output stays
  // deterministic (default width).
  useEffect(() => {
    setWidth(loadWidth());
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = widthRef.current;

      function onMove(ev: PointerEvent) {
        // The handle is on the LEFT edge of a right-anchored Sheet:
        // moving the pointer left of the start position grows the
        // panel.
        const dx = startX - ev.clientX;
        const next = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, startWidth + dx)
        );
        setWidth(next);
      }

      function onUp(ev: PointerEvent) {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        const dx = startX - ev.clientX;
        const finalWidth = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, startWidth + dx)
        );
        try {
          window.localStorage.setItem(STORAGE_KEY, String(finalWidth));
        } catch {
          // ignore quota / disabled storage
        }
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    []
  );

  return {
    width,
    handleProps: { onPointerDown },
  };
}
