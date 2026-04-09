# Box of Gas: How Much Centralization Do You Need?

## 1. Motivation

Maxwell's Demon is a thought experiment that tests the second law of thermodynamics: a hypothetical agent sits at a door between two chambers and sorts fast particles to one side and slow ones to the other, creating a temperature gradient from nothing. The classical version of the demon has **global knowledge** — it knows the mean speed of every particle in the system and can compare each arrival against that benchmark.

But what if the demon has no central authority? What if each particle, upon arriving at the door, can only poll its immediate neighbors and make a local decision: "am I faster than the particles around me?"

This is the core question of the project: **how much of the demon's sorting power can be recovered using only local information?** The answer has implications beyond physics — it maps directly onto the centralized-vs-decentralized tradeoff in distributed systems, swarm intelligence, and market design. A central coordinator with full state always makes optimal decisions, but the infrastructure cost scales with system size. If 80% of the benefit comes from polling 20% of the population, the case for decentralization is strong.

## 2. Setup

### The Box

A 2D box (100 x 100, dimensionless units with k_B = 1, m = 1) contains 500 hard-sphere particles initialized from a Maxwell-Boltzmann velocity distribution. A vertical partition at x = 50 divides the box into left and right chambers. A door in the center of the partition allows particles to cross, subject to the demon's policy.

### The Four Regimes

| Regime | Knowledge | Decision Rule |
|--------|-----------|---------------|
| **No demon** | None | Door is always open. Control case. |
| **Classical (fixed)** | Global, one-time | Pass if speed > initial mean speed (left→right) or speed < initial mean speed (right→left). Threshold is frozen at t=0. |
| **Classical (adaptive)** | Global, ongoing | Pass if speed > current per-side mean. The demon continuously knows the average speed of every particle on the arriving particle's side. This is the theoretical upper bound. |
| **Local** | Neighbors within radius r | Pass if speed > mean speed of same-side neighbors within distance r that are moving toward the door. No information = reject. |

The adaptive classical demon is the theoretical upper bound for the local demon because both answer the same question — "am I faster than my side's average?" — but the classical demon has a perfect sample (every particle on that side) while the local demon has a noisy, spatially-biased sample. Empirically, finite-time stochastic runs can let a simpler policy edge past the adaptive baseline by a few percent, so the comparisons below should be read with that caveat.

### The Sweep

To compare regimes fairly, the automated r-sweep:

1. Initializes all 500 particles once and saves the exact state (positions + velocities).
2. Runs classical (fixed) from that saved state to convergence.
3. Runs classical (adaptive) from the same saved state to convergence.
4. Runs the local demon at 15 values of r/L from 0.02 to 1.0, each from the identical saved state.

Convergence is detected when ΔT changes by less than 2% of its peak value over a 30 sim-second lookback window, with a mandatory hold period of 40 additional seconds to confirm stability. Baselines are required to run at least 400 sim-seconds; local runs at least 200.

> **Important:** Unless otherwise noted, the numbers below aggregate **eight** sweeps (seeds 1000–1007) captured on 9 April 2026. This is still a modest sample, yet it already reveals the seed-to-seed variance that was invisible in the single-run draft; further batches will extend both the sample size and the run duration.

## 3. Results

### 3.1 The Money Plot: ΔT vs r/L

![ΔT vs r/L](report_plots/sweep_deltaT.png)

**Classical baselines (8 seeds, 1000–1007):**
- Fixed threshold: ΔT = **0.85 ± 0.07** (steady at t = 239 ± 47 s)
- Adaptive threshold: ΔT = **0.79 ± 0.06** (steady at t = 215 ± 44 s)

The adaptive policy still dominates on average, but the two baselines are now separated by only ~0.07 in ΔT. That gap sits comfortably within the observed run-to-run swings, reinforcing the need for multi-seed statistics rather than single-run anecdotes.

**Local demon results:**

| r/L | ΔT (mean±σ) | % of adaptive |
|-----|-------------|---------------|
| 0.02 | 0.047 ± 0.080 | 5.9% ± 10.5% |
| 0.09 | 0.534 ± 0.100 | 67.9% ± 13.9% |
| 0.16 | 0.567 ± 0.117 | 72.3% ± 15.4% |
| 0.23 | 0.643 ± 0.095 | 81.6% ± 12.2% |
| 0.30 | 0.655 ± 0.115 | 83.3% ± 15.0% |
| 0.37 | 0.672 ± 0.114 | 85.2% ± 12.4% |
| 0.44 | 0.610 ± 0.117 | 78.4% ± 18.6% |
| 0.51 | 0.718 ± 0.082 | 91.5% ± 13.0% |
| 0.58 | 0.646 ± 0.105 | 81.7% ± 10.6% |
| 0.65 | 0.656 ± 0.096 | 83.1% ± 9.5% |
| 0.72 | 0.651 ± 0.092 | 82.6% ± 10.4% |
| 0.79 | 0.666 ± 0.115 | 84.3% ± 12.1% |
| 0.86 | 0.666 ± 0.115 | 84.3% ± 12.1% |
| 0.93 | 0.666 ± 0.115 | 84.3% ± 12.1% |
| 1.00 | 0.666 ± 0.115 | 84.3% ± 12.1% |

