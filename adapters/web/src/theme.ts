/** Light/dark theme: follow system by default; manual toggle clears on OS theme change. */

export type Theme = "light" | "dark";

let override: Theme | null = null;

const mq =
  typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

export function systemTheme(): Theme {
  return mq?.matches ? "dark" : "light";
}

export function effectiveTheme(): Theme {
  return override ?? systemTheme();
}

export function isThemeOverridden(): boolean {
  return override !== null;
}

export function applyTheme(): Theme {
  const theme = effectiveTheme();
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  return theme;
}

/** Flip to the opposite of the current effective theme (locks until system changes). */
export function toggleTheme(): Theme {
  override = effectiveTheme() === "dark" ? "light" : "dark";
  return applyTheme();
}

/**
 * Apply system theme on load. Any later `prefers-color-scheme` change clears a manual
 * override and follows the OS again.
 */
export function initTheme(onSystemChange?: () => void): Theme {
  const theme = applyTheme();
  mq?.addEventListener("change", () => {
    override = null;
    applyTheme();
    onSystemChange?.();
  });
  return theme;
}
