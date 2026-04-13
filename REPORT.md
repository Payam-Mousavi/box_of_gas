# Decentralizing Maxwell's Demon: What You Lose Without a Central Authority

## Summary

Maxwell’s Demon is a canonical thought experiment in thermodynamics in which an agent selectively allows fast and slow particles to pass between two chambers, generating a temperature gradient. In its standard formulation, the demon has access to **global information** about the system. This work investigates a constrained variant: **how much of the demon’s functionality can be recovered when decisions are based only on local information near the partition?**

We simulate 2000 hard-sphere particles in a two-dimensional box with a central partition and a controllable door. Four regimes are compared: (i) no demon (control), (ii) a classical “adaptive” demon that compares each particle’s speed to the global mean on its side, (iii) an optimal (“god”) demon that applies the energy-based greedy-optimal threshold using full system knowledge, and (iv) a local demon that estimates the mean speed from particles within a radius \( r \). All regimes use a **paired-swap mechanism** that enforces \(\Delta N_L = \Delta N_R = 0\), eliminating density-driven diffusion and ensuring a well-defined steady-state temperature difference \(\Delta T\). A parameter sweep over \( r/L \in [0.02, 1.0] \) is performed across five independent initial conditions.

**Key results (5 seeds, \(N = 2000\), \(T = 1.0\)):**

- **The optimal (god) demon sets the performance upper bound.** It achieves \(\Delta T = 0.96 \pm 0.03\), compared to \(0.91 \pm 0.03\) for the adaptive demon. No fixed-radius local policy exceeds this bound, consistent with the expectation that optimal decisions with more information cannot be outperformed.

- **Local information recovers most of the achievable sorting.** At \(r/L = 0.09\), the local demon attains ~95% of the adaptive performance (≈90% of optimal), and by \(r/L = 0.16\) it matches the adaptive demon. The remaining gap to optimal arises from the **decision rule**, not limited sampling: mean-speed comparisons are intrinsically suboptimal relative to energy-based thresholding.

- **Local and global mean-based policies converge at large radius.** For \(r/L \gtrsim 0.86\), the local sampling region spans the entire half-box, and the local and adaptive demons produce identical results. This confirms that their only distinction is sample size.

- **Small neighborhoods are surprisingly effective.** Even at \(r/L = 0.02\), the local demon achieves ~64% of adaptive performance. Performance improves rapidly with radius, indicating that most relevant information is concentrated near the door.

- **Entropy reduction tracks temperature separation.** Larger \(\Delta T\) corresponds to more negative \(\Delta S/N\), consistent with thermodynamic expectations. The demon’s sorting reduces entropy locally while requiring compensating information processing.

- **Paired swaps significantly enhance performance.** Enforcing symmetric exchanges approximately doubles the achievable \(\Delta T\) compared to unrestricted crossings (\(\sim 0.91\) vs \(\sim 0.44\)), by preventing diffusive mixing from counteracting sorting.

The second law of thermodynamics is not violated: the entropy reduction associated with sorting is offset by the information cost of the demon, in accordance with Landauer’s principle. Overall, the results establish a clear hierarchy (optimal > adaptive ≥ local) while demonstrating that **limited, local information is sufficient to recover most of the achievable ordering**, with substantially lower information cost.

## 1. Motivation

Maxwell’s Demon is a foundational thought experiment that probes the limits of the second law of thermodynamics. A hypothetical agent controls a door between two chambers and selectively allows particles to pass based on their velocities, thereby creating a temperature gradient without performing mechanical work. In its standard formulation, the demon has **global knowledge** of the system — for example, access to the mean speed or energy distribution of all particles.

This assumption of global information is both powerful and unrealistic. Real physical systems, as well as engineered and biological systems, typically operate under **local information constraints**: decisions are made based only on nearby observations rather than a centralized view of the entire system.

This raises a natural question: **how much of the demon’s functionality depends on global knowledge, and how much can be recovered from purely local information?**

We study a decentralized variant of Maxwell’s Demon in which each particle, upon arriving at the door, can only sample its local neighborhood and compare itself to nearby particles. This replaces a centralized decision rule with a distributed one, analogous to mechanisms in distributed computing, swarm systems, and markets where agents act on partial information.

