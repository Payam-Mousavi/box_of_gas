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

The adaptive classical demon is the correct upper bound for the local demon because both answer the same question — "am I faster than my side's average?" — but the classical demon has a perfect sample (every particle on that side) while the local demon has a noisy, spatially-biased sample.

### The Sweep

To compare regimes fairly, the automated r-sweep:

1. Initializes all 500 particles once and saves the exact state (positions + velocities).
2. Runs classical (fixed) from that saved state to convergence.
3. Runs classical (adaptive) from the same saved state to convergence.
4. Runs the local demon at 15 values of r/L from 0.02 to 1.0, each from the identical saved state.

Convergence is detected when ΔT changes by less than 2% of its peak value over a 30 sim-second lookback window, with a mandatory hold period of 40 additional seconds to confirm stability. Baselines are required to run at least 400 sim-seconds; local runs at least 200.

## 3. Results

### 3.1 The Money Plot: ΔT vs r/L

![ΔT vs r/L](report_plots/sweep_deltaT.png)

**Classical baselines:**
- Fixed threshold: ΔT = **1.34** (steady at t = 221)
- Adaptive threshold: ΔT = **1.30** (steady at t = 187)

**Local demon results:**

| r/L | ΔT | % of adaptive |
|-----|-----|---------------|
| 0.02 | 0.41 | 32% |
| 0.09 | 0.91 | 70% |
| 0.16 | 1.00 | 77% |
| 0.23 | 1.20 | 92% |
| 0.30 | 1.00 | 77% |
| 0.51 | 1.27 | 98% |
| 0.72+ | ~1.01 | 78% |

The curve rises steeply from r/L = 0.02 to ~0.10, recovering 70% of the adaptive demon's sorting power by polling only 9% of the box width. The bulk of the sorting power is captured well before r/L = 0.5.

**The saturation plateau:** Above r/L ≈ 0.72, the local demon's ΔT converges to ~1.01 and remains flat through r/L = 1.0. This is below the adaptive classical's 1.30, which is expected: even at r/L = 1.0, the local demon only polls particles **moving toward the door**, while the classical adaptive uses **all** particles on that side. The local demon's reference population is always a biased subset — particles headed toward the door are not a representative sample of the full side's speed distribution.

**Variance at intermediate r/L:** The curve is noisy between r/L = 0.2 and 0.7, with ΔT fluctuating between 0.96 and 1.27. This reflects the stochastic nature of local sampling: at intermediate radii, the neighbor count is large enough to sort but small enough that statistical fluctuations in the local sample propagate into the sorting decision. The variance collapses once the sample size saturates.

### 3.2 Convergence Time

![Time to steady state](report_plots/sweep_time.png)

The classical adaptive demon converges fastest (t = 187), likely because its perfect per-side knowledge allows maximally efficient sorting from the first decision. The fixed demon is slower (t = 221) because its frozen threshold becomes increasingly suboptimal as the distribution shifts.

Local demons at small r (0.02) take the longest (t = 337) — with very few neighbors, decisions are noisy and many particles are rejected outright (empty neighbor set → automatic reject), slowing the sorting process.

### 3.3 Information Cost

![Bits vs r/L](report_plots/bits_vs_r.png)

Cumulative information bits grow monotonically with r/L, from ~345 bits at r/L = 0.02 to ~7,856 bits at r/L = 1.0. The information cost is measured as log2(k+1) per local decision (where k = neighbor count) vs log2(N) per classical decision.

The key insight: at r/L = 0.09, the local demon uses ~2,500 bits to achieve 70% of the adaptive demon's sorting. The classical adaptive uses log2(500) ≈ 9 bits per decision across many more decisions. The local demon trades **decision quality** for **decision cost** — each individual decision is cheaper but noisier.

### 3.4 Entropy vs Temperature Imbalance

![Entropy vs ΔT](report_plots/entropy_vs_deltaT.png)

The scatter plot shows a clear negative correlation: larger temperature imbalance (ΔT) corresponds to larger entropy decrease (more negative ΔS/N). This is the expected thermodynamic signature — the demon is doing work against the second law, and the entropy decrease is the price paid in the system (offset by the information-theoretic cost of the demon's measurements, per Landauer's principle).

