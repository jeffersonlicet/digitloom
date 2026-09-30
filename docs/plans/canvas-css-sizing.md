# Canvas CSS sizing after currency and zoom changes

## Status

- Overall: done (scoped sizing defect)
- Updated: 2026-09-30

## Issue and evidence

A user reported that PnL text appeared smaller after a currency change. The exact wallet trigger remains unconfirmed. The renderer updates canvas CSS dimensions only when rounded backing dimensions change. Different CSS dimensions can round to the same backing dimensions. Stale CSS dimensions then scale the bitmap incorrectly.

## Scope and contracts

Change only canvas sizing in the controller and its regression tests. Preserve font selection, native text, accessibility, visibility, mobile spring timing, clock sharing, and the strict 5 KiB gzip ceiling. Do not build or restart the extension. Do not publish another version without completing release validation. Preserve unrelated wallet and library work.

## Solution

Update CSS width and height from prepared geometry independently of backing-store allocation. Retain the allocation guard to avoid clearing an unchanged canvas. No geometry reads or React updates are added to animation frames.

## Acceptance and test matrix

- [x] Fractional CSS width and height changes update the display size when backing dimensions remain unchanged.
- [x] Pixel-ratio changes with unchanged backing dimensions update CSS size.
- [x] Existing controller lifecycle, continuity, positioning, and visibility tests pass.
- [x] Formatting, lint, TypeScript, and strict package-size checks pass.
- [x] Two independent reviewers inspect the same final content.

Trust-boundary, authorization, persistence, migration, and external API categories are not applicable: this is browser bitmap sizing. Existing text and reduced-motion coverage protects accessibility. Font loading and live wallet acceptance remain separate checks.

## Motion assessment

Equal adjacent travel with a shared clock produces equal trajectories. Prefer a small deterministic stagger only for equal neighboring travel. Reject random direction, extra revolutions, and arbitrary speed changes. This assessment does not change motion in this sizing patch.

## Steps

- [x] Reproduce stale CSS dimensions with unchanged backing dimensions.
- [x] Correct the sizing guard and run authorized checks.
- [x] Complete independent review.

## Risks and outcome

The fractional sizing defect is concrete, but its connection to the user's exact wallet observation remains unconfirmed. Live extension acceptance is pending. No release or external mutation is included in this patch.

## Validation evidence

Both new regressions failed before the change. All 50 library tests, formatting, lint, TypeScript, build, size, and demo build passed afterward. Runtime size is 5,114 bytes gzip, below 5,120 bytes. The checks ran locally because the build worker was unavailable. No extension process was started.

## Independent reviews

Both reviewers confirmed content identifier `c164100c41a834b35ab7249927f29f4300b428debbb0dec75a18bd64385e7268` without a blocking finding.

- `/root/canvas_implementation_review`: confirmed the allocation guard, sizing correction, and unchanged animation-frame reads.
- `/root/canvas_acceptance_review`: confirmed both regression failures and the final checks. The prepared-geometry fixtures do not establish the exact wallet trigger.

## Final outcome

The scoped sizing correction is verified locally. The initial review identifier covers the sizing patch only.
The final 1.0.5 release also includes adjacent-digit stagger and size optimizations.
See [the release plan](adjacent-digit-stagger.md) for final validation and publication status.
The exact wallet font-size trigger remains unconfirmed.
