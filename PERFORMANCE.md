# Performance check

The demo contains one historical comparison capture from Digitloom 1.0.0 with dense grids and balance lists. Download the raw observations from the chart.

Digitloom 1.0.0, grouped NumberFlow 0.6.2, and React CountUp 6.5.3 ran separately in two rounds. The second round reversed the library order.
Each round uses one changed-value warmup and targets eight measured updates. Updates are scheduled every 100 ms with 350 ms motion.
The timed sampling limit is 10 seconds per round. Synchronous library work can exceed this limit before control returns.
The viewport was 616 × 916 at pixel ratio 2. This local macOS browser check did not isolate host activity.
Offscreen counters remain mounted. Each renderer uses its native viewport behavior. The visible counts differ because native line boxes differ.
This check measures long mounted lists with a bounded visible area, not 1,000 simultaneously visible counters.

## Dense grid

| Mounted | Digitloom p95 (ms) | NumberFlow p95 (ms) | CountUp p95 (ms) | Timed updates: DL / NF / CU |
| ------- | ------------------ | ------------------- | ---------------- | --------------------------- |
| 100     | 9.1                | 474.9               | 9.1              | 16 / 16 / 16                |
| 250     | 9.3                | 1991.7              | 17.2             | 16 / 10 / 16                |
| 500     | 16.8               | 416.5               | 41.7             | 16 / 4 / 16                 |
| 1000    | 25.7               | 575.9               | 100.9            | 16 / 2 / 16                 |

## Balance list

| Mounted | Digitloom p95 (ms) | NumberFlow p95 (ms) | CountUp p95 (ms) | Timed updates: DL / NF / CU |
| ------- | ------------------ | ------------------- | ---------------- | --------------------------- |
| 100     | 9.3                | 399.9               | 9.3              | 16 / 16 / 16                |
| 250     | 9.3                | 1858.3              | 17.5             | 16 / 10 / 16                |
| 500     | 9.6                | 733.5               | 42.4             | 16 / 4 / 16                 |
| 1000    | 24.4               | 1638.0              | 108.4            | 16 / 2 / 16                 |

## Interpretation

Frame gap p95 measures main-thread scheduling. It does not measure GPU presentation or paint.
NumberFlow reached the sampling limit at larger counts. Its partial points contain fewer observations. The chart and raw data retain these limits.
Digitloom and CountUp are tied at 100 counters in the dense-grid check. Digitloom has lower frame gap p95 at larger counts on this host.
These observations do not establish a universal ranking or a guarantee for another application or device.

## Runtime and checks

Digitloom 1.0.5 JavaScript and CSS total 5,120 bytes gzip (5.00 KiB). The enforced ceiling is 5 KiB. React, types, source maps, documentation, and the demo are excluded.
The release passed formatting, lint, TypeScript, 59 tests, package-size checks, and standalone builds. The runtime dependency audit found no vulnerabilities.
The original comparison release checked Chrome zoom at 200%. Its visible canvas rebuilt at four pixels per CSS pixel. The final hero digit remained visible.
Version 1.0.5 verified delayed clocks, currency changes, and CSS sizing regressions. Browser zoom is not yet rechecked for this patch.
A new three-library capture stopped responding during a heavy sample. The website retains the historical capture instead of incomplete measurements.
Other browser engines and real mobile devices have not been visually verified.

Version 1.0.5 runtime SHA-256:

`9ce37ab304d3e54e645703ad9b37b96ecfd127b688b7a52d5951d6c984e86a31`

## 1.0.5 regression check

The minified runtime ran against the wallet's published 1.0.4 runtime in two rounds with reversed order.
Each visible grid used 40 columns, a 1,100 px width, 10 px text, and 14 px line height.
Each round used a warmup and eight updates with 350 ms linear motion, scheduled every 100 ms.
The final update settled for 400 ms. Host activity was not isolated.

| Counters | 1.0.4 frame p95, rounds 1 / 2 (ms) | 1.0.5 frame p95, rounds 1 / 2 (ms) | 1.0.4 update p95, rounds 1 / 2 (ms) | 1.0.5 update p95, rounds 1 / 2 (ms) |
| -------- | ---------------------------------- | ---------------------------------- | ----------------------------------- | ----------------------------------- |
| 100      | 10.0 / 10.1                        | 9.9 / 9.9                          | 6.5 / 3.8                           | 7.6 / 11.2                          |
| 250      | 10.1 / 10.1                        | 10.0 / 10.2                        | 21.1 / 20.3                         | 8.5 / 26.0                          |
| 500      | 16.9 / 16.4                        | 15.1 / 16.4                        | 35.5 / 47.4                         | 16.5 / 26.7                         |
| 1000     | 58.0 / 58.5                        | 56.6 / 49.9                        | 80.2 / 50.4                         | 73.7 / 48.6                         |

Update p95 includes the React flush and controller microtask batch. Frame p95 measures requestAnimationFrame scheduling, not GPU presentation.
The 1,000-counter workload exceeds the 60 Hz frame budget in both versions. These results do not establish a universal improvement.
This regression check is separate from the historical three-library website capture.

## 1.0.6 settled text check

Version 1.0.6 restores native browser text after all digit phases finish. The shared canvas clears before the final frame.
Completed counters retain layout history for later currency updates. They release roll references and shared clocks.

The runtime totals 5,119 bytes gzip. The strict ceiling remains 5,120 bytes.
All 63 tests, lint, TypeScript checks, runtime build, and demo build passed before the version update.
Browser checks used loaded General Sans Medium, the wallet spring, an 825 ms duration, and repeated USD and TAO switches.
At rest, native text retained its font size and color. The canvas contained no glyph pixels.
The 1,000-counter regression verifies shared clock cleanup and native final text. It does not measure frame timing.

The 200% CSS zoom check covers visible small samples. Larger samples were outside the viewport.
Native browser zoom and live extension acceptance remain unverified. No new speed comparison is claimed for this patch.
