// ============================================================
// Constants
// ============================================================
const BOX_W = 100, BOX_H = 100, PARTITION_X = BOX_W / 2;
const SIM_CANVAS_W = 600, SIM_CANVAS_H = 600;
const SCALE_X = SIM_CANVAS_W / BOX_W;
const SCALE_Y = SIM_CANVAS_H / BOX_H;
const SCALE = SCALE_X;

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
let queuedState;
let swapQueueLeft = [];
let swapQueueRight = [];

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
let steadyDT = null;
let steadyDS = null;
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
  doorCrossing = new Uint8Array(N);
  queuedState = new Uint8Array(N);
  swapQueueLeft = [];
  swapQueueRight = [];
  initialKE = computeKE();
  keHistory=[]; dtHistory=[]; dsHistory=[];
  isSteady=false; steadyTime=null; steadyDT=null; steadyDS=null; peakDT=0;

  const s0 = computeSideTemps();
  initialS = computeEntropy(s0.tL, s0.nL, s0.tR, s0.nR);
}

// ============================================================
// Physics computations
// ============================================================
function computeKE() {
  let ke=0;
  for (let i=0;i<N;i++) {
    if (queuedState[i]) continue; // queued particles are frozen, KE stored in queue
    ke += vx[i]*vx[i]+vy[i]*vy[i];
  }
  // Add back KE of queued particles from their saved velocities
  for (const entry of swapQueueLeft) {
    ke += entry.savedVx*entry.savedVx + entry.savedVy*entry.savedVy;
  }
  for (const entry of swapQueueRight) {
    ke += entry.savedVx*entry.savedVx + entry.savedVy*entry.savedVy;
  }
  return 0.5*ke;
}