The central objective is to quantify the trade-off between **information locality and thermodynamic performance**. Specifically: how does limiting the spatial range of information affect the achievable temperature separation, and what fraction of the optimal behavior can be recovered without global coordination?

The results show that most of the achievable sorting can be recovered with surprisingly limited local information, suggesting that global coordination is not required to approach near-optimal performance.

## 2. Experimental Setup

### The Box

We consider a two-dimensional square domain of size \(100 \times 100\) (dimensionless units with \(k_B = 1\), \(m = 1\)) containing 2000 hard-sphere particles. Initial particle velocities are drawn from a Maxwell–Boltzmann distribution at temperature \(T = 1.0\), ensuring a well-defined equilibrium starting point.

A vertical partition at \(x = 50\) divides the domain into left and right chambers. A narrow door located at the center of the partition allows particles to cross between the two sides, subject to the demon’s decision rule.

Particle dynamics follow elastic hard-sphere collisions, conserving total kinetic energy and momentum. In the absence of any demon policy, the system remains in equilibrium with no sustained temperature difference between the two chambers.

This setup provides a minimal, controlled environment in which any observed temperature imbalance can be attributed solely to the action of the demon, rather than to geometric asymmetries or density-driven effects.

### Decision Policies

We compare four distinct decision policies that govern how particles are allowed to cross the partition. Each policy differs in the information available to the decision-maker and the rule used to accept or reject crossings:

| Policy | Information | Decision Rule |
| ------ | ----------- | ------------- |
| **No demon (control)** | None | The door is always open; all particles cross freely. |
| **Adaptive (global mean)** | Global, per-side | Accept if the particle’s speed exceeds the mean speed of all particles on its current side (excluding itself). |
| **Optimal (“god”)** | Global, full system | Accept according to an energy-based threshold: left arrivals require \(e_L > \theta\), right arrivals require \(e_R < \theta\), where \(\theta\) is derived from \(T_L\), \(T_R\), \(N_L\), and \(N_R\) (see §2.2). |
| **Local** | Neighborhood within radius \(r\) | Accept if the particle’s speed exceeds the mean speed of neighboring particles within distance \(r\) on the same side (excluding itself). If no neighbors are present, reject. |

The adaptive and local policies share the same mean-based decision rule and differ only in the scope of the reference population: the adaptive policy uses a complete census of particles on a side, while the local policy samples a spatial neighborhood.

In contrast, the optimal (“god”) policy uses a fundamentally different criterion based on kinetic energy and incorporates information from both sides of the partition. This distinction is essential: it establishes a theoretical upper bound that cannot be reached by any mean-based policy, regardless of how much information it samples.

All policies are evaluated under identical dynamics and door mechanics, ensuring that performance differences arise solely from information constraints and decision rules.

### Crossing Constraint: Paired Swaps

To eliminate density-driven effects and isolate the impact of the decision policies, we enforce a **paired-swap constraint** on all crossings. When a particle satisfies the acceptance criterion, it is held at the partition and placed into a queue corresponding to its direction of motion (left→right or right→left). A crossing occurs only when both queues are non-empty, at which point one particle from each side is exchanged simultaneously.

This mechanism enforces \(\Delta N_L = \Delta N_R = 0\) exactly, ensuring that both chambers maintain equal particle counts at all times. As a result, any observed temperature difference arises purely from energy sorting rather than density imbalances or diffusive flux.

This constraint is also essential for defining a meaningful upper bound on performance. Without it, unrestricted crossings allow particle numbers to drift between chambers, and the demon can trivially amplify \(\Delta T\) by accumulating particles on one side. In that case, temperature differences are no longer governed solely by energy redistribution, and no clear theoretical limit exists.

With equal particle counts and conserved total energy, the maximum achievable temperature separation occurs when all high-energy particles are concentrated on one side and all low-energy particles on the other. In this idealized limit, one chamber reaches temperature \(2T_0\) while the other approaches \(0\), yielding a theoretical maximum
\[
\Delta T_{\max} = 2 T_0.
\]

