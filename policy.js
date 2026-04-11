// ============================================================
// Demon door policies
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

  if (demonType === 'local') {
    // Poll ALL same-side neighbors within radius r
    const r = localRadiusFrac * BOX_W;
    const r2 = r * r;
    let sumSpd=0, count=0;
    for (let j=0;j<N;j++) {
      if (j===i) continue;
      if ((x[j]<PARTITION_X) !== onLeft) continue;
      if ((x[j]-x[i])**2+(y[j]-y[i])**2 <= r2) {
        sumSpd += Math.sqrt(vx[j]*vx[j]+vy[j]*vy[j]);
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
