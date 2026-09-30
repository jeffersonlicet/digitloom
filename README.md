# Digitloom

Selectable rolling numbers for React. Exact text stays in the DOM. A shared canvas draws the changing digits.

## Install

```sh
npm install digitloom
```

Requires React 18 or 19. Import the stylesheet once.

```tsx
import { RollingNumber } from "digitloom";
import "digitloom/styles.css";

export function Balance({ value }: { value: string }) {
  return <RollingNumber value={value} className="balance" />;
}
```

Format the value in your application. Digitloom does not round or convert it.

## Dense lists

Wrap related counters in `RollingNumberGroup`. The group shares one canvas, layout observers, and animation work.
Apply layout, padding, and scrolling to the group element.

```tsx
import { RollingNumber, RollingNumberGroup } from "digitloom";

<RollingNumberGroup className="balances">
  {balances.map(({ id, value }) => (
    <RollingNumber key={id} value={value} />
  ))}
</RollingNumberGroup>;
```

The group accepts standard React `div` attributes. Keep counters in separate, non-overlapping cells.
Use separate groups for separate scroll areas. A counter outside a group owns its own canvas.

## Personalize

```css
.balance {
  font-family: system-ui, sans-serif;
  font-size: 48px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  color: #03a66d;
}
```

```tsx
<RollingNumber
  value="$1,234.50"
  duration={500}
  easing="ease-out"
  className="balance"
/>
```

| Prop        | Type      | Default                      | Use                                                     |
| ----------- | --------- | ---------------------------- | ------------------------------------------------------- |
| `value`     | `string`  | Required                     | Exact formatted text.                                   |
| `className` | `string`  | `""`                         | Font, color, size, and line height.                     |
| `duration`  | `number`  | `350`                        | Finite, nonnegative milliseconds. Zero disables motion. |
| `easing`    | `string`  | `cubic-bezier(0.16,1,0.3,1)` | Valid CSS easing.                                       |
| `animated`  | `boolean` | `true`                       | Enable digit motion.                                    |

Invalid values and timing throw before rendering or updating.
The first render stays still. Existing columns move smoothly when their native positions change.
Interrupted digits retain unfinished rolling contributions. Settled unchanged digits remain still.
Equal neighboring digit travel uses an alternating 24 ms delay, capped at 10% of the duration.
Easing, direction, and per-digit duration stay unchanged. Delayed digits finish up to 24 ms later.
Symbols and unchanged digits break the stagger sequence.

## Accessibility and browser support

Exact text stays selectable and available to assistive technology. The canvas is decorative and hidden from assistive technology.
Reduced motion, page visibility, and viewport visibility control motion. Forced-color mode shows native text.
Server rendering produces text without requiring canvas APIs.

Use current browsers with Canvas 2D, Web Animations, IntersectionObserver, ResizeObserver, and media-query change events.
Canvas pixel density follows browser zoom and the visual viewport scale. Font loading and layout changes refresh the canvas.
The package does not include browser polyfills or a React Native renderer.

Animate one segment with ASCII digits, a dot decimal separator, and optional comma grouping.
Prefixes, suffixes, and signs preserve their exact text. Other text is displayed literally.
Localized decimal separators, scientific notation, and multiple numeric segments are outside the animation contract.
Use normal horizontal text. Advanced font features, text shadows, and transformed group ancestors need separate visual verification.

## Performance

Counters share a frame scheduler. Geometry reads precede canvas writes. Glyph and position caches have fixed limits.
The canvas covers the visible group area. Offscreen counters remain mounted but do not animate.
No React updates occur on animation frames. Canvas still requires raster work. This is not a zero-paint guarantee.

The runtime limit is 5 KiB gzip for JavaScript and CSS. React, types, source maps, documentation, and the demo are excluded.
Run `npm run size` for the measured build. See [PERFORMANCE.md](PERFORMANCE.md) for the latest reproducible comparison.
Virtualize large application lists when appropriate. Profile the complete application, including fonts, scrolling, and updates.
Revisit the renderer when the supported visible workload repeatedly exceeds the application's frame budget.

## Development

Use Node.js 24.

```sh
npm ci
npm run check
npm run demo
```

`npm run build:demo` creates the static site. The demo compares Digitloom, NumberFlow, and React CountUp.
Both competitors are development dependencies. They are excluded from the runtime package.

## Release

[RELEASING.md](RELEASING.md) describes the GitHub Actions release.
The workflow validates the tag, checks the package, and publishes the exact checked archive using `NPM_TOKEN`.

## License

MIT. See [LICENSE](LICENSE).
