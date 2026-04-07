# Box of Gas — Centralized vs. Decentralized Control Simulator

A 2D particle simulation exploring how much of Maxwell's Demon sorting power can be recovered using only local information. Particles in a box follow Maxwell-Boltzmann statistics with elastic collisions. A partition with a door divides the box, and different "demon" policies control which particles pass through.

The core question: **how much centralization do you need to break the second law locally?**

## Concept

### Three Regimes

1. **No demon (control):** Door is open, particles pass freely. Both sides equilibrate to the same temperature.
2. **Classical Maxwell's demon:** An omniscient gatekeeper with global knowledge sorts fast particles to the right and slow particles to the left.
3. **Local "swarm" demon:** Each particle, upon arriving at the door, polls same-side neighbors within radius `r`, compares its speed to the local average, and decides whether to cross. As `r` grows to include the entire box, this should approach the classical demon's behavior.

### The Money Plot

Sorting quality (ΔT, ΔS, information cost) as a function of `r/L` (neighborhood radius as a fraction of box size). The prediction: a sigmoid-like curve where most sorting power is recovered well before `r = L`, suggesting **local information can approximate global control**.

## Design Decisions

### Physics

- **2D hard-sphere simulation** with N particles (target N ≈ 1000).
- **Dimensionless units:** k_B = 1, m = 1, box size 100 × 100.
- **Time-stepping approach** (not event-driven) with fixed Δt.
  - Δt constraint: Δt < 0.2 × R / (3√(T/m)) to keep overlaps rare.
  - Overlap resolution: separate to exactly touching along line of centers, *then* apply elastic impulse. No push-apart without impulse (that injects energy).
- **Energy conservation monitor** from day one. If drift exceeds ~0.1% over a run, Δt is too large.
- **Velocities initialized** from Maxwell-Boltzmann: each component is Gaussian with σ = √(T/m). Sampled via Box-Muller.
- **Collision detection** via cell lists (spatial hash), cells of size ~2× particle radius. O(N) per frame.
- **Wall collisions:** flip the relevant velocity component.

### Partition and Door

- **Partition** is a vertical line at x = L/2.
- **Door** is a segment of the partition with variable width W (set as a fraction of box height).
- **Geometric trigger:** a particle's trajectory crossing the door segment triggers the policy decision.
- **Rejection:** particle reflects elastically off the partition at the crossing point.
- **Decision timing:** arrival-only (particle decides once upon reaching the door, not continuously).

### Classical Demon Policy

Two sub-modes:

- **Fixed threshold:** uses the initial mean speed at t=0. The honest "omniscient at one point in time" version. Gets less effective as the distribution shifts.
- **Adaptive threshold:** uses the current global mean speed. Has ongoing global information. This is the fairer comparison to the local demon (both use current information, just at different scales).

### Local Demon Policy

When particle `i` arrives at the door from side S:

1. Find all particles `j` where:
   - `j` is on side S (same-side only — the partition is an information barrier)
   - distance(i, j) ≤ r
   - `j` is moving toward the door (v_x > 0 if left side, v_x < 0 if right side)
   - j ≠ i
2. Compute mean speed |v| of that neighbor set.
3. If |v_i| > mean → pass through.
4. If |v_i| ≤ mean → reject (reflect).
5. **If the neighbor set is empty → reject.** No information = no basis for a decision.

**Bidirectional rule:** particles can cross in both directions. A slow particle on the right can decide to cross left. This is the cleaner "agents with local information" setup — no privileged direction.

**Note:** same-side-only neighbors with a cooling left side may cause runaway sorting at small r (the reference population gets slower, so more particles pass the test). This is expected behavior from the feedback loop of a cooling reference frame, not a bug.

### Measurements

Three order parameters tracked over time:

1. **ΔT = T_right − T_left:** Primary, most intuitive. In 2D, T = ⟨KE⟩ / k_B per particle (no 3/2 factor).
2. **ΔS (entropy change):** S per side = N × [ln(A/N) + ln(T) + const]. Report ΔS(t) = [S_left(t) + S_right(t)] − [S_total(0)]. Normalize per particle for cross-N comparisons.
3. **Information-theoretic work (Landauer cost):**
   - Classical demon: log₂(N) bits per decision.
   - Local demon: log₂(k+1) bits per decision, where k = number of neighbors polled.
   - Cumulative bits × k_B T ln(2) = minimum thermodynamic work.

**Steady-state detection:** moving-window slope of ΔT; flag when slope is below threshold over several consecutive windows.

### Technology

- **Web app** — single self-contained HTML file (vanilla JS + HTML5 Canvas).
- **Canvas rendering** for particles (colored blue→red by speed) and partition/door.
- **Second canvas or inline plots** for live ΔT(t), ΔS(t), and cumulative bits.
- **ES modules** (`<script type="module">`) split into separate files if the codebase exceeds ~1000 lines.
- **No build step, no npm, no frameworks.**

### UI Layout

- **Left panel:** particle canvas — box, colored particles, visible partition with door gap.
- **Right panel:** three stacked line plots (ΔT, ΔS, cumulative bits) sharing a time axis.
- **Top bar:** sliders for N, T, r/L, W (door width fraction), dropdown for demon type. Buttons: Start / Pause / Reset / Export CSV.
- **Bottom bar:** readouts for T_left, T_right, N_left, N_right, bits used, steady-state flag, energy drift monitor.

## Build Order

Each stage must be verified before moving to the next.

### Stage 1: Box + Particles + Collisions
- N particles in a 2D box, elastic collisions, cell-list spatial hash.
- Energy conservation monitor.
- **Verify:** energy conserved, velocity histogram matches Maxwell-Boltzmann after equilibration.

### Stage 2: Partition + Open Door
- Add partition with full-width door, no policy (all particles pass).
- **Verify:** T_left ≈ T_right within statistical noise.

### Stage 3: Classical Demon
- Fixed-threshold and adaptive-threshold modes.
- **Verify:** ΔT grows and saturates. Left cools, right heats.

### Stage 4: Local Demon + Radius Sweep
- Local demon with parameter r, using the precise neighbor definition above.
- Sweep r from small to L, produce the ΔT vs r/L plot.
- **Verify:** large r ≈ adaptive classical demon; small r is weaker (or shows the runaway effect).

### Stage 5: Information Cost Tracking
- Landauer work accounting across demon types and r values.
- Scatter plot: final sorting quality vs. information cost across r.

### Stage 6: UI Polish + Export
- Sliders, controls, CSV export.
- Split into multiple files if needed.
