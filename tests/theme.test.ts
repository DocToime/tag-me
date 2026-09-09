import { describe, expect, it } from "vitest";
import { parseAppearance, resolveTheme } from "../src/theme";

describe("parseAppearance", () => {
  it("keeps light, dark, and system", () => {
    expect(parseAppearance("light")).toBe("light");
    expect(parseAppearance("dark")).toBe("dark");
    expect(parseAppearance("system")).toBe("system");
  });
  it("treats missing or invalid values as system", () => {
    expect(parseAppearance(undefined)).toBe("system");
    expect(parseAppearance("yes")).toBe("system");
    expect(parseAppearance(0)).toBe("system");
    expect(parseAppearance({})).toBe("system");
    expect(parseAppearance(true)).toBe("system");
    expect(parseAppearance(null)).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("resolves each appearance against the system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
