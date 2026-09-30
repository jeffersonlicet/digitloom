# Adjacent-digit stagger and 1.0.5 release

## Status

- Overall: done
- Updated: 2026-09-30

## Issue and scope

Equal neighboring digit deltas use identical trajectories. The user approved a restrained stagger and release. Add a deterministic 24 ms delay only to alternate digits in a contiguous run of equal, nonzero travel. Cap the delay at 10% of the caller's duration. Symbols and unchanged digits break the run. Preserve the easing, rolling direction, per-digit duration, interrupted contributions, and native text.

Include the separately verified canvas CSS sizing fix. Update stale README motion descriptions. Preserve unrelated files and wallet feature edits. Release 1.0.5 through GitHub Actions, then install its checked archive in the wallet and update the existing PR. Sign commits and tags with the configured YubiKey. Do not build or restart the extension.

## Design

A focused shared-clock collaborator creates at most two clocks per timing configuration in each update batch: immediate and delayed. Counters share those clocks. Existing progress caching reads each clock once per frame. A delayed contribution starts at zero progress and retains its clock during interruption. No per-digit timer, React frame update, geometry read, random direction, or extra revolution is introduced. Delayed digits finish at most 24 ms after the normal clock.

## Acceptance and test matrix

- [x] Equal neighboring travel differs at the same sampled time.
- [x] Unequal travel, symbols, and unchanged digits do not receive a delay.
- [x] Equal runs alternate immediate and delayed clocks deterministically.
- [x] Short durations cap the delay. Zero duration remains static.
- [x] Increasing and decreasing values follow their original direction.
- [x] Interrupted delayed rolls preserve current position and outstanding contributions.
- [x] A 1,000-counter batch shares two clocks and cleans them up exactly once.
- [x] Existing sizing, visibility, precision, selection, and lifecycle tests pass.
- [x] Browser verification checks the minified runtime and wallet spring easing.
- [x] Full release checks pass within 5,120 gzip bytes.
- [x] Two reviewers confirm the same final content identifier.
- [x] Signed source, successful npm workflow, published artifact, and wallet installation are verified separately.

Authentication, data persistence, migrations, and external input schemas are unchanged. Existing timing validation remains intact. Forced colors, reduced motion, and hidden counters retain their existing behavior.

## Risks and mitigations

The stagger adds at most 24 ms to total settlement. Dense grids must retain batch clock sharing. The package has only six bytes of size headroom before this change; reduce duplicated runtime logic instead of increasing the limit. The exact reported wallet font-size trigger remains unconfirmed. The sizing regression is proven independently.

## Steps

- [x] Implement shared delayed clocks and focused regressions.
- [x] Run release checks and browser acceptance.
- [x] Obtain two independent reviews.
- [x] Sign and release through Actions.
- [x] Install and verify the published package in the wallet.

## Evidence and final outcome

Implementation, independent reviews, publication, and wallet integration passed. Residual acceptance limits are listed below.

## Validation evidence

- All 59 tests, formatting, lint, TypeScript, build, package-size check, and demo build passed after the final runtime edit.
- Production dependency audit: zero vulnerabilities.
- Runtime JavaScript plus CSS: 5,120/5,120 bytes gzip.
- The minified production browser fixture confirmed two shared clocks, delays of 0 and 24 ms, and unchanged 825 ms duration.
- At 12 ms, the immediate phase had progress 0.014545 and the delayed phase had progress zero.
- Five currency switches retained 16 px PnL text and the exact formatted values. All clocks settled.
- The worker connection timed out. Checks used the local fallback.
- An optional three-library remeasurement stopped responding during a heavy sample. Its capture was discarded. The website keeps its historical comparison.
- The final dense-grid comparison against 1.0.4 completed in two reversed rounds. At 1,000 counters, frame p95 was 49.9–56.6 ms versus 58.0–58.5 ms. PERFORMANCE.md records every count and update p95. Both versions exceed the 60 Hz budget at 1,000 visible counters. Browser zoom and live extension acceptance remain unverified for this patch.

## Size reduction boundaries

Use the existing surface owner set instead of a duplicate client count. Keep pixel ratio on the atlas instead of duplicate surface state. Distinct internal atlas names permit audited property minification. Numeric canvas geometry caching skips identical style writes. Delayed phase lookup uses the immediate clock instead of repeated timing-key construction. Static glyph lookup runs only for static characters. Source maps remain separate files without automatic runtime annotations. Native text remains the single grid child; redundant explicit grid placement was removed.

## Independent final reviews

Both reviewers confirmed content identifier `7cf5a9021552fcb08146f61c95d218ff4e603a6eaff0c0839f890202ea2c0dcd` without a blocking finding.

- `/root/canvas_implementation_review`: confirmed sizing, clock ownership, interruption, native API names, and public contracts.
- `/root/canvas_acceptance_review`: confirmed meaningful regression coverage and release evidence.

The browser's 16 px check measures DOM font size, not canvas glyph size. The exact wallet shrink trigger remains unconfirmed.
There is no package-size margin. Browser zoom and live extension acceptance remain unverified for this patch.

## Publication and wallet evidence

The first signing attempts failed. A user-requested retry succeeded without changing the signer or disabling signing.

- Signed library commit: `b85799e715d296856ebb5891ea20ee6f920bd996`. GitHub reports a valid verified signature.
- Signed tag: `v1.0.5`. Local tag verification passed.
- [npm release workflow](https://github.com/jeffersonlicet/digitloom/actions/runs/36785538092): succeeded.
- [Pages workflow](https://github.com/jeffersonlicet/digitloom/actions/runs/36785538739): succeeded.
- Public npm metadata lists 1.0.5 as latest. The downloaded archive matches its SHA-512 integrity, the checked local archive, and the Actions archive.
- The live website references the checked demo build assets.
- npm initially cached a 404 for the archive. pnpm cached the verified public archive, then the unchanged frozen lockfile installed successfully.
- Installed wallet JavaScript and CSS match the published package bytes.
- Seven focused wallet integration tests, TypeScript, formatting, and diff checks passed.
- Signed wallet commit: `d91d237b49598eb181f235c7de86e8d8f26ed323`. GitHub reports a valid verified signature.
- [Wallet PR #1007](https://github.com/CrucibleAILabs/wallet/pull/1007) targets `2.1.5` and contains the four-file dependency update.
- Normal wallet hooks ran. No extension build, start, or restart occurred. Unrelated work remains untouched.

The exact wallet shrink trigger, patch zoom acceptance, and live extension acceptance remain unverified.
The fresh three-library capture did not complete. The website retains its historical capture.
The 1,000-counter regression fixture exceeds the 60 Hz frame budget in both versions.
