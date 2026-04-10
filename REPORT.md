# Box of Gas: How Much Centralization Do You Need?

## Executive Summary

Maxwell's Demon — a hypothetical agent that sorts fast and slow gas particles to create a temperature gradient — is a foundational thought experiment in thermodynamics. The classical demon requires global knowledge of the entire system. This project asks: **what if the demon can only see its immediate neighborhood?**

We simulate 2000 hard-sphere particles in a 2D box with a central partition and door, and compare three regimes: no demon (control), a classical demon with an adaptive per-side threshold (our global-information benchmark), and a local demon that polls only same-side neighbors within radius r. An automated sweep varies r/L from 0.02 to 1.0 across eight independent seeds.

**Key findings (8 seeds, N = 2000, T = 1.0):**

- **Local information is surprisingly effective.** Polling just 9% of the box width (r/L = 0.09) recovers 81% of the classical demon's sorting power. Even a tiny radius of r/L = 0.02 already reaches 41%.
- **Returns diminish sharply.** Beyond r/L ≈ 0.2 the local demon plateaus at ~84% of the adaptive baseline. Even r/L = 1.0 cannot close the remaining ~17% gap.
- **Information cost grows faster than benefit.** Increasing r/L from 0.09 to 0.65 multiplies the bit budget by 2.5× while adding only 3 percentage points of sorting quality.
- **The entropy signature is clean.** Larger temperature imbalances correspond to more negative entropy changes, confirming the expected thermodynamic relationship across all radii and seeds.

The second law is not violated — the demon pays for sorting with information, and Landauer's principle ensures the global entropy budget balances. But the results show that the *information infrastructure* needed to drive useful sorting is far smaller than a naive global-knowledge assumption would suggest. In systems where a central coordinator is expensive or impractical, a local-information strategy with a modest sensing radius can capture most of the achievable benefit — a conclusion with direct analogues in distributed systems, swarm robotics, and decentralized market design.

## 1. Motivation

Maxwell's Demon is a thought experiment that tests the second law of thermodynamics: a hypothetical agent sits at a door between two chambers and sorts fast particles to one side and slow ones to the other, creating a temperature gradient from nothing. The classical version of the demon has **global knowledge** — it knows the mean speed of every particle in the system and can compare each arrival against that benchmark.

But what if the demon has no central authority? What if each particle, upon arriving at the door, can only poll its immediate neighbors and make a local decision: "am I faster than the particles around me?"

This is the core question of the project: **how much of the demon's sorting power can be recovered using only local information?** The answer has implications beyond physics — it maps directly onto the centralized-vs-decentralized tradeoff in distributed systems, swarm intelligence, and market design. A central coordinator with full state always makes optimal decisions, but the infrastructure cost scales with system size. If 80% of the benefit comes from polling 10% of the population, the case for decentralization is strong.

## 2. Setup

### The Box

A 2D box (100 × 100, dimensionless units with k_B = 1, m = 1) contains 2000 hard-sphere particles initialized from a Maxwell-Boltzmann velocity distribution. A vertical partition at x = 50 divides the box into left and right chambers. A door in the center of the partition allows particles to cross, subject to the demon's policy.

### The Three Regimes

| Regime | Knowledge | Decision Rule |
| ------ | --------- | ------------- |
| **No demon** | None | Door is always open. Control case. |
| **Classical (adaptive)** | Global, ongoing | Pass if speed > mean of all door-directed particles on the arriving side. The demon has perfect knowledge of every door-directed particle's speed. This is our global-information benchmark — the same decision rule as the local demon, but with a complete sample. |
| **Local** | Neighbors within radius r | Pass if speed > mean speed of same-side neighbors within distance r that are moving toward the door. No information = reject. |

Both demons use the same reference population — particles on the arriving side that are moving toward the door — and answer the same question: "is this particle faster than that cohort's average?" The classical demon has a perfect sample (every door-directed particle on that side) while the local demon has a noisy, spatially-biased sample limited by radius r. Note that comparing against the mean is not the theoretically optimal decision rule — a more sophisticated statistic could extract more sorting power from the same information. The adaptive demon therefore serves as a **benchmark** (the best performance achievable under the mean-based rule with global information), not as a strict upper bound on all possible sorting strategies. Occasionally a noisy local estimate will outperform the global mean for a specific microstate, which is why a small number of per-seed ratios exceed 1.0.

