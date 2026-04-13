// ============================================================
// Canvas contexts
// ============================================================
const simCanvas = document.getElementById('simCanvas');
const simCtx = simCanvas.getContext('2d');
const histCanvas = document.getElementById('histCanvas');
const histCtx = histCanvas.getContext('2d');
const dtCanvas = document.getElementById('dtCanvas');
const dtCtx = dtCanvas.getContext('2d');
const dsCanvas = document.getElementById('dsCanvas');
const dsCtx = dsCanvas.getContext('2d');
const sweepCanvas = document.getElementById('sweepCanvas');
const sweepCtx = sweepCanvas.getContext('2d');
const timeCanvas = document.getElementById('timeCanvas');
const timeCtx = timeCanvas.getContext('2d');

// ============================================================
// FPS tracking
// ============================================================
let frameCount = 0, lastFpsTime = performance.now(), currentFps = 0;

function updateFPS() {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) { currentFps = frameCount; frameCount = 0; lastFpsTime = now; }
}

// ============================================================
// Particle canvas
// ============================================================
function speedColor(speed, maxSpeed) {
  const t = Math.min(speed/maxSpeed, 1);
  if (t < 0.5) {
    const s = t*2;
    return `rgb(${Math.round(80+175*s)},${Math.round(80+175*s)},255)`;
  } else {
    const s = (t-0.5)*2;
    return `rgb(255,${Math.round(255-200*s)},${Math.round(255-200*s)})`;
  }
}

function renderSim() {
  simCtx.clearRect(0,0,SIM_CANVAS_W,SIM_CANVAS_H);
  const maxSpeed = 3*Math.sqrt(T);
  const r = Math.max(particleRadius*SCALE, 1.5);

  for (let i=0;i<N;i++) {
    if (queuedState && queuedState[i]) continue; // hide particles parked at the door queues
    const speed = Math.sqrt(vx[i]*vx[i] + vy[i]*vy[i]);
    simCtx.beginPath();
    simCtx.arc(x[i]*SCALE_X, (BOX_H-y[i])*SCALE_Y, r, 0, 2*Math.PI);
    simCtx.fillStyle = speedColor(speed, maxSpeed);
    simCtx.fill();
  }

  // Partition
  const partPx = PARTITION_X*SCALE_X;
  const doorHalf = (doorFraction*BOX_H)/2;
  const doorTopPx = (BOX_H-(BOX_H/2+doorHalf))*SCALE_Y;
  const doorBotPx = (BOX_H-(BOX_H/2-doorHalf))*SCALE_Y;

  simCtx.strokeStyle='#8899aa'; simCtx.lineWidth=2;
  simCtx.beginPath(); simCtx.moveTo(partPx,0); simCtx.lineTo(partPx,doorTopPx); simCtx.stroke();
  simCtx.beginPath(); simCtx.moveTo(partPx,doorBotPx); simCtx.lineTo(partPx,SIM_CANVAS_H); simCtx.stroke();

  simCtx.strokeStyle='rgba(42,157,143,0.3)'; simCtx.lineWidth=1; simCtx.setLineDash([4,4]);
  simCtx.beginPath(); simCtx.moveTo(partPx,doorTopPx); simCtx.lineTo(partPx,doorBotPx); simCtx.stroke();
  simCtx.setLineDash([]);

  simCtx.strokeStyle='#445'; simCtx.lineWidth=1;
  simCtx.strokeRect(0,0,SIM_CANVAS_W,SIM_CANVAS_H);

  if (typeof swapQueueLeft !== 'undefined' && typeof swapQueueRight !== 'undefined') {
    simCtx.font='10px Courier New';
    simCtx.fillStyle='#ffb4a2';
    simCtx.textAlign='right';
    simCtx.fillText(`L→R queue: ${swapQueueLeft.length}`, partPx-6, doorTopPx-6);
    simCtx.fillStyle='#90caf9';
    simCtx.textAlign='left';
    simCtx.fillText(`R→L queue: ${swapQueueRight.length}`, partPx+6, doorTopPx-6);
  }
}

