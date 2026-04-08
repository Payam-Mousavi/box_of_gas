# Box of Gas — Centralized vs. Decentralized Control Simulator

A 2D particle simulation exploring how much of Maxwell's Demon sorting power can be recovered using only local information. Particles in a box follow Maxwell-Boltzmann statistics with elastic collisions. A partition with a door divides the box, and different "demon" policies control which particles pass through.

The core question: **how much centralization do you need to break the second law locally?**

## How to Run

Serve the directory with any static HTTP server, then open `index.html`:

```bash
python3 -m http.server        # then visit http://localhost:8000
```

No build step, no npm, no dependencies — just vanilla JS files loaded via `<script src>`.

## Python Analysis Package (uv-ready)

You can analyze CSV exports offline using the bundled Python CLI:

```bash
cd box_of_gas
uv run box-of-gas-analyze path/to/export.csv --out plots/
```

The CLI depends only on `matplotlib` and is packaged via `pyproject.toml` so you can `uv tool install .` or run it directly with `uv run`.

## Concept

### Four Regimes

1. **No demon (control):** Door is open, particles pass freely. Both sides equilibrate to the same temperature.
2. **Classical Maxwell's demon (fixed threshold):** Uses the initial mean speed at t=0 as a permanent sorting threshold. Gets less effective as the distribution shifts.
3. **Classical Maxwell's demon (adaptive):** Uses the current per-side mean speed. "Is this particle faster than average for its side?" This is the true upper bound — the optimal use of global information.
4. **Local "swarm" demon:** Each particle, upon arriving at the door, polls same-side neighbors within radius `r`, compares its speed to the local average, and decides whether to cross. As `r` grows to include the entire box, this approaches the adaptive classical demon's behavior.

### The Money Plot

The automated **r-sweep** runs all four regimes from identical initial conditions and produces:

- **ΔT vs r/L**: sorting quality as a function of neighborhood radius. Shows a sigmoid-like curve where most sorting power is recovered well before `r = L`.
- **Time to steady state vs r/L**: how quickly each regime converges.
- **Classical baselines** drawn as horizontal reference lines for comparison.

## Design Decisions

### Physics

- **2D hard-sphere simulation** with N particles (target N ~ 500–1000).
- **Dimensionless units:** k_B = 1, m = 1, box size 100 x 100.
- **Time-stepping approach** (not event-driven) with fixed dt.
  - dt constraint: dt < 0.2 x R / (3 sqrt(T/m)) to keep overlaps rare.
  - Overlap resolution: separate to exactly touching along line of centers, then apply elastic impulse.
- **Energy conservation monitor**: drift displayed live, color-coded warning at 0.1%.
- **Velocities initialized** from Maxwell-Boltzmann via Box-Muller. Net momentum removed.
- **Collision detection** via cell lists (spatial hash). O(N) per frame.
- **Wall collisions:** elastic reflection (flip relevant velocity component).

### Partition and Door

- **Partition** is a vertical line at x = L/2.
- **Door** is a segment of the partition with variable width W (set as a fraction of box height).
- **Geometric trigger:** particle overlapping the door segment triggers the policy decision.
- **Rejection:** particle reflects elastically off the partition.
- **Decision timing:** arrival-only.

### Classical Demon Policy

- **Fixed threshold:** initial mean speed. One-time global knowledge.
- **Adaptive threshold:** current per-side mean speed. Ongoing global knowledge. This is the correct upper bound because the local demon at large r also uses per-side information. Both answer the same question ("am I faster than my side's average?") — the classical demon just has a perfect sample.

### Local Demon Policy

When particle `i` arrives at the door from side S:

1. Find all particles `j` where:
   - `j` is on side S (same-side only — the partition is an information barrier)
   - distance(i, j) <= r
   - `j` is moving toward the door (v_x > 0 if left side, v_x < 0 if right side)
   - j != i
2. Compute mean speed |v| of that neighbor set.
3. If |v_i| > mean -> pass through.
4. If |v_i| <= mean -> reject (reflect).
5. **If the neighbor set is empty -> reject.** No information = no basis for a decision.

**Bidirectional rule:** particles can cross in both directions. A slow particle on the right can decide to cross left.

### Measurements

Tracked over time:

- **dT = T_right - T_left:** primary order parameter.
- **dS per particle:** 2D ideal gas entropy change, S = N[ln(A/N) + ln(T)].
- **Cumulative information bits:** classical = log2(N) per decision, local = log2(k+1) where k = neighbors polled.

**Steady-state detection:** compares dT now vs 30 sim-seconds ago. Two independent criteria (either triggers):

- **Relative:** change < 2% of peak |dT| (only when peak > 0).
- **Absolute:** peak |dT| is tiny (< 5x threshold), current |dT| < 0.005, and change < 0.005.

Minimum sim time of 100 before checking. During sweeps, an additional **hold period** of 40 sim-seconds after detection confirms stability, plus minimum run times (400 for baselines, 200 for local).

### r-Sweep

The automated sweep:

1. Initializes particles once and saves state.
2. Runs classical (fixed) from saved state to convergence.
3. Runs classical (adaptive) from saved state to convergence.
4. Sweeps 15 values of r/L from 0.02 to 1.0, each from the same saved state.
5. Plots dT and time-to-steady vs r/L with classical baselines as horizontal reference lines.

All runs share identical initial conditions, so differences are purely due to the demon policy.

### Technology

- **Vanilla JS + HTML5 Canvas.** No build step, no npm, no frameworks.
- Canvas rendering for particles (blue -> red by speed) and partition/door.
- Live plots: speed distribution (vs MB theory), dT(t), dS(t), sweep results.

### File Structure

| File | Lines | Responsibility |
|------|-------|----------------|
| `index.html` | ~280 | HTML/CSS, controls, main loop, sweep termination logic |
| `sim.js` | ~310 | Physics engine: init, collisions, walls, stepping, steady-state detection |
| `policy.js` | ~50 | Demon door policies (none, classical-fixed, classical-adaptive, local) |
| `render.js` | ~300 | All canvas rendering, FPS tracking, stats bar |
| `sweep.js` | ~190 | r-sweep orchestration, state save/restore, CSV export |

All files use classic `<script src>` tags (not ES modules) so they share the global scope. Load order: sim → policy → render → sweep → inline controls.

### UI

- **Left panel:** particle canvas with colored particles and visible partition/door.
- **Right panel:** speed distribution histogram, dT over time, dS over time, dT vs r/L sweep chart, time-to-steady sweep chart.
- **Top bar:** sliders for N, T, particle radius, door width, demon type dropdown, r/L slider (when local selected). Buttons: Start/Pause, Reset, r-Sweep, Export CSV.
- **Bottom bar:** T_left, T_right, N_left, N_right, dS, energy drift, cumulative bits, FPS, sim time, steady-state indicator.
- **CSV export:** downloads time series and sweep results including classical baselines.
