/** @fileoverview Preserves formatted text and plans digit positions and rolling direction. */
export interface NumberCharacter {
  key: string;
  text: string;
  digit?: number;
}

const NUMBER_PATTERN = /[-+]?\d[\d,]*(?:\.\d+)?/;

/** Keeps the caller's formatted text and identifies digits by decimal position. */
export function planNumberCharacters(value: string): NumberCharacter[] {
  const match = NUMBER_PATTERN.exec(value);
  if (!match) return [{ key: "literal", text: value }];

  const numeric = match[0];
  const sign = /^[+-]/.test(numeric) ? numeric[0] : "";
  const [integer, fraction] = numeric.slice(sign.length).split(".");
  let position = integer.replace(/,/g, "").length;
  const characters: NumberCharacter[] = [
    { key: "prefix", text: value.slice(0, match.index) + sign },
  ];

  for (const text of integer) {
    if (text === ",") {
      characters.push({ key: `group:${position}`, text });
    } else {
      position -= 1;
      characters.push({
        key: `integer:${position}`,
        text,
        digit: Number(text),
      });
    }
  }
  if (fraction !== undefined) {
    characters.push({ key: "decimal", text: "." });
    Array.from(fraction).forEach((text, index) => {
      characters.push({ key: `fraction:${index}`, text, digit: Number(text) });
    });
  }
  characters.push({
    key: "suffix",
    text: value.slice(match.index + numeric.length),
  });
  return characters.filter((character) => character.text);
}

/** Compares decimal strings without converting balances to floating point. */
export function compareNumberValues(previous: string, next: string): number {
  const left = NUMBER_PATTERN.exec(previous)?.[0].replace(/,/g, "");
  const right = NUMBER_PATTERN.exec(next)?.[0].replace(/,/g, "");
  if (!left || !right) return 0;

  const decimals = Math.max(
    left.split(".")[1]?.length ?? 0,
    right.split(".")[1]?.length ?? 0,
  );
  const scaled = (value: string) => {
    const [integer, fraction = ""] = value.split(".");
    return BigInt(integer + fraction.padEnd(decimals, "0"));
  };
  const a = scaled(left);
  const b = scaled(right);
  return b > a ? 1 : b < a ? -1 : 0;
}

/** Rebases a reel inside its repeated glyphs without changing visible content. */
export function centerReel(index: number): number {
  return 10 + (((index % 10) + 10) % 10);
}

/** Finds the next occurrence of a digit in the requested rolling direction. */
export function targetReelIndex(
  from: number,
  digit: number,
  trend: number,
): number {
  let target = 10 + digit;
  if (trend < 0 && target > from) target -= 10;
  if (trend >= 0 && target < from) target += 10;
  return target;
}