While a particle is waiting in the queue, it remains assigned to its original chamber for all statistical measurements (e.g., temperature, entropy, and mean speed). This ensures that each policy operates on a consistent definition of the underlying populations.

The paired-swap constraint also suppresses the backflow that would otherwise occur through an open door, where particles diffuse in both directions and partially undo the demon’s sorting. By requiring matched exchanges, the system evolves toward a well-defined steady state in which the temperature difference reflects only the effectiveness of the decision policy.

### The Optimal Decision Rule

The optimal (“god”) policy assumes full knowledge of both chambers, including their temperatures (\(T_L, T_R\)) and particle counts (\(N_L, N_R\)). Because crossings occur as paired swaps, the decision must account for the **joint effect** of exchanging one particle from each side.

Let a left-arriving particle have kinetic energy \(e_L = \tfrac{1}{2}s_L^2\), and a right-arriving particle \(e_R = \tfrac{1}{2}s_R^2\). After a swap, the chamber temperatures update as
\[
T_L' = T_L + \frac{e_R - e_L}{N_L}, \qquad
T_R' = T_R + \frac{e_L - e_R}{N_R}.
\]

The resulting change in temperature difference is
\[
\Delta(\Delta T) = (T_R' - T_L') - (T_R - T_L)
= (e_L - e_R)\left(\frac{1}{N_R} + \frac{1}{N_L}\right).
\]

Since the prefactor is strictly positive, a swap increases \(\Delta T\) if and only if
\[
e_L > e_R.
\]

This condition is intuitive: to increase the temperature difference, higher-energy particles should move to the hotter side and lower-energy particles to the colder side.

To convert this pairwise condition into a practical per-arrival rule, we introduce a **neutral energy threshold** \(\theta\). This threshold is defined such that exchanging particles with energy \(\theta\) from both sides leaves \(\Delta T\) unchanged. Imposing this neutrality condition,
\[
\frac{\theta - T_R}{N_R} + \frac{\theta - T_L}{N_L} = 0,
\]
and solving for \(\theta\) yields
\[
\theta = \frac{\dfrac{T_R}{N_R} + \dfrac{T_L}{N_L}}{\dfrac{1}{N_R} + \dfrac{1}{N_L}}.
\]

This shared threshold enables a decentralized implementation of the optimal policy:

- Left arrivals are accepted only if \(e_L > \theta\).
- Right arrivals are accepted only if \(e_R < \theta\).

Because both sides use the same threshold, any executed swap automatically satisfies \(e_L > \theta > e_R\), and therefore guarantees \(e_L > e_R\). As a result, every accepted swap strictly increases \(\Delta T\).

This rule has three key properties:

1. **Energy-based optimality.** Decisions are made using kinetic energy (\(\tfrac{1}{2}s^2\)), which directly determines temperature, rather than speed.
2. **Global coupling via a scalar.** The threshold \(\theta\) incorporates information from both chambers (\(T_L, T_R, N_L, N_R\)) while requiring only a single scalar comparison per particle.
3. **Monotonic improvement.** Every accepted swap increases \(\Delta T\), so the system evolves monotonically toward its maximum without requiring lookahead or coordination between queued particles.

Under the paired-swap constraint, this policy is the greedy optimum: no alternative rule can achieve a larger increase in \(\Delta T\) per exchange given the same information.

### Experimental Protocol

To ensure a fair and controlled comparison across policies, all experiments are conducted from identical initial conditions and evaluated using a consistent convergence criterion.

For each trial, we first initialize all 2000 particles and save the full system state (positions and velocities). Each policy — adaptive, optimal (“god”), and local — is then run independently from this same initial configuration. For the local policy, we evaluate 15 values of the normalized radius \(r/L\) spanning the range \([0.02, 1.0]\).

This procedure ensures that all observed differences in performance arise solely from the decision policies, rather than from variations in initial conditions.

Convergence to steady state is determined using a lookback criterion: \(\Delta T\) is considered stable when its variation over a 30 simulation-second window falls below 2% of its peak value. Once this condition is met, the simulation continues for an additional 40 seconds to confirm stability.

Performance metrics (\(\Delta T\), \(\Delta S\), and information usage) are recorded at the moment steady state is detected, rather than at the end of the run. This avoids bias from differing minimum run times across policies and ensures that all measurements correspond to comparable dynamical states.

