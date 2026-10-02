import { describe, expect, it } from "vitest";
import {
  centerReel,
  compareNumberValues,
  planNumberCharacters,
  targetReelIndex,
} from "../src/core/characters";

describe("rolling number formatting", () => {
  it.each(["τ18,446,744.073709551", "+0.000000001%", "$-0.00000", "****", "—"])(
    "preserves the exact text %s",
    (value) => {
      expect(
        planNumberCharacters(value)
          .map((character) => character.text)
          .join(""),
      ).toBe(value);
    },
  );

  it("retains decimal positions when another integer digit appears", () => {
    const old = planNumberCharacters("999.01");
    const next = planNumberCharacters("1,000.01");
    expect(old.find((character) => character.place === "i:0")?.digit).toBe(9);
    expect(next.find((character) => character.place === "i:0")?.digit).toBe(0);
    expect(
      next.filter((character) => character.place.startsWith("f:")),
    ).toEqual(old.filter((character) => character.place.startsWith("f:")));
  });

  it("compares values below floating point precision and across a sign change", () => {
    expect(
      compareNumberValues("τ18,446,744.073709550", "τ18,446,744.073709551"),
    ).toBe(1);
    expect(compareNumberValues("$-0.5", "$-0.1")).toBe(1);
    expect(compareNumberValues("-0.000000001%", "+0.000000001%")).toBe(1);
    expect(compareNumberValues("1.0", "1.00")).toBe(0);
  });
});

describe("rolling number interruptions", () => {
  it("retains a fractional position while rebasing repeated digits", () => {
    expect(centerReel(29.25)).toBe(19.25);
    expect(centerReel(0.5)).toBe(10.5);
    expect(targetReelIndex(19.25, 1, 1)).toBe(21);
    expect(targetReelIndex(10.5, 9, -1)).toBe(9);
  });
});