function computeSideTemps() {
  let keL=0,keR=0,nL=0,nR=0;
  for (let i=0;i<N;i++) {
    if (queuedState[i]) continue; // counted separately below
    const ke = 0.5*(vx[i]*vx[i]+vy[i]*vy[i]);
    if (x[i] < PARTITION_X) { keL+=ke; nL++; } else { keR+=ke; nR++; }
  }
  // Queued particles belong to their original side with their saved KE
  for (const entry of swapQueueLeft) {
    const ke = 0.5*(entry.savedVx*entry.savedVx + entry.savedVy*entry.savedVy);
    keL+=ke; nL++;
  }
  for (const entry of swapQueueRight) {
    const ke = 0.5*(entry.savedVx*entry.savedVx + entry.savedVy*entry.savedVy);
    keR+=ke; nR++;
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
    if (queuedState[i]) continue; // queued particles excluded — counted below
    if ((x[i] < PARTITION_X) !== onLeft) continue;
    sum += Math.sqrt(vx[i]*vx[i] + vy[i]*vy[i]);
    count++;
  }
  // Add queued particles with their saved speeds
  const queue = onLeft ? swapQueueLeft : swapQueueRight;
  for (const entry of queue) {
    if (entry.idx === excludeIdx) continue;
    sum += Math.sqrt(entry.savedVx*entry.savedVx + entry.savedVy*entry.savedVy);
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

  // Measure the full range of ΔT over the lookback window — a curve that
  // rose to a peak and fell back to match the old value would otherwise
  // register as "steady" with just the endpoint comparison.
  let minDT = Infinity, maxDT = -Infinity;
  for (let i = oldIdx; i < dtHistory.length; i++) {
    const v = dtHistory[i][1];
    if (v < minDT) minDT = v;
    if (v > maxDT) maxDT = v;
  }
  const range = maxDT - minDT;
  const newDT = dtHistory[dtHistory.length-1][1];

  const absPeak = Math.abs(peakDT);
  const nearZeroPeak = absPeak < STEADY_ABS_THRESH * 5;
  const relOk = absPeak > 0 ? (range / absPeak) < STEADY_REL_THRESH : false;
  const absOk = nearZeroPeak && Math.abs(newDT) < STEADY_ABS_THRESH && range < STEADY_ABS_THRESH;

  if (relOk || absOk) {
    isSteady = true;
    steadyTime = simTime;
    const ss = computeSideTemps();
    steadyDT = ss.tR - ss.tL;
    const currentS = computeEntropy(ss.tL, ss.nL, ss.tR, ss.nR);
    steadyDS = (currentS - initialS) / N;
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
  if (queuedState[i] || queuedState[j]) return; // queued particles don't collide
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
    // Queued particles are frozen at the door — skip all wall/partition logic
    if (queuedState[i]) continue;

    if (x[i]<particleRadius)         { x[i]=particleRadius;           vx[i]=Math.abs(vx[i]); }
    if (x[i]>BOX_W-particleRadius)   { x[i]=BOX_W-particleRadius;    vx[i]=-Math.abs(vx[i]); }
    if (y[i]<particleRadius)         { y[i]=particleRadius;           vy[i]=Math.abs(vy[i]); }
    if (y[i]>BOX_H-particleRadius)   { y[i]=BOX_H-particleRadius;    vy[i]=-Math.abs(vy[i]); }

    if (Math.abs(x[i]-PARTITION_X) < particleRadius) {
      const onLeft = x[i] < PARTITION_X;

      const movingToward = (onLeft && vx[i] > 0) || (!onLeft && vx[i] < 0);
      if (!movingToward) continue;

      const inDoor = y[i]>=doorYMin && y[i]<=doorYMax;
      if (inDoor && doorPolicy(i)) {
        enqueueSwapCandidate(i, onLeft);
      } else {
        if (onLeft) { x[i]=PARTITION_X-particleRadius; vx[i]=-Math.abs(vx[i]); }
        else        { x[i]=PARTITION_X+particleRadius; vx[i]=Math.abs(vx[i]); }
      }
    } else {
      doorCrossing[i] = 0;
    }
  }
}

const QUEUE_MAX_WAIT = 1;        // sim-seconds a lone candidate waits before release
const QUEUE_MAX_IMBALANCE = 1;   // hard cap on how much longer one queue may be than the other

function enqueueSwapCandidate(idx, onLeft) {
  // Proactive imbalance guard: if this side's queue already outnumbers the
  // other's, just reflect off the partition instead of piling up at the door.
  // Prevents pinning bias when the policy is asymmetric (e.g. god, adaptive).
  const thisLen = onLeft ? swapQueueLeft.length : swapQueueRight.length;
  const otherLen = onLeft ? swapQueueRight.length : swapQueueLeft.length;
  if (thisLen >= otherLen + QUEUE_MAX_IMBALANCE) {
    if (onLeft) { x[idx] = PARTITION_X - particleRadius; vx[idx] = -Math.abs(vx[idx]); }
    else        { x[idx] = PARTITION_X + particleRadius; vx[idx] = Math.abs(vx[idx]); }
    return;
  }

  // Save the particle's velocity before pinning
  const savedVxI = vx[idx];
  const savedVyI = vy[idx];

  queuedState[idx] = onLeft ? 1 : 2;
  // Pin at the door with zero velocity — excluded from physics while queued
  const epsilon = Math.max(0.05, particleRadius * 0.5);
  x[idx] = onLeft ? PARTITION_X - epsilon : PARTITION_X + epsilon;
  vx[idx] = 0;
  vy[idx] = 0;
  doorCrossing[idx] = 1;

  const entry = { idx, savedVx: savedVxI, savedVy: savedVyI, enqueueTime: simTime };
  if (onLeft) swapQueueLeft.push(entry);
  else swapQueueRight.push(entry);
  attemptSwap();
}

function attemptSwap() {
  while (swapQueueLeft.length > 0 && swapQueueRight.length > 0) {
    const left = swapQueueLeft.shift();
    const right = swapQueueRight.shift();
    performSwap(left, right);
  }
}

function releaseQueuedParticle(entry, onLeft) {
  const i = entry.idx;
  // Preserve original velocity (no non-physical reflection kick). Place the
  // particle well inside its own side so it has to traverse before the next
  // door interaction — gives collisions a chance to rethermalize it.
  const backoff = 2 * particleRadius + 0.1;
  queuedState[i] = 0;
  doorCrossing[i] = 0;
  x[i] = onLeft ? PARTITION_X - backoff : PARTITION_X + backoff;
  vx[i] = entry.savedVx;
  vy[i] = entry.savedVy;
}

function drainStaleQueueEntries() {
  // Queues are append-only, so oldest entries are at the front.
  // 1) Time-based release: any lone candidate whose partner never arrives goes home.
  while (swapQueueLeft.length > 0 && simTime - swapQueueLeft[0].enqueueTime > QUEUE_MAX_WAIT) {
    releaseQueuedParticle(swapQueueLeft.shift(), true);
  }
  while (swapQueueRight.length > 0 && simTime - swapQueueRight[0].enqueueTime > QUEUE_MAX_WAIT) {
    releaseQueuedParticle(swapQueueRight.shift(), false);
  }
  // 2) Imbalance cap: prevent one side from visibly piling up at the door.
  while (swapQueueLeft.length > swapQueueRight.length + QUEUE_MAX_IMBALANCE) {
    releaseQueuedParticle(swapQueueLeft.shift(), true);
  }
  while (swapQueueRight.length > swapQueueLeft.length + QUEUE_MAX_IMBALANCE) {
    releaseQueuedParticle(swapQueueRight.shift(), false);
  }
}

function performSwap(left, right) {
  const leftIdx = left.idx;
  const rightIdx = right.idx;
  const epsilon = particleRadius + 0.1;

  queuedState[leftIdx] = 0;
  queuedState[rightIdx] = 0;
  doorCrossing[leftIdx] = 0;
  doorCrossing[rightIdx] = 0;

  // Left particle moves to right side — restore saved velocity, ensure vx points right
  x[leftIdx] = PARTITION_X + epsilon;
  vx[leftIdx] = Math.abs(left.savedVx);
  vy[leftIdx] = left.savedVy;

  // Right particle moves to left side — restore saved velocity, ensure vx points left
  x[rightIdx] = PARTITION_X - epsilon;
  vx[rightIdx] = -Math.abs(right.savedVx);
  vy[rightIdx] = right.savedVy;
}

// ============================================================
// Time step
// ============================================================
function step() {
  for (let i=0;i<N;i++) {
    if (queuedState[i]) continue; // frozen at door
    x[i]+=vx[i]*dt; y[i]+=vy[i]*dt;
  }
  handleWalls();
  handleCollisions();
  simTime += dt;
  drainStaleQueueEntries();

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
