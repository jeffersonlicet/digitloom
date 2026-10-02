# Performance

The website chart uses the latest complete comparison capture in `demo/scaling-baseline.json`.

It compares Digitloom 1.0.6+local, NumberFlow 0.6.2, and React CountUp 6.5.3 in Chrome 154. Each workload uses two rounds with reversed library order and eight measured updates per sample. Dense-grid counters fit in a 1600 × 1200 CSS pixel viewport at DPR 2. Balance-list samples use a 400 × 600 viewport at DPR 2 and scroll during updates.

The chart reports frame-gap p95. It measures requestAnimationFrame scheduling, not GPU presentation or paint. Results depend on the browser, device, and host load. The benchmark does not run inside the wallet extension popup or use its full row component.

| Workload     | Counters | Digitloom |  NumberFlow | React CountUp |
| ------------ | -------: | --------: | ----------: | ------------: |
| Dense grid   |      100 |   16.7 ms |    100.1 ms |       16.7 ms |
| Dense grid   |      250 |   16.7 ms |  1,216.6 ms |       16.7 ms |
| Dense grid   |      500 |   16.8 ms |  3,666.5 ms |       16.7 ms |
| Dense grid   |    1,000 |   16.8 ms | 16,099.4 ms |       16.7 ms |
| Balance list |      100 |   16.8 ms |    100.0 ms |       16.7 ms |
| Balance list |      250 |   16.8 ms |  1,166.6 ms |       16.7 ms |
| Balance list |      500 |   16.7 ms |  3,866.5 ms |       16.8 ms |
| Balance list |    1,000 |   16.7 ms | 17,066.1 ms |       16.7 ms |

Digitloom 1.0.7 runtime totals 5,831 bytes gzip: 5,556 bytes of JavaScript and 275 bytes of CSS. The enforced limit is 6 KiB. React, types, source maps, documentation, and the demo are excluded. Version 1.0.7 makes no new benchmark claim.