// ============================================================
// Speed distribution histogram
// ============================================================
function renderHistogram() {
  const W=histCanvas.width, H=histCanvas.height;
  histCtx.clearRect(0,0,W,H);
  const nBins=40, maxSpeed=5*Math.sqrt(T), binWidth=maxSpeed/nBins;
  const bins = new Float64Array(nBins);
  for (let i=0;i<N;i++) {
    const s = Math.sqrt(vx[i]*vx[i]+vy[i]*vy[i]);
    bins[Math.min(Math.floor(s/binWidth),nBins-1)]++;
  }
  for (let i=0;i<nBins;i++) bins[i]/=(N*binWidth);

  let maxD=0; for (let i=0;i<nBins;i++) if(bins[i]>maxD) maxD=bins[i];
  let maxA=0; for (let i=0;i<nBins;i++) {
    const v=(i+0.5)*binWidth, fv=(v/T)*Math.exp(-v*v/(2*T));
    if(fv>maxA) maxA=fv;
  }
  const yMax = Math.max(maxD,maxA)*1.1;
  const mg={left:35,right:10,top:10,bottom:20}, pW=W-mg.left-mg.right, pH=H-mg.top-mg.bottom;

  histCtx.fillStyle='rgba(42,157,143,0.5)';
  for (let i=0;i<nBins;i++) {
    histCtx.fillRect(mg.left+(i/nBins)*pW, mg.top+pH-(bins[i]/yMax)*pH, pW/nBins-1, (bins[i]/yMax)*pH);
  }
  histCtx.strokeStyle='#e76f51'; histCtx.lineWidth=2; histCtx.beginPath();
  for (let px=0;px<pW;px++) {
    const v=(px/pW)*maxSpeed, fv=(v/T)*Math.exp(-v*v/(2*T));
    const py=mg.top+pH-(fv/yMax)*pH;
    px===0?histCtx.moveTo(mg.left+px,py):histCtx.lineTo(mg.left+px,py);
  }
  histCtx.stroke();

  histCtx.strokeStyle='#445'; histCtx.lineWidth=1; histCtx.beginPath();
  histCtx.moveTo(mg.left,mg.top); histCtx.lineTo(mg.left,mg.top+pH);
  histCtx.lineTo(mg.left+pW,mg.top+pH); histCtx.stroke();

  histCtx.fillStyle='#667'; histCtx.font='10px Courier New';
  histCtx.textAlign='center'; histCtx.fillText('speed',mg.left+pW/2,H-2);
  histCtx.textAlign='left'; histCtx.fillText('f(v)',0,mg.top+10);
  histCtx.fillStyle='#e76f51'; histCtx.fillText('— theory',mg.left+pW-65,mg.top+12);
  histCtx.fillStyle='rgba(42,157,143,0.8)'; histCtx.fillText('█ sim',mg.left+pW-65,mg.top+24);
}

// ============================================================
// Time series (generic)
// ============================================================
function renderTimeSeries(ctx, canvas, history, label, color, showZeroLine) {
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  if (history.length<2) return;

  const mg={left:45,right:10,top:10,bottom:20}, pW=W-mg.left-mg.right, pH=H-mg.top-mg.bottom;
  let minV=Infinity, maxV=-Infinity;
  for (const [,v] of history) { if(v<minV) minV=v; if(v>maxV) maxV=v; }
  const range=maxV-minV||1;
  minV-=range*0.1; maxV+=range*0.1;

  if (showZeroLine && minV<0 && maxV>0) {
    const zy = mg.top+pH-((0-minV)/(maxV-minV))*pH;
    ctx.strokeStyle='#445'; ctx.setLineDash([4,4]); ctx.beginPath();
    ctx.moveTo(mg.left,zy); ctx.lineTo(mg.left+pW,zy); ctx.stroke(); ctx.setLineDash([]);
  }

  const tMin=history[0][0], tRange=history[history.length-1][0]-tMin||1;
  ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.beginPath();
  for (let i=0;i<history.length;i++) {
    const px=mg.left+((history[i][0]-tMin)/tRange)*pW;
    const py=mg.top+pH-((history[i][1]-minV)/(maxV-minV))*pH;
    i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
  }
  ctx.stroke();

  ctx.strokeStyle='#445'; ctx.lineWidth=1; ctx.beginPath();
  ctx.moveTo(mg.left,mg.top); ctx.lineTo(mg.left,mg.top+pH);
  ctx.lineTo(mg.left+pW,mg.top+pH); ctx.stroke();

  ctx.fillStyle='#667'; ctx.font='10px Courier New';
  ctx.textAlign='center'; ctx.fillText('time',mg.left+pW/2,H-2);
  ctx.textAlign='right';
  ctx.fillText(maxV.toFixed(3),mg.left-3,mg.top+10);
  ctx.fillText(minV.toFixed(3),mg.left-3,mg.top+pH);
  ctx.textAlign='left'; ctx.fillText(label,2,mg.top+10);
}

