# Settled number clarity

## Status

- Overall: verified; publication pending
- Owner: Codex
- Updated: 2026-10-01

## Issue and context

Users report blurry numbers that remain blurry after motion stops. Digitloom 1.0.5 retains glyph bitmaps after natural completion.
Its completion path removes clocks but leaves native text transparent. This differs from explicit settle, which restores native text.
The owning paths are controller.draw, controller.settle, and shared surface repaint. The wallet integrates the public React component.
The current wallet checkout is a separate passkeys branch and uses NumberFlow. Do not change that branch or its unrelated token file.

## Scope and boundaries

Fix natural completion in the shared library. Preserve exact text, motion timing, direction, stagger, interruptions, selection, and shared surfaces.
Keep the strict 5 KiB runtime limit. Add focused lifecycle regressions and a browser fixture with wallet typography.
Do not add visible wallet UI, dependencies, configuration, compatibility paths, or per-frame layout reads.
Do not build, start, or restart the extension. Keep unrelated assets and the existing clipping plan unchanged.
User explicitly authorized tests for this defect. Use the worker when available, or the local fallback when unavailable.
Publication and wallet integration follow the existing signed release workflow after verified implementation.

## Design and acceptance

Use the existing settle path when all owned clocks finish, before drawing that counter.
Preserve completed layout cells for the next currency update. Clear roll references and clocks.
The scheduler clears the surface before drawing; natural completion does not queue a second repaint.
The shared surface repaint must remove its pixels while preserving neighbors that still animate.
A pending value update must retain outstanding contributions. Finishing only the immediate phase must not settle a delayed phase.
Native text must remain visible at rest and after layout, zoom, or font refresh.
Fractional positions and dimensions will be inspected for bitmap resampling during motion.

- [x] Native text is visible after natural completion, without an overlaid final bitmap.
- [x] Shared neighbors remain visible and animate until their own clocks finish.
- [x] Delayed and interrupted clocks retain their existing behavior.
- [x] Settled text is native across currency changes and zoom checks.
- [x] Release checks and strict size gate pass.
- [x] Two independent reviewers confirm the same final content identifier.

## Test matrix

| Behavior                   | Check                               | Expected result                                           |
| -------------------------- | ----------------------------------- | --------------------------------------------------------- |
| Natural completion         | Controller regression               | Native text restored and canvas region cleared            |
| Delayed completion         | Controller regression               | Text stays animated until both phases finish              |
| Partial shared completion  | Controller regression               | Finished text is native and live neighbor remains painted |
| Subsequent update          | Controller regression               | Native counter can animate again from its previous value  |
| Currency and font          | Browser fixture                     | Exact text, native color, and typography after settlement |
| Zoom and fractional layout | Browser fixture                     | Native settled text and no stale overlay                  |
| Performance                | Dense-grid regression and size gate | No per-frame measurement, shared clocks, at most 5 KiB    |

Authentication, schemas, persistence, migrations, and external input validation are unaffected.
Existing reduced-motion, hidden, disabled, and unmounted cases remain covered.

## Steps

- [x] [complete] Reproduce natural completion with a failing regression and browser evidence.
- [x] [complete] Implement the owning lifecycle correction.
- [x] [complete] Run focused and full checks, then browser acceptance.
- [x] [complete] Obtain independent reviews.
- [ ] [pending] Publish the signed fix and update the Digitloom wallet branch.

## Validation and residual risks

The regression failed on 1.0.5 because data-rolling-ready remained after completion.
The first correction cleared layout history and failed two currency layout regressions. The final correction retains layout history.
Full check passed: formatting, lint, TypeScript, 63 tests in six files, runtime build, strict size gate, and demo build.
Runtime size: 5,119 gzip bytes, with a 5,120-byte limit. No size-gate exemption was used.
The build worker connection timed out. These checks used the authorized local fallback.
The browser fixture compares the released 1.0.5 runtime with the built patch at DPR 2.
Four sizes (16, 15.5, 28, and 64 px), fractional positions, red, green, and white were checked.
The initial fixture failed to load its font and used Arial. Those results are not wallet-font acceptance.
The corrected fixture bundles General Sans Medium, waits for font readiness, and reports its loaded FontFace.
Its asset hash matches the wallet font. All normal-size and scaled-layout checks were repeated with this font.
At rest, 1.0.5 retained transparent text and canvas ink. The patch restored native colors and left zero canvas ink.
The fixture also uses the wallet spring with an 825 ms duration.
Repeated USD and TAO switches passed at normal and 200% CSS zoom. Native fonts retained their computed sizes and colors.
The larger samples were outside the viewport at 200% CSS zoom. This is not evidence of their visible zoomed motion or native browser DPR zoom.
Both independent reviewers confirmed the scoped implementation and acceptance evidence with no blocking findings.
Review inputs exclude the preexisting clipping plan and assets.
The 1,000-counter completion regression verifies two shared clocks, native final text, no final bitmap draws, and single clock cancellation.
No new timing benchmark or actual extension acceptance is claimed. The extension was not built or restarted.
The version remains 1.0.5 locally. Publication and wallet integration are pending.

Canvas text can differ from DOM antialiasing while it moves. Exact user device and zoom are not supplied.
The change restores the browser's native text rasterization at rest instead of promising identical moving glyph rasterization on every device.
