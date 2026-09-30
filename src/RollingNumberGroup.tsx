/** @fileoverview Gives dense counter lists one shared visible canvas. */
import React, { type HTMLAttributes, type ReactElement } from "react";

/** Shares canvas work across counters. Apply scrolling and layout to this element. */
export function RollingNumberGroup({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>): ReactElement {
  return (
    <div
      {...props}
      className={`rolling-number-group ${className}`}
      data-digitloom-group=""
    />
  );
}