// ============================================================
// Sweep charts
// ============================================================
function renderSweepLegend(ctx, mg) {
  ctx.font='9px Courier New'; ctx.textAlign='left';
  let ly = mg.top + 10;
  ctx.fillStyle='#e9c46a'; ctx.fillText('— local',mg.left+4,ly);
  ly += 11;
  if (baselineFixedDT !== null) {
    ctx.fillStyle='#e76f51'; ctx.fillText('-- fixed',mg.left+4,ly);
    ly += 11;
  }
  if (baselineAdaptiveDT !== null) {
    ctx.fillStyle='#2a9d8f'; ctx.fillText('-- adaptive',mg.left+4,ly);
  }
}

function drawBaselines(ctx, mg, pW, pH, fixedVal, adaptiveVal, maxVal) {
  if (fixedVal !== null) {
    const by = mg.top + pH - (fixedVal/maxVal)*pH;
    ctx.strokeStyle='#e76f51'; ctx.lineWidth=1.5;
    ctx.setLineDash([8,4]); ctx.beginPath();
    ctx.moveTo(mg.left,by); ctx.lineTo(mg.left+pW,by);
    ctx.stroke(); ctx.setLineDash([]);
  }
  if (adaptiveVal !== null) {
    const by = mg.top + pH - (adaptiveVal/maxVal)*pH;
    ctx.strokeStyle='#2a9d8f'; ctx.lineWidth=1.5;
    ctx.setLineDash([8,4]); ctx.beginPath();
    ctx.moveTo(mg.left,by); ctx.lineTo(mg.left+pW,by);
    ctx.stroke(); ctx.setLineDash([]);
  }
}

function drawSweepPoints(ctx, mg, pW, pH, data, yKey, maxVal) {
  if (data.length === 0) return;
  ctx.fillStyle='#e9c46a';
  for (const r of data) {
    const px = mg.left + r.rL * pW;
    const py = mg.top + pH - (r[yKey]/maxVal)*pH;
    ctx.beginPath(); ctx.arc(px,py,4,0,2*Math.PI); ctx.fill();
  }
  if (data.length > 1) {
    const sorted = [...data].sort((a,b)=>a.rL-b.rL);
    ctx.strokeStyle='#e9c46a'; ctx.lineWidth=1.5; ctx.beginPath();
    for (let i=0;i<sorted.length;i++) {
      const px = mg.left + sorted[i].rL * pW;
      const py = mg.top + pH - (sorted[i][yKey]/maxVal)*pH;
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    }
    ctx.stroke();
  }
}

function drawAxes(ctx, mg, pW, pH) {
  ctx.strokeStyle='#445'; ctx.lineWidth=1; ctx.beginPath();
  ctx.moveTo(mg.left,mg.top); ctx.lineTo(mg.left,mg.top+pH);
  ctx.lineTo(mg.left+pW,mg.top+pH); ctx.stroke();
}

