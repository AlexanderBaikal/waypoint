import type { Theme } from "../config";

/**
 * Where the theme preference is kept, separate from the slice that holds it,
 * so the reducer stays a pure function of its inputs. The write happens in
 * listener middleware, as it does for the saved list.
 */
const THEME_KEY = "waypoint:theme";

/**
 * The theme is a preference about this browser rather than about what is on
 * screen, so it lives in localStorage rather than in the deep link. Blocked
 * storage throws, and a preference is not worth a crash.
 *
 * Dark is the default and only an explicit "light" turns it off, so an
 * unreadable value falls to dark. The inline script in index.html makes the
 * same decision before React mounts, to avoid a flash of the light interface;
 * it reads THEME_KEY too, so the two have to agree.
 */
export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Nothing useful to do; the choice still holds for this session.
  }
}
