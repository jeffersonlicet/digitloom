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
- [x] Actions publishes the patch and wallet installs it.

Authentication, persistence, financial mutations, migration, and input validation are unchanged. Existing tests cover the unchanged contracts. Repaint cost is bounded by mounted visible counters per surface.

## Steps

- [x] Reproduce and fix surface clearing.
- [x] Run approved release checks and inspect dense-grid performance.
- [x] Obtain two independent reviews of final content.
- [x] Sign, publish through Actions, and update wallet.

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

## Follow-up: currency precision

The user reported that the added 7706 decimal positions appeared without rolling. Missing previous positions used the target digit. They now start at zero during value changes. Initial rendering stays static through the existing visibility and previous-value policy.
The regression fails with the old fallback and passes with the zero origin. All 32 release tests and checks pass. Runtime gzip is 4,985 bytes.
Both reviewers confirmed final diff SHA256 8970ca8805436aae11c87bd066be236e269d4c240db472abbcd49992b1e831dc.
Browser check: +τ0.22 becomes +τ0.0007706 with 825ms linear timing. The last digit's pixel hash stays 321,315,924 in the old renderer. In the patch it changes from 220,007,628 at 180ms to 321,315,924 at rest. The digit remains visible and finishes at the same exact glyph.
Version 1.0.1 publication and Pages deployment passed. npm confirms 1.0.1. Follow-up 1.0.2 publication and wallet installation passed.

## Final outcome

Version 1.0.2 includes both patches. npm metadata confirms the version. Its downloaded archive matches the checked runtime and lockfile checksum. Release workflow 36755430470 and Pages workflow 36755430946 passed.
Wallet installed 1.0.2 through the frozen lockfile with lifecycle scripts disabled. Seven focused wallet tests and TypeScript passed. Signed commit 60d54dd57421b8f281d18fb200d27f452c1c5397 is pushed to PR 1007 against 2.1.5. Wallet CI is running.
No extension build or dev process was run locally. The live extension remains unverified because browser policy blocks extension URLs. The archived recording, library browser regressions, and package checks establish the scoped fixes.
Runtime dependency audit reports zero vulnerabilities. Preserve the existing residual geometry and coverage risks stated above.

## Follow-up: proportional digit positions

The user reported a wider visual gap between the closing parenthesis and ALL after a currency change. The layout gap remains 8px. General Sans Medium has proportional digit widths and no tnum feature. The renderer normalized all digits to zero whenever CSS requested tabular numbers. That incorrectly reused punctuation positions across different native advances.
Scope: correct the position cache, add a font geometry regression, compare old/new dense-grid update and frame timings, release a patch, and update the wallet. Preserve the font and layout tokens. Keep measurements outside animation frames and retain the 512-entry cache ceiling.
Acceptance: suffix positions match the native text for both (32.91%) and (28.06%), repeated values retain cached measurements, animation frames do not measure text, and dense-grid checks quantify any update cost before release.

- [x] Correct position-cache identity and reproduce the font regression.
- [x] Run release checks and old/new dense-grid measurements.
- [ ] [pending] Review, publish, and update the wallet.

The follow-up also covers virtual row transforms and new zero columns. The recording shows Hone text on Score's row. The virtual list keeps stable row IDs, but the surface observer does not watch descendant row transforms. Observe descendant class and style changes. Ignore canvas style writes to prevent feedback. A layout refresh must preserve a pending value animation. New zero columns must roll one cycle. Unchanged columns remain still.

## Version 1.0.3 validation

The cache now stores actual character advances, with 512 entries per atlas. It does not assume that CSS enables equal digit widths. LTR updates retain the native first-cell origin. RTL updates retain each native cell position. Geometry reads occur during update preparation, never during animation frames. Padding and borders retain their native origin.

Descendant class and style changes refresh virtual row positions. Canvas writes and opacity-only fades do not refresh geometry. Both layout/value notification orders preserve the requested duration. Newly added zero columns roll one cycle. Unchanged zero columns stay still.

All 40 tests pass. Formatting, lint, TypeScript, library build, demo build, and size checks pass. Runtime JavaScript plus CSS is 5,120 gzip bytes, exactly the approved limit. The limit has no margin. Unused internal width fields and a redundant canvas selection rule were removed. Native text selection remains unchanged.

Production browser checks use General Sans Medium and React production mode. Each run has 1,000 mounted counters, 40 columns, 350ms linear motion, and 12 updates at 400ms intervals. Two rounds reverse version order. Setup timing includes the React commit and queued canvas preparation. With 12 samples, nearest-rank p95 is the largest setup sample. Short measurements establish a regression check, not a general speed claim.

| Version | Round | Update | Frame gap p95 | Setup p95 |
| ------- | ----- | ------ | ------------- | --------- |
| 1.0.2   | 0     | All    | 25.0ms        | 38.3ms    |
| 1.0.3   | 0     | All    | 24.9ms        | 34.6ms    |
| 1.0.2   | 1     | All    | 25.0ms        | 28.0ms    |
| 1.0.3   | 1     | All    | 24.8ms        | 39.7ms    |
| 1.0.2   | 0     | One    | 17.5ms        | 8.8ms     |
| 1.0.3   | 0     | One    | 17.7ms        | 12.4ms    |
| 1.0.2   | 1     | One    | 17.2ms        | 8.9ms     |
| 1.0.3   | 1     | One    | 17.0ms        | 8.9ms     |

Frame timing remains comparable. Full-update setup medians rise from 27.75ms to 29.95ms and from 26.65ms to 31.05ms. This is a measured correctness cost for native origin reads. The measurements do not support a claim of zero setup overhead. Existing 1,000-counter all-update frames already exceed 16.7ms. Wallet virtualization bounds mounted rows. No new geometry work runs in animation frames.

Browser geometry checks cover four wallet values in LTR/RTL, each with and without 8px padding. Maximum LTR position error is 0.078125px. RTL native positions match exactly. The checked values are (32.91%), (28.06%), +τ0.0007706, and (0.00%). These checks cover 16 combinations.

The implementation reviewer found missing padded and RTL origins in the initial draft. Both findings were confirmed and fixed before release. Tests and browser checks cover the corrected geometry. Cache eviction and decreasing new-zero motion lack dedicated tests. Existing cache bounds and direction logic remain directly inspectable.

The production fixture is saved in /private/tmp/digitloom-browser-check. Release check output is /private/tmp/digitloom-1.0.3-check.log. These local artifacts are temporary. No extension build, process start, or browser-policy workaround occurred.

Browser virtual-row replay: settle 13.00 on a 300px by 140px shared surface. Move its absolute row with translateY from 0px to 80px without changing the value or group size. Version 1.0.2 retains old-row alpha 150,666 and paints zero alpha at the new row. Version 1.0.3 clears old-row alpha to zero and paints 150,666 at the new row. The same component remains mounted.

Both independent reviewers confirmed final manifest SHA256 ce300f4c04d473916f5829bbe0e9e5461bf83534d5b5f7a98ba6c54ffb4ad3c4. The implementation reviewer is /root/canvas_implementation_review. The acceptance reviewer is /root/canvas_acceptance_review. Both verified all 11 file hashes and found no unresolved blocking finding. Review verdicts are recorded after their checks. Publication and wallet installation remain pending.
