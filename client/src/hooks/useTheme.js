// ============================================================
// useTheme.js — light/dark selection.
//
// Three states, not two: "system" (the default) follows the OS and keeps
// following it when the OS flips, while "light"/"dark" pin the choice.
// The CSS does the actual work — see the data-theme blocks in index.css.
// ============================================================
import { useCallback, useEffect, useState } from "react";

const KEY = "zoomclone_theme";
const THEME_COLOR = { light: "#e1e2f2", dark: "#060718" };

function readStored() {
  // Private mode and blocked site-data both make this throw.
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemTheme() {
  return typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function resolveTheme(choice) {
  return choice === "system" ? systemTheme() : choice;
}

/**
 * Apply a choice to the document. Exported so index.html-level code or a
 * future entry point can call it before React mounts.
 */
export function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);

  // Keep the mobile browser chrome in step with the page.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[resolveTheme(choice)]);
}

export function useTheme() {
  const [choice, setChoice] = useState(readStored);
  const [system, setSystem] = useState(systemTheme);

  // Subscribing to the OS preference is the legitimate use of an effect:
  // an external system pushing updates in. Nothing else sets state here.
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystem(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Derived during render rather than mirrored into state, so a theme
  // change costs one render instead of two.
  const resolved = choice === "system" ? system : choice;

  useEffect(() => {
    applyTheme(choice);
    try {
      if (choice === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // Not being able to remember the choice is not worth breaking over.
    }
  }, [choice, resolved]);

  // Toggling from "system" pins the opposite of what is currently on
  // screen, which is what someone clicking the button expects.
  const toggle = useCallback(() => {
    setChoice(resolved === "light" ? "dark" : "light");
  }, [resolved]);

  return { choice, resolved, setChoice, toggle };
}
