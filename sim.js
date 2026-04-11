// ============================================================
// Constants
// ============================================================
const BOX_W = 100, BOX_H = 100, PARTITION_X = BOX_W / 2;
const SIM_CANVAS_W = 600, SIM_CANVAS_H = 740;
const SCALE_X = SIM_CANVAS_W / BOX_W;
const SCALE_Y = SIM_CANVAS_H / BOX_H;
const SCALE = Math.min(SCALE_X, SCALE_Y);

// ============================================================
// Simulation state
// ============================================================
let N, T, particleRadius;
let doorFraction = 0.3;
let demonType = 'none';
let localRadiusFrac = 0.1;

let x, y, vx, vy;
let cellSize, nCellsX, nCellsY, cells;
let dt = 0.02;
let simTime = 0;
let initialKE = 0, initialMeanSpeed = 0;
let initialS = 0;
let totalBits = 0;
let running = false, animId = null;
let doorCrossing;

// History
let keHistory = [], dtHistory = [], dsHistory = [];
const HISTORY_MAX = 500;

// Steady-state detection
const STEADY_LOOKBACK = 30;
const STEADY_REL_THRESH = 0.02;
const STEADY_ABS_THRESH = 0.005;
const STEADY_MIN_TIME = 100;
let isSteady = false;
let steadyTime = null;
let peakDT = 0;

// ============================================================
// Box-Muller normal random
// ============================================================
function randn() {
  let u, v, s;
  do { u = Math.random()*2-1; v = Math.random()*2-1; s = u*u+v*v; }
  while (s >= 1 || s === 0);
  return u * Math.sqrt(-2 * Math.log(s) / s);
}

// ============================================================
// Initialization
// ============================================================
function init(nParticles, temperature, radius) {
  N = nParticles; T = temperature; particleRadius = radius;

  const maxDt = 0.2 * particleRadius / (3 * Math.sqrt(T));
  dt = Math.min(0.02, maxDt);

  x = new Float64Array(N); y = new Float64Array(N);
  vx = new Float64Array(N); vy = new Float64Array(N);

  cellSize = Math.max(2 * particleRadius, 1.0);
  nCellsX = Math.ceil(BOX_W / cellSize);
  nCellsY = Math.ceil(BOX_H / cellSize);

  // Place particles via rejection sampling with spatial grid
  const minDist = 2 * particleRadius, minDist2 = minDist * minDist;
  const margin = particleRadius;
  let placed = 0, attempts = 0;
  const placeCellSize = minDist;
  const placeNX = Math.ceil(BOX_W / placeCellSize);
  const placeNY = Math.ceil(BOX_H / placeCellSize);
  const placeGrid = new Array(placeNX * placeNY);
  for (let i = 0; i < placeGrid.length; i++) placeGrid[i] = [];

  while (placed < N && attempts < N * 1000) {
    const px = margin + Math.random() * (BOX_W - 2*margin);
    const py = margin + Math.random() * (BOX_H - 2*margin);
    const ci = Math.floor(px / placeCellSize);
    const cj = Math.floor(py / placeCellSize);
    let overlap = false;
    outer:
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const ni = ci+di, nj = cj+dj;
        if (ni<0||ni>=placeNX||nj<0||nj>=placeNY) continue;
        for (const idx of placeGrid[ni*placeNY+nj]) {
          if ((px-x[idx])**2+(py-y[idx])**2 < minDist2) { overlap=true; break outer; }
        }
      }
    }
    if (!overlap) {
      x[placed]=px; y[placed]=py;
      placeGrid[ci*placeNY+cj].push(placed);
      placed++;
    }
    attempts++;
  }
  if (placed < N) { console.warn(`Placed ${placed}/${N}`); N = placed; }

  // Velocities from Maxwell-Boltzmann via Box-Muller
  const sigma = Math.sqrt(T);
  let sumVx=0, sumVy=0;
  for (let i=0;i<N;i++) { vx[i]=sigma*randn(); vy[i]=sigma*randn(); sumVx+=vx[i]; sumVy+=vy[i]; }
  // Remove net momentum
  const avgVx=sumVx/N, avgVy=sumVy/N;
  for (let i=0;i<N;i++) { vx[i]-=avgVx; vy[i]-=avgVy; }

  let sumSpeed=0;
  for (let i=0;i<N;i++) sumSpeed+=Math.sqrt(vx[i]*vx[i]+vy[i]*vy[i]);
  initialMeanSpeed = sumSpeed/N;

  simTime=0; totalBits=0;
  initialKE = computeKE();
  keHistory=[]; dtHistory=[]; dsHistory=[];
  isSteady=false; steadyTime=null; peakDT=0;
  doorCrossing = new Uint8Array(N);

  const s0 = computeSideTemps();
  initialS = computeEntropy(s0.tL, s0.nL, s0.tR, s0.nR);
}

