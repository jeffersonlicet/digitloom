import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RollingNumber, RollingNumberGroup } from "../src/index.js";

describe("React public contract", () => {
  it("renders exact server text without decorative digit duplication", () => {
    const markup = renderToStaticMarkup(
      <RollingNumber value="$1,234.50" className="balance" />,
    );
    expect(markup).toContain('class="rolling-number balance"');
    expect(markup).toContain(
      '<span class="rolling-number__text">$1,234.50</span>',
    );
    expect(markup).not.toContain("canvas");
    expect(markup.match(/\$1,234\.50/g)).toHaveLength(1);
  });
  it("renders an explicit group without duplicating text", () => {
    const markup = renderToStaticMarkup(
      <RollingNumberGroup className="list">
        <RollingNumber value="12.50" />
      </RollingNumberGroup>,
    );
    expect(markup).toContain('data-digitloom-group=""');
    expect(markup.match(/12\.50/g)).toHaveLength(1);
  });
  it("rejects invalid public timing before rendering", () => {
    expect(() =>
      renderToStaticMarkup(<RollingNumber value="1" duration={-1} />),
    ).toThrow(RangeError);
  });
});
