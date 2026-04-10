// ============================================================
// Sweep state
// ============================================================
let sweepRunning = false;
let sweepResults = [];
let sweepRValues = [];
let sweepIdx = 0;
let sweepPhase = 'idle';
let baselineFixedDT = null, baselineFixedTime = null, baselineFixedRunTime = null; // unused — kept for render compat
let baselineAdaptiveDT = null, baselineAdaptiveTime = null, baselineAdaptiveRunTime = null;

// Saved initial state for reproducible sweep runs
let savedX = null, savedY = null, savedVx = null, savedVy = null;
let savedN = 0, savedMeanSpeed = 0, savedKE = 0;

function resetSweepData() {
  sweepRunning = false;
  sweepResults = [];
  sweepRValues = [];
  sweepIdx = 0;
  sweepPhase = 'idle';
  baselineFixedDT = null;
  baselineFixedTime = null;
  baselineFixedRunTime = null;
  baselineAdaptiveDT = null;
  baselineAdaptiveTime = null;
  baselineAdaptiveRunTime = null;
  document.getElementById('sweepStatus').textContent = '';
  renderSweep();
  renderSweepTime();
}

// ============================================================
// State save/restore
// ============================================================
function saveInitialState() {
  savedN = N;
  savedX = new Float64Array(x);
  savedY = new Float64Array(y);
  savedVx = new Float64Array(vx);
  savedVy = new Float64Array(vy);
  savedMeanSpeed = initialMeanSpeed;
  savedKE = initialKE;
}

function restoreInitialState() {
  N = savedN;
  x = new Float64Array(savedX);
  y = new Float64Array(savedY);
  vx = new Float64Array(savedVx);
  vy = new Float64Array(savedVy);
  initialMeanSpeed = savedMeanSpeed;
  initialKE = savedKE;
  simTime = 0; totalBits = 0;
  keHistory = []; dtHistory = []; dsHistory = [];
  isSteady = false; steadyTime = null; peakDT = 0;
  doorCrossing = new Uint8Array(N);
  const s0 = computeSideTemps();
  initialS = computeEntropy(s0.tL, s0.nL, s0.tR, s0.nR);
}

// ============================================================
// Sweep orchestration
// ============================================================
function startSweep() {
  if (sweepRunning) return;
  sweepRunning = true;
  sweepResults = [];
  sweepRValues = [];
  baselineFixedDT = null; baselineFixedTime = null; baselineFixedRunTime = null;
  baselineAdaptiveDT = null; baselineAdaptiveTime = null; baselineAdaptiveRunTime = null;
  for (let r=0.02; r<=1.01; r+=0.07) sweepRValues.push(Math.min(r,1.0));
  sweepIdx = 0;
  // Skip fixed baseline — go straight to adaptive
  sweepPhase = 'baseline-adaptive';
  document.getElementById('btnSweep').disabled = true;
  document.getElementById('btnStartPause').disabled = true;

  // Initialize once and save — all sweep runs start from this state
  const p = readParams();
  doorFraction = p.door;
  init(p.N, p.T, p.R);
  saveInitialState();

  runSweepPhase();
}

function runSweepPhase() {
  // Fixed baseline phase removed — adaptive is the only classical reference
  // if (sweepPhase === 'baseline-fixed') {
  //   document.getElementById('sweepStatus').textContent = 'Sweep: running classical (fixed) baseline...';
  //   demonType = 'classical-fixed';
  //   restoreInitialState();
  //   running = true;
  //   loop();
  // } else
  if (sweepPhase === 'baseline-adaptive') {
    document.getElementById('sweepStatus').textContent = 'Sweep: running classical (adaptive) baseline...';
    demonType = 'classical-adaptive';
    restoreInitialState();
    running = true;
    loop();
  } else if (sweepPhase === 'local') {
    runLocalSweepStep();
  }
}

function runLocalSweepStep() {
  if (sweepIdx >= sweepRValues.length) {
    finishSweep();
    return;
  }
  const rL = sweepRValues[sweepIdx];
  document.getElementById('sweepStatus').textContent =
    `Sweep: r/L = ${rL.toFixed(2)} (${sweepIdx+1}/${sweepRValues.length})`;

  demonType = 'local';
  localRadiusFrac = rL;
  restoreInitialState();
  running = true;
  loop();
}