// ============================================================
// Physics computations
// ============================================================
function computeKE() {
  let ke=0;
  for (let i=0;i<N;i++) ke += vx[i]*vx[i]+vy[i]*vy[i];
  return 0.5*ke;
}

function computeSideTemps() {
  let keL=0,keR=0,nL=0,nR=0;
  for (let i=0;i<N;i++) {
    const ke = 0.5*(vx[i]*vx[i]+vy[i]*vy[i]);
    if (x[i]<PARTITION_X) { keL+=ke; nL++; } else { keR+=ke; nR++; }
  }
  return { tL: nL>0?keL/nL:0, tR: nR>0?keR/nR:0, nL, nR };
}

// 2D ideal gas entropy: S = N * [ln(A/N) + ln(T) + const]
// Only ΔS matters so the constant cancels
function computeEntropy(tL, nL, tR, nR) {
  const aL = PARTITION_X * BOX_H;
  const aR = (BOX_W - PARTITION_X) * BOX_H;
  let s = 0;
  if (nL > 0) s += nL * (Math.log(aL/nL) + Math.log(Math.max(tL, 1e-10)));
  if (nR > 0) s += nR * (Math.log(aR/nR) + Math.log(Math.max(tR, 1e-10)));
  return s;
}

function computeSideStats(onLeft, excludeIdx) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < N; i++) {
    if (i === excludeIdx) continue;
    if ((x[i] < PARTITION_X) !== onLeft) continue;
    sum += Math.sqrt(vx[i]*vx[i] + vy[i]*vy[i]);
    count++;
  }
  return {
    mean: count > 0 ? sum / count : null,
    count,
  };
}

// ============================================================
// Steady-state detection
// ============================================================
function checkSteadyState() {
  if (isSteady) return;
  if (simTime < STEADY_MIN_TIME) return;
  if (dtHistory.length < 2) return;

  const lastDT = Math.abs(dtHistory[dtHistory.length-1][1]);
  if (lastDT > peakDT) peakDT = lastDT;

  const targetTime = simTime - STEADY_LOOKBACK;
  let oldIdx = -1;
  for (let i = dtHistory.length-1; i >= 0; i--) {
    if (dtHistory[i][0] <= targetTime) { oldIdx = i; break; }
  }
  if (oldIdx < 0) return;

  const oldDT = dtHistory[oldIdx][1];
  const newDT = dtHistory[dtHistory.length-1][1];
  const change = Math.abs(newDT - oldDT);

  const absPeak = Math.abs(peakDT);
  const nearZeroPeak = absPeak < STEADY_ABS_THRESH * 5;
  const relOk = absPeak > 0 ? (change / absPeak) < STEADY_REL_THRESH : false;
  const absOk = nearZeroPeak && Math.abs(newDT) < STEADY_ABS_THRESH && change < STEADY_ABS_THRESH;

  if (relOk || absOk) {
    isSteady = true;
    steadyTime = simTime;
  }
}

// ============================================================
// Cell list + collisions
// ============================================================
function buildCellList() {
  if (!cells || cells.length !== nCellsX*nCellsY) {
    cells = new Array(nCellsX*nCellsY);
    for (let i=0;i<cells.length;i++) cells[i]=[];
  } else {
    for (let i=0;i<cells.length;i++) cells[i].length=0;
  }
  for (let i=0;i<N;i++) {
    const ci = Math.min(Math.floor(x[i]/cellSize),nCellsX-1);
    const cj = Math.min(Math.floor(y[i]/cellSize),nCellsY-1);
    cells[ci*nCellsY+cj].push(i);
  }
}

