# Number motion: stable color, layout, and interrupted rolls

## Status

- Overall: working
- Updated: 2026-09-30

## Issue and evidence

Wallet users report synchronized rolls, currency layout jumps, and dark-to-bright red PNL text. The supplied recording switches between USD and TAO values with different integer and decimal lengths. The renderer multiplies glyph opacity by visible ink. It also replaces each counter clock on every value update and immediately uses target glyph positions.

Mobile uses damping 24, stiffness 180, mass 0.8, and overshoot clamping. It preserves an unchanged digit's ongoing spring. NumberFlow preserves ongoing digit effects and animates horizontal positions. Unchanged settled digits and equal-distance rolls are expected controls, not defects.

## Scope and boundaries

Change the Digitloom canvas controller and focused motion collaborators, types, and regression tests. Preserve the public React API, exact selectable text, reduced motion, visibility cleanup, glyph caches, shared surfaces, and mobile timing. Do not add wallet UI, animation options, dependencies, or random delays. Preserve unrelated wallet and library changes. Library publishing and wallet dependency updates follow verified release checks. Do not build or run the extension.

## Solution

Keep glyph color opaque. Suppress subpixel ink slivers instead of fading whole digits. Preserve unchanged digit clocks across value updates. Move existing glyphs from their current visual horizontal position to the next native text position. Read geometry only during preparation. Share clocks across each update batch and release every retained clock on settle or unmount. Keep changed-digit retargets continuous in position. Ongoing roll effects accumulate when a changed digit retargets. This preserves the old contribution and its motion. The browser curve remains the sampled mobile spring response. Horizontal retargets preserve position but start the next layout response from rest.

## Quality and acceptance

- [x] Red digit pixels retain the selected color throughout visible motion.
- [x] Unchanged in-flight digits continue on their original clock.
- [x] Currency layout transitions begin at the previous visual position and finish at native positions.
- [x] Layout refresh, rapid updates, new zeros, precision changes, virtual rows, and cleanup remain correct.
- [x] No per-frame geometry reads, unbounded clocks, or new animation loop.
- [x] Dense-grid checks and compressed size checks pass. Preserve the approved 5 KiB ceiling unless explicitly revised.
- [x] Two independent reviews confirm the final content.

## Test matrix

| Class                                   | Method                                        | Expected result                                   |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| Exact color regression                  | Canvas draw spy and browser pixels            | No opacity modulation of visible digits           |
| Interrupted update                      | Two values with an unchanged in-flight place  | Original digit clock remains active               |
| Horizontal transition                   | Currency width and host-origin changes        | Continuous position and exact endpoint            |
| Duplicate and layout ordering           | Same target and refresh before/after update   | No restart or lost roll                           |
| New decimals and zeros                  | Existing controller regressions               | Added digits roll and settled zeros remain static |
| Visibility, reduced motion, destruction | Existing lifecycle tests                      | All clocks released and native text restored      |
| Shared surfaces                         | Multiple counters and partial updates         | Surviving neighbors remain visible                |
| Platform and accessibility              | Browser fixture, LTR/RTL, native selection    | Geometry and text contracts preserved             |
| Performance                             | 100–1,000 counters, unchanged preparation spy | Shared clocks and no frame-time layout reads      |
| Package and public contracts            | Existing full library release checks          | Types, exports, size, and demo remain valid       |

Authentication, storage, network retries, malformed external payloads, migrations, and logging are not applicable. This change only affects local presentation of validated formatted text. Existing parsing and unavailable-canvas behavior remain unchanged.

## Risks

Horizontal interpolation can overlap neighboring glyphs when widths shrink. Inspect currency changes at intermediate frames. Retained clocks can leak if ownership is wrong. Cover partial completion and destruction. Native browser canvas antialiasing can differ from DOM text. Check color interiors rather than antialiased edges. The package has little size headroom. Internal field minification must exclude public props and browser properties. The strict 5 KiB ceiling stays.

## Work

- [x] Trace the recording, wallet timing, mobile code, and NumberFlow source.
- [x] Implement motion and color corrections with regression coverage.
- [x] Run authorized checks and isolated browser acceptance.
- [x] Obtain independent implementation and acceptance reviews.
- [ ] [pending] Report verified delivery and remaining release steps.

## Validation

Earlier user authorization covers release checks. The configured build worker timed out on 2026-09-30. Run checks locally while it is unavailable. No extension build or dev process is authorized.

## Independent reviews

Pending final content and fresh evidence.

## Outcome

Pending. No commit, push, or publication for this fix yet.

## Source validation — 2026-09-30

48 library tests, TypeScript, lint, and formatting passed before the release version change. The build produced 5,112 bytes gzip. The 5,120-byte gate passed. Final release checks passed. The minified package passed the browser comparison below.

## Review finding

The implementation reviewer identified unbounded historical canvas bleed. This finding was confirmed. Preparation now limits horizontal bleed to the available viewport space. The backing width cannot exceed the viewport width. A regression covers a one-million-pixel origin change, completion, and a later refresh. Final source and minified-artifact checks will use a new manifest.

## Final browser evidence — minified artifact

The production HTTP fixture imports dist/index.js, uses the wallet font, and uses the mobile 825 ms sampled spring for currency demonstrations. Both renderers receive identical values. Native public React props render correctly. The final fixture recorded 7,152 opacity-modulated glyph draws for 1.0.3 and zero for 1.0.4. The visible exact strings and currency transitions were inspected. This is isolated HTTP acceptance, not live extension acceptance.

Dense-grid comparison used 100, 250, 500, and 1,000 counters, six updates per run, 350 ms linear motion, 400 ms cadence, and two reversed renderer orders. Frame p95 was 9.2–9.4 ms through 500 counters. At 1,000 counters it was 24.9–26.0 ms for 1.0.3 and 17.2–24.8 ms for 1.0.4. Update p95 at 1,000 counters was 30.9–52.4 ms for 1.0.3 and 43.9–82.9 ms for 1.0.4. Six samples make update p95 sensitive to individual stalls. No zero-overhead claim is supported. No marketing benchmark file was replaced with these measurements.

The tests additionally reject subpixel slivers, retain shared clocks through partial completion, and bound retained unfinished contributions during 100 rapid updates with controlled native completion. The latest full check passed 48 tests, TypeScript, lint, formatting, runtime build, 5,112-byte size gate, and demo build. Worker unavailable. No extension build or restart occurred. Horizontal retargets preserve position but do not retain horizontal velocity. Vertical rolls retain unfinished contributions.

## Final independent confirmations

Implementation reviewer /root/canvas_implementation_review and acceptance reviewer /root/canvas_acceptance_review both confirm source identifier efe9b272026937a2809ad04155f2822ecde044346d22fd09f28a940f60f67c04. No blocking finding remains. The resource finding was fixed and reviewed again. Both reviewers performed read-only inspections. Residual limits are the eight-byte size margin, limited benchmark samples, horizontal velocity restart, and no live extension acceptance. Release and wallet dependency delivery remain pending.