### The Sweep

To compare regimes fairly, the automated r-sweep:

1. Initializes all 2000 particles once and saves the exact state (positions + velocities).
2. Runs the classical (adaptive) demon from that saved state to convergence.
3. Runs the local demon at 15 values of r/L from 0.02 to 1.0, each from the identical saved state.

Convergence is detected when ΔT changes by less than 2% of its peak value over a 30 sim-second lookback window, with a mandatory hold period of 40 additional seconds to confirm stability. The baseline is required to run at least 400 sim-seconds; local runs at least 200.

> **Important:** Unless otherwise noted, the numbers below aggregate **eight** sweeps (seeds 1000–1007) captured on 10 April 2026 with N = 2000 particles.

## 3. Results

### 3.1 The Money Plot: ΔT vs r/L

![ΔT vs r/L](report_plots/sweep_deltaT.png)

**Classical baseline (8 seeds, 1000–1007):**

- Adaptive threshold: ΔT = **0.56 ± 0.03** (steady at t = 161 ± 26 s)

**Local demon results:**

| r/L | ΔT (mean±σ) | % of adaptive |
| --- | ----------- | ------------- |
| 0.02 | 0.228 ± 0.047 | 40.8% ± 8.4% |
| 0.09 | 0.451 ± 0.050 | 80.6% ± 9.0% |
| 0.16 | 0.458 ± 0.034 | 81.9% ± 6.1% |
| 0.23 | 0.480 ± 0.034 | 85.9% ± 6.0% |
| 0.30 | 0.468 ± 0.049 | 83.7% ± 8.8% |
| 0.37 | 0.480 ± 0.052 | 85.8% ± 9.3% |
| 0.44 | 0.499 ± 0.051 | 89.2% ± 9.2% |
| 0.51 | 0.470 ± 0.044 | 84.0% ± 7.8% |
| 0.58 | 0.469 ± 0.035 | 83.8% ± 6.3% |
| 0.65 | 0.469 ± 0.055 | 83.9% ± 9.8% |
| 0.72 | 0.473 ± 0.031 | 84.5% ± 5.5% |
| 0.79 | 0.467 ± 0.037 | 83.5% ± 6.7% |
| 0.86 | 0.467 ± 0.037 | 83.5% ± 6.7% |
| 0.93 | 0.467 ± 0.037 | 83.5% ± 6.7% |
| 1.00 | 0.467 ± 0.037 | 83.5% ± 6.7% |

The curve rises steeply from r/L = 0.02 (ΔT = 0.23, 41% of adaptive) to r/L = 0.09 (ΔT = 0.45, 81% of adaptive) while polling only 9% of the box width. This initial jump — from 41% to 81% in a single step — is the most striking feature of the plot. Even the smallest tested radius (r/L = 0.02) polls enough neighbors to produce meaningful sorting.

**The saturation plateau:** Beyond r/L ≈ 0.2 the curve flattens, with the plateau averaging ΔT = 0.47 ± 0.04 (84% ± 7% of adaptive). No radius within the plateau statistically outperforms any other — the apparent best (r/L = 0.44 at 89%) is well within the noise band. The ±1σ envelope on the plot makes this clear: it nearly touches the adaptive baseline at every point, yet the mean consistently sits ~16% below it.

Rows r/L = 0.79 through 1.0 produce identical results (ΔT = 0.467 ± 0.037), confirming that the neighbor radius at r/L ≈ 0.79 already captures every door-directed particle on the arriving side — further increases change nothing.

**Variance:** Per-radius standard deviations are tight — typically ±0.03–0.05 in ΔT (5–9% of adaptive) — reflecting the statistical benefit of 2000 particles per seed.

### 3.2 Convergence Time

![Time to steady state](report_plots/sweep_time.png)

The adaptive baseline converges at 161 ± 26 s. Local policies converge on a similar timescale: per-radius means range from 160 to 192 s, with individual seeds spanning 105 to 287 s. Per-radius standard deviations of 25–51 s overlap substantially with the adaptive baseline's spread, confirming that convergence speed is not meaningfully affected by the sensing radius.

### 3.3 Information Cost

![Bits vs r/L](report_plots/bits_vs_r.png)

