# Adjacent counters on a shared canvas

## Status

Overall: working. Updated: 2026-09-30.

## Issue and root cause

Wallet PnL uses a 4px gap. Each counter clears at least 10px beyond its right edge. Each draw clears independently. An active amount can erase a settled percentage on the same canvas.

## Scope and contracts

Change Digitloom's scheduler, controller, lifecycle tests, and patch version. Release through GitHub Actions. Update the wallet dependency and lockfile. Preserve motion timing, formatting, selectable text, reduced motion, zoom, and wallet layout. Preserve unrelated edits. Do not run or build the extension.

## Design

Clear each affected surface once, then redraw its counters. Updates, resize, visibility, disable, and unmount use the same invalidation. Static neighbors remain in the redraw set.

## Acceptance and test matrix

- [x] Partial updates retain settled adjacent counters, including parentheses at a 4px gap.
- [x] Frames clear once per surface before drawing.
- [x] Hide, disable, resize, scroll, and destroy retain remaining neighbors.
- [x] Shared clocks, native text, and cleanup retain their contracts.
- [x] Release checks and the 5 KiB gzip gate pass.
- [ ] Actions publishes the patch and wallet installs it.

Authentication, persistence, financial mutations, migration, and input validation are unchanged. Existing tests cover the unchanged contracts. Repaint cost is bounded by mounted visible counters per surface.

## Steps

- [x] Reproduce and fix surface clearing.
- [x] Run approved release checks and inspect dense-grid performance.
- [x] Obtain two independent reviews of final content.
- [ ] [pending] Sign, publish through Actions, and update wallet.

## Evidence and risks

Evidence: controller paintWidth/clear and scheduler draw iteration. Browser policy blocks extension inspection. Use library checks, not a browser-policy workaround. Prior release-check authorization applies. Worker availability is checked.
Risk: settled counters add redraw work on partially active surfaces. Check dense-grid performance and package size. Preserve crop and pixel ratio transforms.

## Validation evidence

- Old renderer fails the partial-update unit regression. Expected one clear, observed two.
- Full library release checks pass: 31 tests, formatting, lint, TypeScript, library build, demo build, and size gate.
- Runtime JavaScript plus CSS: 4,987 gzip bytes. Archive dry run passed.
- Browser pixel check: use Arial 24px, tabular digits, a 4px flex gap, amount τ0.01 and percent (0.00%). Settle both after an 80ms update, then update only the amount with an 825ms animation. Sample the first 8px of the percentage at 220ms.
- Opening-parenthesis alpha sum: 1.0.0 drops from 53,240 to 1,410. Version 1.0.1 remains 53,240.
- Local browser smoke checks, 1,000 counters: old frame-gap p95 9.3ms all-update and 9.2ms partial-update. Patch 9.2ms all-update and 9.1ms partial-update. One earlier patch run reached 16.7ms. These short runs do not support a speed claim.
- Worker connection timed out. Checks ran locally. No extension build or dev process was run.

## Independent reviews

Both reviewers confirmed code diff SHA256 7ce32b485e6a65a6e3a8b5910426e0dacf5df8852451cc69494ee2f00c822599.
Implementation: /root/canvas_implementation_review. Acceptance: /root/canvas_acceptance_review.
Neither found a blocking in-scope defect. Final browser evidence closes the pending pixel and partial-performance checks.

## Residual risks

Neighbor geometry can remain stale after sibling width changes without a group resize. This behavior predates the patch. Shared resize and scroll paths retain their contracts by inspection, but lack dedicated multi-counter assertions. Zoom remains covered by existing viewport checks. Browser smoke runs use synthetic data and do not prove acceptance in the running wallet extension.
