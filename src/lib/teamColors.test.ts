import { describe, expect, it } from "vitest";
import { accentFromClubColors, contrastWithWhite } from "./teamColors";

describe("accentFromClubColors", () => {
  it("uses the first proper colour", () => {
    expect(accentFromClubColors("Red / White")).toBe("#e30613");
    expect(accentFromClubColors("Royal Blue / White")).toBe("#034694");
    expect(accentFromClubColors("Claret / Sky Blue")).toBe("#7a1e3a");
  });

  it("skips white and black, which don't work as an accent", () => {
    expect(accentFromClubColors("White / Blue")).toBe("#1d4ed8"); // Leeds
    expect(accentFromClubColors("Black / White")).not.toBe("#111111"); // Newcastle
  });

  it("darkens light colours so white text stays readable", () => {
    const sky = accentFromClubColors("Sky Blue / White"); // Man City
    expect(sky).not.toBe("#6cabdd");
    expect(contrastWithWhite(sky)).toBeGreaterThanOrEqual(3);
    expect(contrastWithWhite(accentFromClubColors("Yellow / Black"))).toBeGreaterThanOrEqual(3);
  });

  it("lightens navy so it shows up on the dark background", () => {
    const spurs = accentFromClubColors("Navy Blue / White");
    expect(spurs).not.toBe("#132257");
    expect(contrastWithWhite(spurs)).toBeGreaterThanOrEqual(3);
  });

  it("falls back to a neutral colour", () => {
    expect(accentFromClubColors(null)).toBe("#4f46e5");
    expect(accentFromClubColors("Tartan")).toBe("#4f46e5");
    expect(accentFromClubColors("White / Black")).toBe("#4f46e5"); // Fulham: neither works
  });
});