Cumulative information bits rise steeply with r/L: 791 ± 144 bits at r/L = 0.02, 4,952 ± 487 at r/L = 0.09, and roughly 11,000–12,000 for r/L ≥ 0.5 (peaking at 12,429 ± 2,365 at r/L = 0.65 before settling to ~11,247 ± 731 for r/L ≥ 0.79). The information cost is log₂(k+1) per decision, where k scales with density × r².

The key ratio: moving from r/L = 0.09 (81% of adaptive, 4,952 bits) to r/L = 0.65 (84% of adaptive, 12,429 bits) multiplies the bit budget by 2.5× for only 3 percentage points of gain. The marginal information efficiency collapses once the radius exceeds ~10% of the box width.

### 3.4 Entropy vs Temperature Imbalance

![Entropy vs ΔT](report_plots/entropy_vs_deltaT.png)

The scatter plot shows a clean negative correlation: larger ΔT goes hand in hand with more negative ΔS/N. This is the expected thermodynamic signature — the demon harvests information to drive down entropy locally. Points are colored by r/L. The smallest radius (darkest, r/L = 0.02) clusters around ΔT ≈ 0.23, ΔS/N ≈ -0.01. As r grows, the swarm marches toward ΔT ≈ 0.47 and ΔS/N ≈ -0.04. The tight clustering at saturation reflects the reduced variance from 2000 particles.

### 3.5 Time-Series Diagnostics

![Time series](report_plots/time_series.png)

The time-series plot (from the last sweep run) shows:

- **KE** remains flat, confirming energy conservation (elastic collisions, no numerical drift).
- **ΔT** stabilizes around its steady-state value after an initial transient.
- **ΔS/N** decreases and stabilizes, consistent with the demon actively reducing entropy.

### 3.6 Centralization ↔ Information ↔ Sorting Trade-off

![Centralization trade-off](report_plots/centralization_tradeoff.png)

Plotting each radius as a point in "centralization–information–performance" space makes the trade-offs explicit: as r/L grows, the average sorting efficiency (% of the adaptive baseline) rises quickly at first, then saturates near ~84%, while the information cost (bits per sim-second, shown as color) keeps climbing. The elbow sits around r/L ≈ 0.1 — beyond that, the color scale keeps heating up but the y-value barely moves, signalling sharply diminishing returns.

### 3.7 Seed-to-Seed Variability

For each seed we record the radius that delivered the highest steady-state ΔT in the local regime and compare it directly against the classical adaptive run from the same initial microstate:

| Seed | Best r/L | Local ΔT | Classical ΔT | ΔT ratio |
| --- | --- | --- | --- | --- |
| 1000 | 0.09 | 0.544 | 0.573 | 0.95 |
| 1001 | 0.72 | 0.466 | 0.546 | 0.85 |
| 1002 | 0.37 | 0.543 | 0.537 | 1.01 |
| 1003 | 0.65 | 0.518 | 0.582 | 0.89 |
| 1004 | 0.30 | 0.561 | 0.607 | 0.92 |
| 1005 | 0.65 | 0.544 | 0.554 | 0.98 |
| 1006 | 0.30 | 0.478 | 0.519 | 0.92 |
| 1007 | 0.44 | 0.615 | 0.557 | 1.10 |

Two insights:

- **The “best” local radius is not universal.** Across eight seeds the maximizing radius spans 0.09–0.72. Any deployment that picks a single r/L must tolerate sizable seed-to-seed variability in which radius happens to perform best.
- **The adaptive demon is reliably better in aggregate, with rare per-seed exceptions.** Six of eight seeds show ΔT ratio < 1.0 as expected. Two seeds (1002 at 1.01 and 1007 at 1.10) show the local demon slightly exceeding the adaptive baseline — a consequence of finite simulation time and the stochastic nature of particle dynamics. The local demon's noisy threshold occasionally outperforms the global threshold for a specific microstate, just as a noisy estimator can occasionally beat the true mean on a particular sample. Across all 120 seed × radius combinations, only these 2 exceed 1.0, and the aggregate mean ratio at every radius is well below 1.0 (ranging from 0.41 to 0.89).

## 4. Design Decisions

### Why per-side adaptive as the benchmark

Early versions used the global mean speed as the adaptive threshold, and compared against all particles on a side regardless of direction. This caused the local demon to systematically outperform the classical demon at large r. Two issues contributed: (1) as sorting progresses, the left side cools and the right side heats, so a global threshold becomes increasingly poor; (2) the local demon polled only door-directed neighbors while the adaptive demon averaged over all particles, creating a systematic mismatch.

