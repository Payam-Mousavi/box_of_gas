#!/usr/bin/env python3
"""
Analyze data exported from the Box of Gas simulator.

Usage:
  python3 analyze_export.py path/to/export.csv [--out plots_dir] [--show]

The script expects the CSV produced by the in-app “Export CSV” button. It
recreates the time-series and r-sweep plots, optionally saving additional
visualizations that highlight entropy change, steady-state times, and the
demon’s information use.
"""

from __future__ import annotations

import argparse
import csv
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import matplotlib.pyplot as plt

TIME_HEADER = ["time", "KE", "deltaT", "deltaS_per_particle"]
SWEEP_HEADER = ["r_over_L", "final_deltaT", "final_deltaS", "total_bits", "steady_time"]


@dataclass
class TimeSample:
  time: float
  ke: float
  delta_t: float
  delta_s: float


@dataclass
class SweepSample:
  r_over_l: float
  final_delta_t: float
  final_delta_s: float
  total_bits: float
  steady_time: float


def _safe_float(value: str) -> Optional[float]:
  value = value.strip()
  if not value:
    return None
  try:
    return float(value)
  except ValueError:
    return None


def parse_export(path: Path) -> Dict[str, object]:
  time_series: List[TimeSample] = []
  sweep_samples: List[SweepSample] = []
  baselines: Dict[str, float] = {}

  with path.open("r", encoding="utf-8") as csv_file:
    reader = csv.reader(csv_file)
    mode: Optional[str] = None
    for raw_row in reader:
      if not raw_row:
        continue
      row = [cell.strip() for cell in raw_row]
      header = row[0]

      if header == TIME_HEADER[0]:
        mode = "time"
        continue
      if header == "r_sweep_results":
        mode = "sweep_meta"
        continue
      if header.startswith("baseline_classical_"):
        if len(row) >= 2:
          val = _safe_float(row[1])
          if val is not None:
            baselines[header] = val
        continue
      if row == SWEEP_HEADER:
        mode = "sweep"
        continue

      if mode == "time":
        if len(row) < len(TIME_HEADER):
          continue
        time_val = _safe_float(row[0])
        ke_val = _safe_float(row[1])
        dt_val = _safe_float(row[2])
        ds_val = _safe_float(row[3])
        if None in (time_val, ke_val, dt_val, ds_val):
          continue
        time_series.append(TimeSample(time_val, ke_val, dt_val, ds_val))
      elif mode == "sweep":
        if len(row) < len(SWEEP_HEADER):
          continue
        parsed = [_safe_float(cell) for cell in row[: len(SWEEP_HEADER)]]
        if any(val is None for val in parsed):
          continue
        sweep_samples.append(
          SweepSample(
            r_over_l=parsed[0],
            final_delta_t=parsed[1],
            final_delta_s=parsed[2],
            total_bits=parsed[3],
            steady_time=parsed[4],
          )
        )

  return {"time_series": time_series, "sweep_samples": sweep_samples, "baselines": baselines}


def _ensure_output_dir(path: Path) -> Path:
  path.mkdir(parents=True, exist_ok=True)
  return path


def plot_time_series(samples: List[TimeSample], out_dir: Path, keep_open: bool = False):
  if not samples:
    return None, None
  times = [s.time for s in samples]
  ke = [s.ke for s in samples]
  delta_t = [s.delta_t for s in samples]
  delta_s = [s.delta_s for s in samples]

  fig, axes = plt.subplots(3, 1, figsize=(8, 8), sharex=True)
  axes[0].plot(times, ke, color="#8ecae6")
  axes[0].set_ylabel("KE")
  axes[0].grid(alpha=0.3)

  axes[1].plot(times, delta_t, color="#e76f51")
  axes[1].set_ylabel("ΔT")
  axes[1].axhline(0, color="#999", lw=0.8, ls="--")
  axes[1].grid(alpha=0.3)

  axes[2].plot(times, delta_s, color="#2a9d8f")
  axes[2].set_ylabel("ΔS/N")
  axes[2].set_xlabel("Time")
  axes[2].grid(alpha=0.3)

  fig.suptitle("Time-Series Diagnostics")
  fig.tight_layout()
  out_path = out_dir / "time_series.png"
  fig.savefig(out_path, dpi=150)
  if not keep_open:
    plt.close(fig)
    fig = None
  return out_path, fig


