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
    // Per-side mean: "is this particle faster than average for its side?"
    // This is the optimal use of global info and the true upper bound
    const stats = computeDoorDirectedStats(onLeft);
    const infoPool = stats.directionalCount || stats.sideCount || N;
    totalBits += Math.log2(infoPool + 1);
    const threshold =
      (stats.directionalMean ?? stats.sideMean ?? initialMeanSpeed);
    return onLeft ? speed > threshold : speed < threshold;
  }

  if (demonType === 'local') {
    // Poll same-side neighbors within radius r moving toward the door
    const r = localRadiusFrac * BOX_W;
    const r2 = r * r;
    let sumSpd=0, count=0;
    for (let j=0;j<N;j++) {
      if (j===i) continue;
      if ((x[j]<PARTITION_X) !== onLeft) continue;
      if (onLeft && vx[j]<=0) continue;
      if (!onLeft && vx[j]>=0) continue;
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