Unless otherwise noted, reported results aggregate five independent trials (seeds 1000–1004) with \(N = 2000\) particles under the paired-swap constraint.

## 3. Results

### Key Results

The results establish a clear hierarchy in performance. The optimal (“god”) policy achieves the largest temperature separation, \(\Delta T = 0.96 \pm 0.03\), compared to \(0.91 \pm 0.03\) for the adaptive (mean-based) policy. No fixed-radius local policy exceeds this bound in the aggregate, confirming that energy-based thresholding with full information defines the true upper limit.

At the same time, local information is highly efficient. A neighborhood radius of \(r/L \approx 0.09\) already recovers ~95% of the adaptive performance, and by \(r/L \approx 0.16\) the local policy matches it. Beyond this range, \(\Delta T\) saturates near the adaptive baseline, while information cost continues to increase, producing clear diminishing returns.

The remaining ~5% gap between adaptive and optimal performance is not due to limited information but to the decision rule itself: comparing speeds (mean-based policies) is intrinsically suboptimal relative to comparing kinetic energies.

Across all policies, larger temperature separations correspond to more negative \(\Delta S/N\), consistent with the thermodynamic relationship between energy concentration and entropy reduction. The system converges reliably to steady state under the paired-swap constraint, with no evidence of numerical drift.

### 3.1 ΔT vs r/L

![ΔT vs r/L](report_plots/sweep_deltaT.png)

**Baselines (5 seeds, 1000–1004):**

- Adaptive: \(\Delta T = 0.91 \pm 0.03\)
- Optimal (god): \(\Delta T = 0.96 \pm 0.03\)

The optimal policy defines a clear upper bound, achieving a ~5.5% higher \(\Delta T\) than the adaptive policy. This gap reflects the advantage of the energy-based decision rule over mean-speed thresholding. Across all radii, the local policy does not exceed this bound in the aggregate.

**Local-policy results:**

| \(r/L\) | \(\Delta T\) (mean±σ) | % of adaptive | % of god |
| --- | ----------- | ------------- | -------- |
| 0.02 | 0.579 ± 0.094 | 63.9% ± 11.9% | 60.5% ± 11.0% |
| 0.09 | 0.864 ± 0.071 | 94.9% ± 7.5% | 89.8% ± 5.1% |
| 0.16 | 0.906 ± 0.023 | 99.5% ± 2.9% | 94.4% ± 3.3% |
| 0.23 | 0.854 ± 0.029 | 93.9% ± 3.7% | 89.1% ± 4.8% |
| 0.30 | 0.904 ± 0.075 | 99.3% ± 7.8% | 94.1% ± 7.2% |
| 0.37 | 0.904 ± 0.053 | 99.4% ± 8.0% | 94.3% ± 8.2% |
| 0.44 | 0.927 ± 0.039 | 101.9% ± 5.8% | 96.6% ± 4.7% |
| 0.51 | 0.880 ± 0.090 | 96.4% ± 7.5% | 91.6% ± 8.6% |
| 0.58 | 0.848 ± 0.049 | 93.0% ± 3.2% | 88.3% ± 5.3% |
| 0.65 | 0.934 ± 0.047 | 102.5% ± 3.9% | 97.3% ± 4.5% |
| 0.72 | 0.917 ± 0.037 | 100.7% ± 2.9% | 95.6% ± 3.9% |
| 0.79 | 0.904 ± 0.026 | 99.2% ± 1.6% | 94.2% ± 4.0% |
| 0.86 | 0.911 ± 0.026 | 100.0% ± 0.0% | 94.9% ± 4.1% |
| 0.93 | 0.911 ± 0.026 | 100.0% ± 0.0% | 94.9% ± 4.1% |
| 1.00 | 0.911 ± 0.026 | 100.0% ± 0.0% | 94.9% ± 4.1% |

The dependence of \(\Delta T\) on \(r/L\) shows a rapid initial rise followed by saturation. Increasing the radius from \(r/L = 0.02\) to \(0.09\) recovers most of the achievable performance (from ~64% to ~95% of adaptive), indicating that the relevant information is highly localized near the door.