function finishSweepStep() {
  running = false;
  const { tR, tL, nL, nR } = computeSideTemps();
  const currentS = computeEntropy(tL, nL, tR, nR);
  const deltaS = (currentS - initialS) / N;
  const finalDT = tR - tL;

  // Fixed baseline recording removed
  // if (sweepPhase === 'baseline-fixed') {
  //   baselineFixedDT = finalDT;
  //   baselineFixedTime = steadyTime || simTime;
  //   sweepPhase = 'baseline-adaptive';
  //   renderSweep(); renderSweepTime();
  //   setTimeout(runSweepPhase, 50);
  // } else
  if (sweepPhase === 'baseline-adaptive') {
    baselineAdaptiveDT = finalDT;
    baselineAdaptiveTime = steadyTime || simTime;
    baselineAdaptiveRunTime = simTime;
    sweepPhase = 'local';
    renderSweep(); renderSweepTime();
    setTimeout(runSweepPhase, 50);
  } else {
    sweepResults.push({
      rL: sweepRValues[sweepIdx],
      finalDT,
      finalDS: deltaS,
      bits: totalBits,
      steadyT: steadyTime || simTime,
      runTime: simTime,
    });
    renderSweep(); renderSweepTime();
    sweepIdx++;
    setTimeout(runLocalSweepStep, 50);
  }
}

function finishSweep() {
  sweepRunning = false;
  running = false;
  document.getElementById('btnSweep').disabled = false;
  document.getElementById('btnStartPause').disabled = false;
  document.getElementById('btnStartPause').textContent = 'Start';
  document.getElementById('sweepStatus').textContent =
    `Sweep complete! ${sweepResults.length} points.`;
  renderSweep();
}

// ============================================================
// CSV export
// ============================================================
function exportCSV() {
  let csv = 'time,KE,deltaT,deltaS_per_particle\n';
  const maxLen = Math.max(keHistory.length, dtHistory.length, dsHistory.length);
  for (let i=0;i<maxLen;i++) {
    const t = keHistory[i] ? keHistory[i][0].toFixed(4) : '';
    const ke = keHistory[i] ? keHistory[i][1].toFixed(6) : '';
    const dT = dtHistory[i] ? dtHistory[i][1].toFixed(6) : '';
    const dS = dsHistory[i] ? dsHistory[i][1].toFixed(6) : '';
    csv += `${t},${ke},${dT},${dS}\n`;
  }

  if (sweepResults.length > 0 || baselineAdaptiveDT !== null) {
    csv += '\n\nr_sweep_results\n';
    // Fixed baseline export removed
    // if (baselineFixedDT !== null) csv += `baseline_classical_fixed_deltaT,${baselineFixedDT.toFixed(6)}\n`;
    // if (baselineFixedTime !== null) csv += `baseline_classical_fixed_steady_time,${baselineFixedTime.toFixed(2)}\n`;
    if (baselineAdaptiveDT !== null) csv += `baseline_classical_adaptive_deltaT,${baselineAdaptiveDT.toFixed(6)}\n`;
    if (baselineAdaptiveTime !== null) csv += `baseline_classical_adaptive_steady_time,${baselineAdaptiveTime.toFixed(2)}\n`;
    if (baselineAdaptiveRunTime !== null) csv += `baseline_classical_adaptive_run_time,${baselineAdaptiveRunTime.toFixed(2)}\n`;
    csv += 'r_over_L,final_deltaT,final_deltaS,total_bits,steady_time,run_time\n';
    for (const r of sweepResults) {
      const runtime = r.runTime ?? r.steadyT;
      csv += `${r.rL.toFixed(4)},${r.finalDT.toFixed(6)},${r.finalDS.toFixed(6)},${r.bits.toFixed(2)},${r.steadyT.toFixed(2)},${runtime.toFixed(2)}\n`;
    }
  }

  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `box_of_gas_${demonType}_${new Date().toISOString().slice(0,16)}.csv`;
  a.click();
}