function renderSweep() {
  const W=sweepCanvas.width, H=sweepCanvas.height;
  sweepCtx.clearRect(0,0,W,H);
  const mg={left:45,right:10,top:10,bottom:20}, pW=W-mg.left-mg.right, pH=H-mg.top-mg.bottom;

  let maxDT=0;
  for (const r of sweepResults) if(Math.abs(r.finalDT)>maxDT) maxDT=Math.abs(r.finalDT);
  if (baselineFixedDT!==null && Math.abs(baselineFixedDT)>maxDT) maxDT=Math.abs(baselineFixedDT);
  if (baselineAdaptiveDT!==null && Math.abs(baselineAdaptiveDT)>maxDT) maxDT=Math.abs(baselineAdaptiveDT);
  maxDT = maxDT*1.2 || 0.1;

  drawBaselines(sweepCtx, mg, pW, pH, baselineFixedDT, baselineAdaptiveDT, maxDT);
  drawSweepPoints(sweepCtx, mg, pW, pH, sweepResults, 'finalDT', maxDT);
  drawAxes(sweepCtx, mg, pW, pH);

  sweepCtx.fillStyle='#667'; sweepCtx.font='10px Courier New';
  sweepCtx.textAlign='center'; sweepCtx.fillText('r/L',mg.left+pW/2,H-2);
  sweepCtx.textAlign='right';
  sweepCtx.fillText(maxDT.toFixed(2),mg.left-3,mg.top+10);
  sweepCtx.fillText('0',mg.left-3,mg.top+pH);

  renderSweepLegend(sweepCtx, mg);
}

function renderSweepTime() {
  const W=timeCanvas.width, H=timeCanvas.height;
  timeCtx.clearRect(0,0,W,H);
  const mg={left:45,right:10,top:10,bottom:20}, pW=W-mg.left-mg.right, pH=H-mg.top-mg.bottom;

  let maxTime = 0;
  if (baselineFixedTime !== null && baselineFixedTime > maxTime) maxTime = baselineFixedTime;
  if (baselineAdaptiveTime !== null && baselineAdaptiveTime > maxTime) maxTime = baselineAdaptiveTime;
  for (const r of sweepResults) if (r.steadyT > maxTime) maxTime = r.steadyT;
  maxTime = maxTime * 1.2 || 100;

  drawBaselines(timeCtx, mg, pW, pH, baselineFixedTime, baselineAdaptiveTime, maxTime);
  drawSweepPoints(timeCtx, mg, pW, pH, sweepResults, 'steadyT', maxTime);
  drawAxes(timeCtx, mg, pW, pH);

  timeCtx.fillStyle='#667'; timeCtx.font='10px Courier New';
  timeCtx.textAlign='center'; timeCtx.fillText('r/L',mg.left+pW/2,H-2);
  timeCtx.textAlign='right';
  timeCtx.fillText(maxTime.toFixed(0),mg.left-3,mg.top+10);
  timeCtx.fillText('0',mg.left-3,mg.top+pH);
  timeCtx.textAlign='left'; timeCtx.fillText('t',2,mg.top+10);

  renderSweepLegend(timeCtx, mg);
}

// ============================================================
// Stats bar
// ============================================================
function updateStats() {
  const ke = computeKE();
  const drift = initialKE>0 ? ((ke-initialKE)/initialKE*100) : 0;
  const { tL, tR, nL, nR } = computeSideTemps();
  const currentS = computeEntropy(tL, nL, tR, nR);
  const deltaS = (currentS - initialS) / N;

  document.getElementById('statTL').textContent = tL.toFixed(3);
  document.getElementById('statTR').textContent = tR.toFixed(3);
  document.getElementById('statNL').textContent = nL;
  document.getElementById('statNR').textContent = nR;
  document.getElementById('statDS').textContent = deltaS.toFixed(4);

  const driftEl = document.getElementById('statDrift');
  driftEl.textContent = drift.toFixed(4)+'%';
  driftEl.className = Math.abs(drift)>0.1?'warn':'ok';

  document.getElementById('statBits').textContent = totalBits.toFixed(1);
  document.getElementById('statFPS').textContent = currentFps;
  document.getElementById('statTime').textContent = simTime.toFixed(1);

  const steadyEl = document.getElementById('statSteady');
  if (isSteady) {
    steadyEl.textContent = 'STEADY @ t='+steadyTime.toFixed(1);
    steadyEl.className = 'ok';
  } else {
    steadyEl.textContent = '';
  }
}