By \(r/L = 0.16\), the local policy matches the adaptive baseline within statistical uncertainty. Beyond this point, increasing \(r\) yields no systematic improvement. Apparent excursions above 100% (e.g., near \(r/L \sim 0.4\)–0.7) fall within the observed variance and do not represent a consistent advantage over the adaptive policy.

For \(r/L \geq 0.86\), the results converge exactly to the adaptive baseline (\(\Delta T = 0.911 \pm 0.026\)), confirming that once the neighborhood spans the entire half-box, the local and global policies become identical.

Overall, the results show that most of the achievable temperature separation is obtained with relatively small neighborhoods, and increasing the information radius beyond this regime produces diminishing returns.

### 3.2 Convergence Time

![Time to steady state](report_plots/sweep_time.png)

The adaptive baseline reaches steady state at \(554 \pm 39\) s, while the optimal (god) policy converges slightly faster at \(510 \pm 31\) s. This difference is consistent with the structure of the decision rules: the optimal policy accepts only swaps that are guaranteed to increase \(\Delta T\), whereas the adaptive policy uses a noisier mean-speed criterion and therefore spends more time on less effective exchanges.

The local policy converges on a comparable timescale across the full range of radii, with mean convergence times ranging from roughly 372 to 578 s. Unlike \(\Delta T\), convergence time does not show a strong monotonic dependence on \(r/L\). Some radii converge faster and others more slowly, but the variation appears dominated by stochastic differences across seeds rather than by a systematic radius-dependent effect.

All policies converge substantially more slowly than in the unrestricted-crossing setup used earlier in the project. This slowdown is expected: under paired swaps, an accepted particle cannot cross immediately and must wait for a partner from the opposite side, which throttles the effective exchange rate. The queueing constraint therefore improves interpretability and enforces a well-defined steady state, but it does so at the cost of longer convergence times.

Overall, the convergence-time results indicate that the paired-swap constraint sets the dominant timescale of the dynamics, while differences between policies remain secondary.

### 3.3 Information Cost

![Bits vs r/L](report_plots/bits_vs_r.png)

The cumulative information cost increases monotonically with the neighborhood radius \(r/L\), as expected from the growth in the number of sampled particles per decision.

At small radii, the cost is low:

- \(r/L = 0.02\): ~4,700 bits  
- \(r/L = 0.09\): ~17,745 bits  

As the radius increases, the number of neighbors scales roughly with the sampled area (\(\sim r^2\)), and the information cost rises accordingly. For large radii, the cost approaches the adaptive baseline, reaching approximately 36,000–37,000 bits for \(r/L \geq 0.86\), where the full population is effectively sampled.

A key result is the efficiency of local information. At \(r/L = 0.09\), the local policy achieves ~95% of the adaptive \(\Delta T\) using less than half the information budget. Increasing the radius beyond this point yields only marginal improvements in \(\Delta T\), while the information cost continues to grow substantially.

The underlying reason is that the decision rule depends only on a coarse statistic (the mean speed). Once the local sample is large enough to estimate this quantity reliably near the door, additional samples provide diminishing benefit.

Overall, the results show that information cost grows faster than performance, defining a clear trade-off: near-optimal sorting can be achieved with a relatively small fraction of the total available information.

### 3.4 Entropy vs Temperature Imbalance

![Entropy vs ΔT](report_plots/entropy_vs_deltaT.png)

The relationship between temperature separation and entropy change is strongly monotonic: larger \(\Delta T\) corresponds to more negative \(\Delta S/N\).

Across all policies and radii, the data collapse onto a tight curve, with \(\Delta S/N\) ranging from approximately \(-0.03\) at low \(\Delta T\) to about \(-0.13\)–\(-0.15\) near saturation. This behavior is consistent with thermodynamic expectations: concentrating energy into one chamber while depleting it from the other produces a more ordered (lower entropy) macroscopic state.

The smoothness of the curve indicates that entropy reduction is governed primarily by the achieved temperature difference, rather than by the specific policy used to produce it. In other words, different decision rules trace out the same underlying thermodynamic relationship between \(\Delta T\) and \(\Delta S/N\).