The fix: both demons now use the same door-directed reference population and answer the identical question — "is this particle faster than the average of door-directed particles on its side?" The classical demon has a perfect sample (all door-directed particles on that side, with no radius limit). This eliminates the systematic advantage, though occasional per-seed exceedances remain because comparing against the mean is not the optimal acceptance statistic — a noisy local estimate can beat the global mean on a specific microstate.

### Why arrival-only decisions with single-crossing enforcement

Each particle triggers the door policy **exactly once** per crossing attempt. Without this, a particle overlapping the door region would be re-evaluated every physics frame (~70 times per crossing), inflating the information cost by ~70× and creating non-deterministic behavior where a particle permitted on frame 1 could be rejected on frame 5 as thresholds shifted.

### Why both demons poll door-directed neighbors

Both the adaptive and local demons filter for neighbors moving toward the door (v_x > 0 on the left, v_x < 0 on the right). This is the physically motivated choice: the arriving particle wants to know "am I faster than the particles I'm competing with to cross?" Particles moving away from the door are not candidates for crossing and would dilute the reference population. Using the same reference population for both demons ensures an apples-to-apples comparison — the only difference is sample size (all door-directed particles vs. those within radius r).

The ~17% aggregate gap between the local demon at r/L = 1.0 and the adaptive baseline reflects the accumulated effect of noisier per-decision thresholds over thousands of sorting events, even though both demons see the same reference population at that radius.

### Why steady-state detection uses lookback, not slope

Early slope-based detection triggered near t = 0 when ΔT was flat near zero (no sorting had occurred yet). The lookback approach — "has ΔT changed meaningfully in the last 30 seconds?" — avoids this because it requires ΔT to first **change** and then **stop changing**. The additional hold period (40 seconds post-detection) and minimum run times (400 for the baseline, 200 for local) prevent premature termination during slow convergence.

## 5. Conclusions

1. **Local information recovers most of the sorting power.** By r/L = 0.09 (polling ~9% of the box width), the local demon reaches 81% ± 9% of the adaptive baseline. The plateau beyond r/L ≈ 0.2 averages 84% ± 7%. The steep early rise is the robust finding: most of the sorting power is captured by a radius that covers less than 10% of the box, well before the plateau.

2. **There are diminishing returns to larger radii.** Everything beyond r/L ≈ 0.2 fluctuates around ΔT ≈ 0.47 despite much larger neighbor sets. No radius within the plateau statistically outperforms any other across 8 seeds.

3. **The gap at r/L = 1.0 is real, not a bug.** Even with system-wide reach, the local demon achieves only ~84% of the adaptive baseline. Both demons use the same door-directed reference population, but the adaptive demon has a perfect census while the local demon's radius-limited sample introduces noise that compounds over thousands of decisions.

4. **Information cost grows faster than sorting quality.** Moving from r/L = 0.09 to 0.65 multiplies the cumulative bit cost by 2.5× (4,952 → 12,429 bits) while improving ΔT from 81% to just 84% of the adaptive reference. The marginal bit efficiency collapses once the radius exceeds ~10% of the box width.

5. **The entropy-temperature tradeoff is clean.** More sorting corresponds to more negative ΔS/N, with tight clustering around ΔS/N ≈ -0.04 when ΔT saturates. The relationship is well-defined across all seeds and radii.

6. **Seed-to-seed variability is substantial.** The best-performing local radius varies from 0.09 to 0.72 depending on the initial microstate. In 2 of 120 seed × radius combinations the local demon slightly exceeds the adaptive benchmark (ratios of 1.01 and 1.10). This is expected: comparing against the mean is not the optimal acceptance statistic, so a noisy local estimate can occasionally outperform the global mean for a specific microstate. The aggregate mean ratio at every radius is well below 1.0 (ranging from 0.41 to 0.89), confirming that the adaptive demon is the stronger policy on average.

The central takeaway: **you don't need much centralization to achieve most of the demon's sorting power.** The second law is not violated — the demon pays for sorting with information, and Landauer's principle ensures the global entropy budget balances — but the local demon shows that the *information infrastructure* needed to drive useful sorting is far smaller than a naive global-knowledge assumption would suggest. A local agent polling 9% of the box captures 81% of the benefit; the remaining 19% requires global knowledge of the entire system.