def plot_sweep_delta_t(samples: List[SweepSample], baselines: Dict[str, float], out_dir: Path, keep_open: bool = False):
  if not samples:
    return None, None
  samples_sorted = sorted(samples, key=lambda s: s.r_over_l)
  r = [s.r_over_l for s in samples_sorted]
  dt = [s.final_delta_t for s in samples_sorted]

  fig, ax = plt.subplots(figsize=(7, 4))
  ax.plot(r, dt, marker="o", color="#e9c46a", label="Local demon")

  fixed = baselines.get("baseline_classical_fixed_deltaT")
  if fixed is not None:
    ax.axhline(fixed, color="#e76f51", ls="--", label="Classical (fixed)")
  adaptive = baselines.get("baseline_classical_adaptive_deltaT")
  if adaptive is not None:
    ax.axhline(adaptive, color="#2a9d8f", ls="--", label="Classical (adaptive)")

  ax.set_xlabel("r / L")
  ax.set_ylabel("ΔT at steady state")
  ax.set_title("r-Sweep ΔT Comparison")
  ax.grid(alpha=0.3)
  ax.legend()

  out_path = out_dir / "sweep_deltaT.png"
  fig.tight_layout()
  fig.savefig(out_path, dpi=150)
  if not keep_open:
    plt.close(fig)
    fig = None
  return out_path, fig


def plot_sweep_time(samples: List[SweepSample], baselines: Dict[str, float], out_dir: Path, keep_open: bool = False):
  if not samples:
    return None, None
  samples_sorted = sorted(samples, key=lambda s: s.r_over_l)
  r = [s.r_over_l for s in samples_sorted]
  t = [s.steady_time for s in samples_sorted]

  fig, ax = plt.subplots(figsize=(7, 4))
  ax.plot(r, t, marker="o", color="#90be6d", label="Local demon")

  fixed_time = baselines.get("baseline_classical_fixed_steady_time")
  if fixed_time is not None:
    ax.axhline(fixed_time, color="#e76f51", ls="--", label="Classical (fixed)")
  adaptive_time = baselines.get("baseline_classical_adaptive_steady_time")
  if adaptive_time is not None:
    ax.axhline(adaptive_time, color="#2a9d8f", ls="--", label="Classical (adaptive)")

  ax.set_xlabel("r / L")
  ax.set_ylabel("Time to steady state")
  ax.set_title("r-Sweep Convergence Time")
  ax.grid(alpha=0.3)
  ax.legend()

  out_path = out_dir / "sweep_time.png"
  fig.tight_layout()
  fig.savefig(out_path, dpi=150)
  if not keep_open:
    plt.close(fig)
    fig = None
  return out_path, fig


def plot_bits_vs_r(samples: List[SweepSample], out_dir: Path, keep_open: bool = False):
  if not samples:
    return None, None
  samples_sorted = sorted(samples, key=lambda s: s.r_over_l)
  r = [s.r_over_l for s in samples_sorted]
  bits = [s.total_bits for s in samples_sorted]

  fig, ax = plt.subplots(figsize=(7, 4))
  ax.plot(r, bits, marker="o", color="#577590")
  ax.set_xlabel("r / L")
  ax.set_ylabel("Cumulative bits")
  ax.set_title("Information Cost of Local Decisions")
  ax.grid(alpha=0.3)

  out_path = out_dir / "bits_vs_r.png"
  fig.tight_layout()
  fig.savefig(out_path, dpi=150)
  if not keep_open:
    plt.close(fig)
    fig = None
  return out_path, fig