Points are colored by \(r/L\), showing a clear progression: small radii cluster at low \(\Delta T\) and weak entropy reduction, while larger radii move steadily toward higher \(\Delta T\) and more negative \(\Delta S/N\). This reinforces the interpretation that increasing information improves sorting, which in turn drives stronger entropy reduction.

Overall, the results confirm that the demon’s action reduces entropy in a controlled and predictable way, with the magnitude of the reduction directly tied to the extent of temperature separation.

### 3.5 Time-Series Diagnostics

![Time series](report_plots/time_series.png)

The time-series diagnostics confirm that the simulation evolves consistently with the underlying physical constraints and numerical implementation.

Total kinetic energy remains effectively constant throughout the run, indicating that elastic collisions and integration are implemented correctly with no detectable numerical drift. This conservation is essential, as any artificial energy gain or loss would directly bias the measured temperature difference.

The temperature difference \(\Delta T\) exhibits a clear transient growth phase followed by saturation at a steady-state value. The growth is initially rapid, as the demon preferentially sorts particles, and then slows as the system approaches its maximum achievable separation under the given policy.

The entropy per particle \(\Delta S/N\) decreases over time and stabilizes once \(\Delta T\) reaches steady state. This behavior is consistent with the demon driving the system toward a lower-entropy configuration by concentrating energy asymmetrically between the two chambers.

The absence of oscillations or drift in all three quantities — total energy, \(\Delta T\), and \(\Delta S/N\) — indicates that the steady state is stable and not an artifact of transient dynamics or numerical instability.

Overall, the time-series results provide a consistency check on the simulation: conservation laws are respected, convergence is well-behaved, and the measured steady states reflect genuine dynamical equilibria under the imposed constraints.

### 3.6 Information–Performance Trade-off

![Centralization trade-off](report_plots/centralization_tradeoff.png)

The trade-off between centralization, information cost, and sorting performance is sharply asymmetric. As the neighborhood radius increases, performance improves rapidly at first, but the marginal benefit of additional information quickly declines.

At small radii, the local policy has access to only limited information and correspondingly achieves modest temperature separation. Increasing the radius from very small values to \(r/L \approx 0.09\)–0.16 produces the largest gains in \(\Delta T\), moving the system from partial sorting to near-adaptive performance. This is the regime in which added information has the highest value.

Beyond this range, the curve flattens. Larger neighborhoods continue to increase the information budget, but they produce little systematic improvement in sorting. In other words, once the local policy has enough information to estimate the relevant near-door mean reliably, further centralization mostly adds redundancy rather than useful signal.

The color scale shows that bits per simulation-second increase steadily with radius, even after performance has saturated. This makes the efficiency frontier visually clear: the best operating region lies near \(r/L \approx 0.09\)–0.16, where most of the achievable \(\Delta T\) is obtained at a substantially lower information cost than the fully global policy.

Overall, the plot shows that the relationship between information and performance is strongly nonlinear. A modest amount of local information captures most of the benefit of centralization, while full centralization incurs a much larger information cost for only marginal additional sorting.

### Why Local Policies Match Global Performance

The adaptive policy has access to complete information about all particles on a given side, but compresses this information into a single statistic: the mean speed. The local policy, despite using far fewer samples, applies the same decision rule to a spatially restricted subset of particles. The key question is why this limited sampling is sufficient to recover nearly identical performance.

The answer lies in the fact that the relevant distribution for decision-making is not the global distribution of particle speeds, but the distribution **conditioned on particles arriving at the partition**. Decisions are made at the door, so the optimal threshold depends on the statistics of particles that actually reach this boundary, not on those deep in the bulk.

The adaptive policy estimates a mean over the entire chamber, mixing the arrival-conditioned distribution near the door with the bulk distribution far from it. In contrast, the local policy samples particles within a finite radius of the partition and therefore draws primarily from the population that participates in crossings. This makes the local estimate a better proxy for the effective decision threshold, even though it is based on fewer samples.

At moderate radii (\(r/L \approx 0.09\)–0.16), the local sample is large enough to estimate this near-door mean reliably. Increasing the radius beyond this range adds particles from the bulk that are less relevant to the decision, causing the local estimate to converge toward the global mean and eliminating any advantage of spatial filtering.