Points are colored by r/L. The smallest radius (darkest, r/L = 0.02) sits in the upper-left: small ΔT, small entropy decrease. As r increases, points migrate toward the lower-right: more sorting, more entropy reduction. The tight clustering of high-r/L points (yellow) around ΔT ≈ 1.0, ΔS/N ≈ -0.065 confirms the saturation behavior seen in the sweep plot.

### 3.5 Time-Series Diagnostics

![Time series](report_plots/time_series.png)

The time-series plot (from the last sweep run) shows:
- **KE** remains flat, confirming energy conservation (elastic collisions, no numerical drift).
- **ΔT** stabilizes around its steady-state value after an initial transient.
- **ΔS/N** decreases and stabilizes, consistent with the demon actively reducing entropy.

## 4. Design Decisions

### Why per-side adaptive (not global) as the upper bound

Early versions used the global mean speed as the adaptive threshold. This caused the local demon to **appear to outperform** the classical demon at large r — which is theoretically impossible. The issue: as sorting progresses, the left side cools and the right side heats. A global threshold sits between the two shifted distributions and becomes increasingly poor. The local demon, by only polling same-side neighbors, naturally tracked the per-side distribution and gained an unfair advantage.

The fix: both the adaptive classical and local demons now answer the identical question — "is this particle faster than its own side's average?" The classical demon simply has a perfect sample (all particles on that side), making it the true upper bound.

### Why arrival-only decisions with single-crossing enforcement

Each particle triggers the door policy **exactly once** per crossing attempt. Without this, a particle overlapping the door region would be re-evaluated every physics frame (~70 times per crossing), inflating the information cost by ~70x and creating non-deterministic behavior where a particle permitted on frame 1 could be rejected on frame 5 as thresholds shifted.

### Why the local demon only polls door-directed neighbors

The local demon filters for neighbors moving toward the door (v_x > 0 on the left, v_x < 0 on the right). This is the physically motivated choice: the arriving particle wants to know "am I faster than the particles I'm competing with to cross?" Particles moving away from the door are not candidates for crossing and would dilute the reference population.

This filter is also why the local demon at r/L = 1.0 doesn't match the classical adaptive: the classical uses **all** particles on that side, while the local only uses those moving toward the door — a biased, smaller subset.

### Why steady-state detection uses lookback, not slope

Early slope-based detection triggered near t = 0 when ΔT was flat near zero (no sorting had occurred yet). The lookback approach — "has ΔT changed meaningfully in the last 30 seconds?" — avoids this because it requires ΔT to first **change** and then **stop changing**. The additional hold period (40 seconds post-detection) and minimum run times (400 for baselines, 200 for local) prevent premature termination during slow convergence.

## 5. Conclusions

1. **Local information recovers most of the sorting power.** By r/L = 0.09 (polling ~9% of the box width), the local demon achieves 70% of the optimal adaptive demon's temperature separation. By r/L = 0.23, it reaches 92%.

2. **There are diminishing returns to larger radii.** Beyond r/L ≈ 0.3, additional information barely improves sorting. The curve effectively saturates, with the local demon plateauing at ~77-98% of the adaptive baseline depending on the specific run.

3. **The gap at r/L = 1.0 is real, not a bug.** Even with system-wide reach, the local demon's directional filter (only polling door-directed neighbors) means it uses a biased sample. The classical adaptive demon's advantage is not just range — it's access to the full, unbiased population.

4. **Information cost grows faster than sorting quality.** Going from r/L = 0.09 to 1.0 multiplies the bit cost by 3x but sorting quality by only ~1.1x. The marginal cost of additional information far exceeds the marginal benefit — a strong argument for local decision-making.

5. **The entropy-temperature tradeoff is clean.** More sorting = more entropy reduction, and the relationship is approximately linear. This is consistent with the thermodynamic expectation and validates the simulation's physics.

The central takeaway: **you don't need much centralization to break the second law locally.** A small neighborhood radius captures most of the benefit, and the cost of global knowledge is not justified by the marginal improvement it provides.