def plot_entropy_vs_delta_t(samples: List[SweepSample], out_dir: Path, keep_open: bool = False):
  if not samples:
    return None, None
  fig, ax = plt.subplots(figsize=(5, 5))
  sc = ax.scatter(
    [s.final_delta_t for s in samples],
    [s.final_delta_s for s in samples],
    c=[s.r_over_l for s in samples],
    cmap="viridis",
  )
  ax.set_xlabel("ΔT")
  ax.set_ylabel("ΔS/N")
  ax.set_title("Entropy vs Temperature Imbalance")
  cbar = fig.colorbar(sc, ax=ax)
  cbar.set_label("r / L")

  out_path = out_dir / "entropy_vs_deltaT.png"
  fig.tight_layout()
  fig.savefig(out_path, dpi=150)
  if not keep_open:
    plt.close(fig)
    fig = None
  return out_path, fig


def describe(samples: List[TimeSample], sweep_samples: List[SweepSample], baselines: Dict[str, float]) -> None:
  if samples:
    max_dt = max(samples, key=lambda s: abs(s.delta_t))
    print(f"Peak |ΔT|: {max_dt.delta_t:.4f} at t={max_dt.time:.2f}")
    max_ds = max(samples, key=lambda s: s.delta_s)
    print(f"Max ΔS/N: {max_ds.delta_s:.4f} at t={max_ds.time:.2f}")
  if sweep_samples:
    best = max(sweep_samples, key=lambda s: abs(s.final_delta_t))
    print(f"Best local policy: r/L={best.r_over_l:.2f}, ΔT={best.final_delta_t:.4f}, ΔS/N={best.final_delta_s:.5f}")
  if baselines:
    for name, val in baselines.items():
      print(f"{name}: {val:.4f}")


def main() -> None:
  parser = argparse.ArgumentParser(description="Analyze Box of Gas CSV export.")
  parser.add_argument("csv_path", type=Path, help="Path to CSV exported from the simulator")
  parser.add_argument("--out", type=Path, default=None, help="Directory to save plots (default: alongside CSV)")
  parser.add_argument("--show", action="store_true", help="Display plots interactively")
  args = parser.parse_args()

  csv_path: Path = args.csv_path.expanduser().resolve()
  if not csv_path.exists():
    print(f"CSV not found: {csv_path}", file=sys.stderr)
    sys.exit(1)

  data = parse_export(csv_path)
  time_series: List[TimeSample] = data["time_series"]  # type: ignore[assignment]
  sweep_samples: List[SweepSample] = data["sweep_samples"]  # type: ignore[assignment]
  baselines: Dict[str, float] = data["baselines"]  # type: ignore[assignment]

  if not time_series and not sweep_samples:
    print("No data found in CSV. Did you export from the simulator?", file=sys.stderr)
    sys.exit(1)

  out_dir = args.out or csv_path.with_suffix("")
  out_dir_path = _ensure_output_dir(Path(out_dir))

  outputs = []
  figures = []
  for func in (
    lambda keep: plot_time_series(time_series, out_dir_path, keep),
    lambda keep: plot_sweep_delta_t(sweep_samples, baselines, out_dir_path, keep),
    lambda keep: plot_sweep_time(sweep_samples, baselines, out_dir_path, keep),
    lambda keep: plot_bits_vs_r(sweep_samples, out_dir_path, keep),
    lambda keep: plot_entropy_vs_delta_t(sweep_samples, out_dir_path, keep),
  ):
    out_path, fig = func(args.show)
    if out_path:
      outputs.append(out_path)
    if fig is not None:
      figures.append(fig)

  describe(time_series, sweep_samples, baselines)

  saved = [str(path) for path in outputs]
  if saved:
    print("\nSaved plots:")
    for path in saved:
      print(f"  {path}")

  if args.show:
    plt.show()


if __name__ == "__main__":
  main()