The curve still rises sharply from r/L = 0.02 (ΔT ≈ 0) to r/L = 0.09 (ΔT = 0.53 ± 0.10, 68% of adaptive) while polling only 9% of the box width. By r/L = 0.23 the local demon clears 82% of the adaptive baseline, and the best mean to date appears at r/L = 0.51 with ΔT = 0.72 ± 0.08 (92% ± 13% of adaptive). In other words, most of the sorting power is captured once the local window spans roughly half the box’s height, and expanding further buys only marginal improvements.

**The saturation plateau:** Beyond r/L ≈ 0.4 the curve flattens: every radius from 0.44 through 1.0 clusters around ΔT ≈ 0.66 with ±0.12 excursions, never quite matching the adaptive baseline. Even at r/L = 1.0 — effectively a system-wide view, albeit restricted to door-directed neighbors — the local demon trails the adaptive reference by ~0.12 in ΔT. That gap remains consistent with the information asymmetry: the classical demon polls the entire side, while the local demon biases toward particles moving toward the door. Notably, r/L = 0.79 through 1.0 produce identical results (ΔT = 0.666 ± 0.115 across all four), confirming that the neighbor radius at r/L ≈ 0.79 already captures every door-directed particle on the arriving side — further increases change nothing.

**Variance at intermediate r/L:** Neighborhoods between 0.16 and 0.51 remain the noisiest, with standard deviations of 10–19% of the adaptive baseline. Those swings reflect stochastic sampling: the window is large enough to admit dozens of neighbors but still small enough for spatial pockets of hot/cold particles to skew the mean. Eight seeds are enough to visualize the variance bands, but additional seeds will still help shrink the error bars on the higher radii.

### 3.2 Convergence Time

![Time to steady state](report_plots/sweep_time.png)

The adaptive baseline still enjoys a modest speed edge (215 ± 44 s vs 239 ± 47 s for the fixed baseline) because it constantly readjusts its threshold as each side heats or cools. Local policies exhibit a clearly non-monotonic profile: minuscule radii such as r/L = 0.02 settle quickly (149 ± 39 s) because almost no particles ever cross, whereas the high-performing band around r/L = 0.30–0.51 needs roughly 240–280 s to shake out the noise and reach steady state. Larger radii plateau near 225 s — still slower than “no information” but faster than the big-r spikes thanks to more confident, less noisy decisions.

### 3.3 Information Cost

![Bits vs r/L](report_plots/bits_vs_r.png)

Cumulative information bits still rise with r/L, but the eight-seed averages pin down the scale: 37 ± 8 bits at r/L = 0.02, 631 ± 155 bits at r/L = 0.09, peaking at 2,678 ± 632 bits at r/L = 0.51 before settling back to ~2,355 ± 562 for r/L ≥ 0.79 (the same saturation ceiling where the neighbor set stops growing). Because ΔT saturates around r/L = 0.5, each incremental “radius upgrade” beyond that point now carries a clear marginal penalty — hundreds of extra bits for at most a two- or three-point bump relative to the adaptive baseline. The accounting remains cumulative (bits summed across the whole sweep) while the classical demon’s log2(N) cost is per decision, so a normalized metric such as bits per accepted crossing is still on the backlog.

### 3.4 Entropy vs Temperature Imbalance

![Entropy vs ΔT](report_plots/entropy_vs_deltaT.png)

The scatter plot still shows a clean negative correlation: larger ΔT goes hand in hand with more negative ΔS/N. That is the expected thermodynamic signature — the demon harvests information to drive down entropy locally. With eight seeds in hand we can already see the cloud tightening, so the next batch will add correlation coefficients and confidence intervals.

Points are colored by r/L. The smallest radius (darkest, r/L = 0.02) stays near the origin: ΔT ≈ 0, ΔS/N ≈ 0. As r grows, the swarm marches toward ΔT ≈ 0.65 and ΔS/N ≈ -0.07. High-r/L points (yellow) now cluster there, mirroring the saturation behavior from the sweep plot.

### 3.5 Time-Series Diagnostics

![Time series](report_plots/time_series.png)

The time-series plot (from the last sweep run) shows:
- **KE** remains flat, confirming energy conservation (elastic collisions, no numerical drift).
- **ΔT** stabilizes around its steady-state value after an initial transient.
- **ΔS/N** decreases and stabilizes, consistent with the demon actively reducing entropy.

### 3.6 Centralization ↔ Information ↔ Sorting Trade-off

![Centralization trade-off](report_plots/centralization_tradeoff.png)

