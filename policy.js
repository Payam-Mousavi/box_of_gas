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

  if (demonType === 'god') {
    // Optimal demon: pass iff the crossing increases ΔT = T_R - T_L.
    //
    // For a left→right crossing of particle with KE = ½s²:
    //   Δ(ΔT) = (½s² - T_R)/(N_R+1) + (½s² - T_L)/(N_L-1)
    //   Pass iff ½s² > (T_R/(N_R+1) + T_L/(N_L-1)) / (1/(N_R+1) + 1/(N_L-1))
    //
    // For a right→left crossing:
    //   Δ(ΔT) = (T_R - ½s²)/(N_R-1) - (½s² - T_L)/(N_L+1)
    //   Pass iff ½s² < (T_R/(N_R-1) + T_L/(N_L+1)) / (1/(N_R-1) + 1/(N_L+1))
    //
    // Both thresholds are weighted averages of T_R and T_L in energy space.
    const { tL, tR, nL, nR } = computeSideTemps();
    totalBits += Math.log2(N);
    const ke = 0.5 * speed * speed;
    if (onLeft) {
      // left→right: pass fast particles to the hot side
      if (nL <= 1) return false;
      const wR = 1 / (nR + 1);
      const wL = 1 / (nL - 1);
      const threshold = (wR * tR + wL * tL) / (wR + wL);
      return ke > threshold;
    } else {
      // right→left: pass slow particles to the cold side
      if (nR <= 1) return false;
      const wR = 1 / (nR - 1);
      const wL = 1 / (nL + 1);
      const threshold = (wR * tR + wL * tL) / (wR + wL);
      return ke < threshold;
    }
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