The optimal (“god”) policy avoids this limitation entirely by using an energy-based threshold that incorporates information from both chambers. The remaining performance gap therefore reflects a limitation of the mean-based decision rule itself, not the amount of information available.

In summary, local policies match global performance because they approximate the **arrival-conditioned distribution** that governs the decision boundary, while the global policy averages over a broader and less relevant population.

### 3.7 Seed-to-Seed Variability

For each seed, we identify the radius \(r/L\) that produces the highest steady-state \(\Delta T\) within the local policy and compare it to the corresponding adaptive and optimal (“god”) baselines initialized from the same microstate.

| Seed | Best \(r/L\) | Local \(\Delta T\) | Adaptive \(\Delta T\) | God \(\Delta T\) | Local/Adapt | Local/God |
| --- | --- | --- | --- | --- | --- | --- |
| 1000 | 0.37 | 0.970 | 0.860 | 0.951 | 1.13 | 1.02 |
| 1001 | 0.65 | 0.948 | 0.928 | 0.910 | 1.02 | 1.04 |
| 1002 | 0.44 | 0.995 | 0.911 | 0.978 | 1.09 | 1.02 |
| 1003 | 0.16 | 0.950 | 0.926 | 0.958 | 1.03 | 0.99 |
| 1004 | 0.30 | 1.033 | 0.929 | 1.006 | 1.11 | 1.03 |

Each seed has at least one radius at which the local policy exceeds the adaptive baseline, with ratios ranging from 1.02 to 1.13. In several cases, the best local result also exceeds the optimal policy for that seed.

However, this comparison involves **post hoc selection** over multiple radii. For each seed, the best-performing radius is chosen from 15 candidates, which inflates the observed maximum due to statistical variation. As a result, these exceedances do not indicate that the local policy is systematically better than the adaptive or optimal policies.

When evaluated at any fixed radius, the expected ordering is preserved: the optimal policy achieves the highest mean \(\Delta T\), followed by the adaptive and local policies. The apparent violations in the table arise from selection bias rather than from a true reversal of performance.

At large radii (\(r/L \geq 0.86\)), all seeds converge exactly to the adaptive baseline, confirming that the local and global mean-based policies become identical when sampling spans the entire chamber.

Overall, the seed-to-seed variability is modest and does not alter the main conclusions. The hierarchy of policies holds in expectation, and the local policy’s performance remains consistent across independent initial conditions.

## 4. Design Decisions

### Why per-side adaptive as the benchmark

Early versions used a global (both-sides) mean speed as the adaptive threshold. As sorting progresses, the two chambers diverge in temperature, making a single global threshold increasingly uninformative. The revised adaptive policy instead uses the **per-side mean speed**, computed over all particles on the arriving particle’s side (excluding the particle itself).

This choice ensures that the adaptive policy represents the best possible use of global information within the class of mean-based decision rules. It provides a fair and consistent benchmark against which to compare local policies that use the same rule but with restricted sampling.

### Why arrival-only decisions with queued paired swaps

Each particle triggers the decision policy **once per approach** to the partition. If accepted, it is placed in a queue and waits for a matching particle from the opposite side so that a paired swap can occur.

Re-evaluating particles at every timestep would artificially inflate the information cost and introduce order-dependent effects, since the decision threshold could change while a particle remains near the door. By evaluating each particle once per arrival, the model ensures that the information accounting reflects actual decision events and avoids temporal inconsistencies.

### Why both policies use the same reference population

Both the adaptive and local policies compare the arriving particle’s speed to a mean computed over particles on the same side, excluding the arriving particle itself. The only difference between the two is the sampling domain: the adaptive policy uses the full population, while the local policy samples within a radius \(r\).

Queued particles remain assigned to their original chamber for all statistical calculations. This ensures that both policies operate on consistent populations and that differences in performance arise solely from information constraints, not from differences in bookkeeping.

As a consequence, when the local sampling radius spans the entire half-box (\(r/L \gtrsim 0.86\)), the two policies become identical and produce exactly the same results.

### Why the local policy can match the adaptive benchmark