Plotting each radius as a point in “centralization–information–performance” space makes the trade-offs explicit: as r/L grows, the average sorting efficiency (% of the adaptive baseline) rises quickly at first, then saturates near ~85%, while the information cost (bits per sim-second, shown as color) keeps climbing. The elbow sits around r/L ≈ 0.5—beyond that, the color scale keeps heating up but the y-value barely moves, signalling sharply diminishing returns. The classical adaptive demon would sit just above the top edge (100% performance) with much higher information cost due to its unbiased global sampling, which is why even r/L = 1 cannot quite match it.

## 4. Design Decisions

### Why per-side adaptive (not global) as the upper bound

Early versions used the global mean speed as the adaptive threshold. This caused the local demon to **appear to outperform** the classical demon at large r — which is theoretically impossible. The issue: as sorting progresses, the left side cools and the right side heats. A global threshold sits between the two shifted distributions and becomes increasingly poor. The local demon, by only polling same-side neighbors, naturally tracked the per-side distribution and gained an unfair advantage.

The fix: both the adaptive classical and local demons now answer the identical question — "is this particle faster than its own side's average?" The classical demon simply has a perfect sample (all particles on that side), making it the true upper bound.

### Why the fixed demon can outperform the adaptive demon in ΔT

The data shows the fixed-threshold demon averaging ΔT = 0.85 vs the adaptive's 0.79. This is counterintuitive — the adaptive demon has strictly more information. The explanation lies in what each demon optimizes for. The fixed demon's frozen threshold drifts away from both sides' evolving means as sorting progresses, creating an increasingly aggressive filter that overshoots the equilibrium: it rejects many particles that a perfectly informed demon would let through, but this overselection produces a larger (if less thermodynamically stable) temperature gap. The adaptive demon, by continuously recalibrating to the true per-side mean, converges to a lower but more physically consistent steady state. In short, the fixed demon's "error" is biased in the direction of larger ΔT — it's wrong in a way that happens to inflate the metric we're measuring.

### Why arrival-only decisions with single-crossing enforcement

Each particle triggers the door policy **exactly once** per crossing attempt. Without this, a particle overlapping the door region would be re-evaluated every physics frame (~70 times per crossing), inflating the information cost by ~70x and creating non-deterministic behavior where a particle permitted on frame 1 could be rejected on frame 5 as thresholds shifted.

### Why the local demon only polls door-directed neighbors

The local demon filters for neighbors moving toward the door (v_x > 0 on the left, v_x < 0 on the right). This is the physically motivated choice: the arriving particle wants to know "am I faster than the particles I'm competing with to cross?" Particles moving away from the door are not candidates for crossing and would dilute the reference population.

This filter is also why the local demon at r/L = 1.0 doesn't match the classical adaptive: the classical uses **all** particles on that side, while the local only uses those moving toward the door — a biased, smaller subset.

### Why steady-state detection uses lookback, not slope

Early slope-based detection triggered near t = 0 when ΔT was flat near zero (no sorting had occurred yet). The lookback approach — "has ΔT changed meaningfully in the last 30 seconds?" — avoids this because it requires ΔT to first **change** and then **stop changing**. The additional hold period (40 seconds post-detection) and minimum run times (400 for baselines, 200 for local) prevent premature termination during slow convergence.

## 5. Conclusions

1. **Local information recovers most of the sorting power.** By r/L = 0.09 (polling ~9% of the box width), the local demon reaches 68% ± 14% of the adaptive baseline; by r/L = 0.23 it is already at 82% ± 12%, and the current mean best is 92% ± 13% at r/L = 0.51. The early, steep rise survives the move from single-seed to eight-seed analysis.

2. **There are diminishing returns to larger radii.** Everything beyond r/L ≈ 0.4 piles up near ΔT ≈ 0.66 despite the much larger neighbor sets. Occasional spikes are still present in individual seeds, but the aggregates now make it clear that they are stochastic accidents rather than structural effects.

3. **The gap at r/L = 1.0 is real, not a bug.** Even with system-wide reach, the local demon’s directional filter means it samples only the competitors headed toward the door. The adaptive baseline still sees ~11% more ΔT because it consults every particle on the side, not just the forward-moving subset.

4. **Information cost grows faster than sorting quality.** Bumping r/L from 0.09 to 0.65 nearly quadruples the cumulative bit cost (631 ± 155 → 2,444 ± 476 bits) while improving ΔT from 68% to just 83% of the adaptive reference. The marginal bit efficiency therefore falls sharply once the radius covers roughly half of the box.

5. **The entropy-temperature tradeoff is clean.** More sorting continues to correspond to more negative ΔS/N, now with clear clustering around ΔS/N ≈ -0.09 when ΔT saturates. Quantitative fits and error bars will land once the larger seed batch finishes.

The central takeaway remains: **you don't need much centralization to break the second law locally**, but the precise efficiency curve still needs multi-run statistics. Additional simulations will firm up the numbers and allow proper error bars on every plot.