function resolveCollision(i, j) {
  const dx=x[j]-x[i], dy=y[j]-y[i];
  const dist2 = dx*dx+dy*dy;
  const minDist = 2*particleRadius;
  if (dist2 >= minDist*minDist || dist2===0) return;
  const dist=Math.sqrt(dist2);
  const nx=dx/dist, ny=dy/dist;
  const dvn = (vx[i]-vx[j])*nx + (vy[i]-vy[j])*ny;
  if (dvn<=0) return;
  vx[i]-=dvn*nx; vy[i]-=dvn*ny;
  vx[j]+=dvn*nx; vy[j]+=dvn*ny;
  const sep = (minDist-dist)*0.5+0.001;
  x[i]-=sep*nx; y[i]-=sep*ny; x[j]+=sep*nx; y[j]+=sep*ny;
}

function handleCollisions() {
  buildCellList();
  for (let ci=0;ci<nCellsX;ci++) {
    for (let cj=0;cj<nCellsY;cj++) {
      const bucket = cells[ci*nCellsY+cj];
      for (let a=0;a<bucket.length;a++)
        for (let b=a+1;b<bucket.length;b++)
          resolveCollision(bucket[a],bucket[b]);
      const nbrs = [[ci+1,cj],[ci+1,cj+1],[ci,cj+1],[ci-1,cj+1]];
      for (const [ni,nj] of nbrs) {
        if (ni<0||ni>=nCellsX||nj<0||nj>=nCellsY) continue;
        const nb = cells[ni*nCellsY+nj];
        for (let a=0;a<bucket.length;a++)
          for (let b=0;b<nb.length;b++)
            resolveCollision(bucket[a],nb[b]);
      }
    }
  }
}

// ============================================================
// Walls + partition
// ============================================================
function handleWalls() {
  const doorHalf = (doorFraction*BOX_H)/2;
  const doorYMin = BOX_H/2-doorHalf, doorYMax = BOX_H/2+doorHalf;

  for (let i=0;i<N;i++) {
    if (x[i]<particleRadius)         { x[i]=particleRadius;           vx[i]=Math.abs(vx[i]); }
    if (x[i]>BOX_W-particleRadius)   { x[i]=BOX_W-particleRadius;    vx[i]=-Math.abs(vx[i]); }
    if (y[i]<particleRadius)         { y[i]=particleRadius;           vy[i]=Math.abs(vy[i]); }
    if (y[i]>BOX_H-particleRadius)   { y[i]=BOX_H-particleRadius;    vy[i]=-Math.abs(vy[i]); }

    if (Math.abs(x[i]-PARTITION_X) < particleRadius) {
      if (doorCrossing[i]) continue;

      const movingToward = (x[i] < PARTITION_X && vx[i] > 0) || (x[i] >= PARTITION_X && vx[i] < 0);
      if (!movingToward) continue;

      const inDoor = y[i]>=doorYMin && y[i]<=doorYMax;
      if (inDoor && doorPolicy(i)) {
        doorCrossing[i] = 1;
      } else {
        if (x[i]<PARTITION_X) { x[i]=PARTITION_X-particleRadius; vx[i]=-Math.abs(vx[i]); }
        else                  { x[i]=PARTITION_X+particleRadius; vx[i]=Math.abs(vx[i]); }
      }
    } else {
      doorCrossing[i] = 0;
    }
  }
}

// ============================================================
// Time step
// ============================================================
function step() {
  for (let i=0;i<N;i++) { x[i]+=vx[i]*dt; y[i]+=vy[i]*dt; }
  handleWalls();
  handleCollisions();
  simTime += dt;

  if (keHistory.length===0 || simTime - keHistory[keHistory.length-1][0] > 0.1) {
    const ke = computeKE();
    keHistory.push([simTime, ke]);
    if (keHistory.length > HISTORY_MAX) keHistory.shift();

    const { tL, tR, nL, nR } = computeSideTemps();
    dtHistory.push([simTime, tR-tL]);
    if (dtHistory.length > HISTORY_MAX) dtHistory.shift();

    const currentS = computeEntropy(tL, nL, tR, nR);
    const deltaS = (currentS - initialS) / N;
    dsHistory.push([simTime, deltaS]);
    if (dsHistory.length > HISTORY_MAX) dsHistory.shift();

    checkSteadyState();
  }
}
