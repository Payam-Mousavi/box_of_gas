// ============================================================
// Demon door policies
//
// Each policy answers the question "should this arrival be queued for a
// paired swap?" sim.js maintains two FIFO queues (left→right candidates and
// right→left candidates) and only executes a swap when both queues are
// non-empty. That guarantees ΔN_L = ΔN_R = 0 at all times while still letting
// each policy run the same decision logic it would use for a single crossing.
// ============================================================

function doorPolicy(i) {
  if (demonType === 'none') return true;

  const speed = Math.sqrt(vx[i]*vx[i]+vy[i]*vy[i]);
  const onLeft = x[i] < PARTITION_X;

  if (demonType === 'classical-fixed') {
    // One-time global knowledge: initial mean speed as permanent threshold
    totalBits += Math.log2(N);
    return onLeft ? speed > initialMeanSpeed : speed < initialMeanSpeed;
  }

  if (demonType === 'classical-adaptive') {
    // Per-side mean of ALL particles: "is this particle faster than average for its side?"
    // Global-information benchmark — same mean-based rule as local, but complete sample
    const stats = computeSideStats(onLeft, i);
    const infoPool = stats.count || N;
    totalBits += Math.log2(infoPool + 1);
    const threshold = stats.mean ?? initialMeanSpeed;
    return onLeft ? speed > threshold : speed < threshold;
  }

  if (demonType === 'god') {
    // Optimal demon under paired swaps: one left candidate and one right candidate
    // cross simultaneously, so Δ(ΔT) = (e_left - e_right) * (1/N_L + 1/N_R).
    // The demon therefore enforces a single energy threshold θ that sits between
    // the two sides' temperatures. Left arrivals must have ½s² > θ, right arrivals
    // must have ½s² < θ, which guarantees e_left > e_right for every swap.
    const { tL, tR, nL, nR } = computeSideTemps();
    if (nL === 0 || nR === 0) return false;
    totalBits += Math.log2(N);
    const ke = 0.5 * speed * speed;
    const wR = 1 / nR;
    const wL = 1 / nL;
    const threshold = (wR * tR + wL * tL) / (wR + wL);
    return onLeft ? ke > threshold : ke < threshold;
  }

  if (demonType === 'local') {
    // Poll ALL same-side neighbors within radius r
    const r = localRadiusFrac * BOX_W;
    const r2 = r * r;
    let sumSpd=0, count=0;
    for (let j=0;j<N;j++) {
      if (j===i) continue;
      if (queuedState[j]) continue; // queued particles counted separately below
      if ((x[j]<PARTITION_X) !== onLeft) continue;
      if ((x[j]-x[i])**2+(y[j]-y[i])**2 <= r2) {
        sumSpd += Math.sqrt(vx[j]*vx[j]+vy[j]*vy[j]);
        count++;
      }
    }
    // Include queued particles from same side if within radius
    const queue = onLeft ? swapQueueLeft : swapQueueRight;
    for (const entry of queue) {
      if (entry.idx===i) continue;
      if ((x[entry.idx]-x[i])**2+(y[entry.idx]-y[i])**2 <= r2) {
        sumSpd += Math.sqrt(entry.savedVx*entry.savedVx+entry.savedVy*entry.savedVy);
        count++;
      }
    }
    totalBits += Math.log2(count+1);
    if (count===0) return false; // no information = no basis for decision
    const mean = sumSpd/count;
    return onLeft ? speed > mean : speed < mean;
  }

  return true;
}