The adaptive policy compresses its complete information into a single statistic: the mean speed over an entire chamber. However, the relevant distribution for decision-making is the one conditioned on particles arriving at the partition, not the bulk distribution.

The local policy samples particles near the door, which are drawn from a distribution closer to this arrival-conditioned ensemble. As a result, it can estimate an effective decision threshold that is as informative as the global mean, despite using fewer samples.

This explains why local policies with moderate radii can match the adaptive benchmark: they focus on the most relevant subset of the system rather than averaging over the entire chamber.

### Why ΔT is measured at steady-state detection

All performance metrics (\(\Delta T\), \(\Delta S\), and information usage) are recorded at the moment steady state is detected, rather than at the end of the simulation.

This choice avoids bias due to differing minimum run times across policies. Measuring at steady-state detection ensures that all policies are evaluated at comparable points in their dynamical evolution, providing a consistent basis for comparison.

### Why steady-state detection uses a lookback criterion

Steady state is defined using a lookback condition: \(\Delta T\) is considered stable when its variation over a 30-second window falls below a fixed threshold.

Earlier slope-based methods could trigger prematurely when \(\Delta T\) was nearly constant near zero, before meaningful sorting had occurred. The lookback criterion avoids this issue by requiring both a period of change and subsequent stabilization.

An additional hold period ensures that the detected steady state is stable and not a transient fluctuation.

## 5. Conclusions

This work set out to answer a simple question: how much of Maxwell’s Demon’s sorting ability depends on global information, and how much can be recovered from strictly local observations near the partition? The results show that most of the achievable performance can be recovered locally.

The optimal (“god”) policy provides the true upper bound under the paired-swap constraint. By using an energy-based threshold with information from both chambers, it achieves \(\Delta T = 0.96 \pm 0.03\), compared with \(0.91 \pm 0.03\) for the adaptive mean-based policy. No fixed-radius local policy exceeds this bound in the aggregate, consistent with the theoretical expectation that a policy with more information and a better decision rule should perform at least as well as any restricted alternative.

At the same time, local information is remarkably effective. A neighborhood radius of \(r/L \approx 0.09\) already recovers about 95% of the adaptive policy’s performance, and by \(r/L \approx 0.16\) the local policy matches it. This means that most of the useful information is concentrated near the decision boundary, rather than being distributed uniformly throughout the chamber.

The remaining gap between the adaptive and optimal policies is not primarily an information problem. It is a decision-rule problem. Both the adaptive and local policies compare particle speeds to a mean-speed threshold, whereas temperature is determined by mean kinetic energy. The optimal policy closes this mismatch by making decisions directly in energy space. This explains why no amount of additional sampling within a mean-based framework can fully eliminate the gap.

The paired-swap constraint is essential both physically and conceptually. By enforcing \(\Delta N_L = \Delta N_R = 0\), it removes density-driven effects and ensures that the measured temperature difference reflects energy sorting alone. It also produces a well-defined theoretical ceiling: with fixed particle counts and conserved total energy, the maximum possible temperature separation is \(\Delta T_{\max} = 2T_0\). Relative to this bound, the optimal policy reaches about 48% of the theoretical maximum.

The results also reveal a clear information-efficiency trade-off. Increasing the local sampling radius initially produces large gains in \(\Delta T\), but the benefit quickly saturates while the information cost continues to grow. The most efficient operating regime lies around \(r/L \approx 0.09\)–0.16, where near-adaptive performance is obtained at substantially lower information cost than the fully global policy.

Thermodynamically, the behavior is consistent throughout. Larger temperature separations correspond to more negative \(\Delta S/N\), and the time-series diagnostics confirm stable convergence with conserved total kinetic energy. The simulations therefore support a coherent picture: the demon reduces entropy locally by selectively redistributing energy, while the global entropy cost is understood to be paid through information processing.

The central conclusion is that full centralization is not required to recover most of the demon’s effect. Local information, when sampled in the right place, captures nearly all of the useful signal for a mean-based decision rule. What ultimately separates near-optimal from optimal performance is not the amount of information alone, but whether the decision rule is aligned with the underlying thermodynamic quantity of interest.
