export type Appearance = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function parseAppearance(value: unknown): Appearance {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

export function systemPrefersDark(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveTheme(
  appearance: Appearance,
  prefersDark = systemPrefersDark(),
): ResolvedTheme {
  if (appearance === "dark") return "dark";
  if (appearance === "light") return "light";
  return prefersDark ? "dark" : "light";
}

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#244d3c",
  dark: "#1a2420",
};

export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement;
  if (appearance === "light" || appearance === "dark") {
    root.dataset.theme = appearance;
  } else {
    root.removeAttribute("data-theme");
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[resolveTheme(appearance)]);
}
