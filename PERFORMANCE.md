# Performance check

The demo contains one release check with dense grids and balance lists. Download the raw observations from the chart.

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

JavaScript and CSS total 5,027 bytes gzip (4.91 KiB). The enforced ceiling is 5 KiB. React, types, source maps, documentation, and the demo are excluded.
The release passed formatting, lint, TypeScript, 27 unit tests, package-size checks, and standalone builds. The runtime dependency audit found no vulnerabilities.
Chrome zoom was checked at 200%. The visible canvas rebuilt at four pixels per CSS pixel. The final hero digit remained visible.
Other browser engines and real mobile devices have not been visually verified.

Measured runtime SHA-256:

`2a67a3e758dad8ceb729cc5d5b97cf572dafbc8a8634d175933faa0ee48e0bbe`
