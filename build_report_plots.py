#!/usr/bin/env python3
"""Generate aggregate plots for REPORT.md using the latest experiments summary."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import matplotlib.pyplot as plt
import numpy as np

from analyze_export import TimeSample, parse_export, plot_time_series

ROOT = Path(__file__).resolve().parent
DEFAULT_OUT = ROOT / "report_plots"
DEFAULT_EXPERIMENTS = ROOT / "experiments_out"


def find_latest_summary(directory: Path) -> Path:
    candidates = sorted(directory.glob("experiments_summary_*.json"))
    if not candidates:
        raise FileNotFoundError(f"No experiments_summary_*.json found in {directory}")
    return candidates[-1]


def load_summary(summary_path: Path) -> List[Dict[str, object]]:
    return json.loads(summary_path.read_text())


def ensure_baseline_times(entry: Dict[str, object], csv_path: Path) -> List[TimeSample]:
    data = parse_export(csv_path)
    baselines: Dict[str, float] = data["baselines"]  # type: ignore[assignment]
    if entry.get("baseline_fixed_steady_time") is None:
        entry["baseline_fixed_steady_time"] = baselines.get("baseline_classical_fixed_steady_time")
    if entry.get("baseline_adaptive_steady_time") is None:
        entry["baseline_adaptive_steady_time"] = baselines.get("baseline_classical_adaptive_steady_time")
    if entry.get("baseline_fixed_deltaT") is None:
        entry["baseline_fixed_deltaT"] = baselines.get("baseline_classical_fixed_deltaT")
    if entry.get("baseline_adaptive_deltaT") is None:
        entry["baseline_adaptive_deltaT"] = baselines.get("baseline_classical_adaptive_deltaT")
    if entry.get("baseline_fixed_run_time") is None:
        entry["baseline_fixed_run_time"] = baselines.get("baseline_classical_fixed_run_time")
    if entry.get("baseline_adaptive_run_time") is None:
        entry["baseline_adaptive_run_time"] = baselines.get("baseline_classical_adaptive_run_time")
    return data["time_series"]  # type: ignore[return-value]


def aggregate_samples(entries: Iterable[Dict[str, object]]):
    per_r = defaultdict(
        lambda: {
            "deltaT": [],
            "bits": [],
            "entropy": [],
            "time": [],
            "ratio": [],
            "bits_per_time": [],
        }
    )
    flat_entropy: List[float] = []
    flat_delta_t: List[float] = []
    flat_r: List[float] = []
    for entry in entries:
        adapt = entry.get("baseline_adaptive_deltaT")
        for sample in entry["samples"]:  # type: ignore[index]
            r = sample["r_over_l"]
            per_r[r]["deltaT"].append(sample["final_deltaT"])
            per_r[r]["bits"].append(sample["total_bits"])
            per_r[r]["entropy"].append(sample["final_deltaS"])
            per_r[r]["time"].append(sample["steady_time"])
            if adapt:
                per_r[r]["ratio"].append(sample["final_deltaT"] / adapt)
            runtime = sample.get("run_time") or sample.get("steady_time")
            if runtime:
                per_r[r]["bits_per_time"].append(sample["total_bits"] / runtime)
            flat_delta_t.append(sample["final_deltaT"])
            flat_entropy.append(sample["final_deltaS"])
            flat_r.append(r)
    return per_r, np.array(flat_delta_t), np.array(flat_entropy), np.array(flat_r)


def stats_from_per_r(per_r: Dict[float, Dict[str, List[float]]], key: str) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    xs: List[float] = []
    mean_vals: List[float] = []
    std_vals: List[float] = []
    for r in sorted(per_r.keys()):
        vals = per_r[r][key]
        xs.append(r)
        mean_vals.append(float(np.mean(vals)))
        std_vals.append(float(np.std(vals)) if len(vals) > 1 else 0.0)
    return np.array(xs), np.array(mean_vals), np.array(std_vals)


def plot_with_band(
    x: np.ndarray,
    mean: np.ndarray,
    std: np.ndarray,
    ylabel: str,
    title: str,
    out_path: Path,
    color: str,
    baseline_lines: List[Tuple[str, float, Dict[str, object]]] | None = None,
):
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.plot(x, mean, color=color, label="Local mean")
    if std.any():
        ax.fill_between(x, mean - std, mean + std, color=color, alpha=0.2, label="±1σ")
    if baseline_lines:
        for label, value, style in baseline_lines:
            ax.axhline(value, label=label, **style)
    ax.set_xlabel("r / L")
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.grid(alpha=0.3)
    ax.legend()
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def plot_entropy_scatter(delta_t: np.ndarray, entropy: np.ndarray, r_values: np.ndarray, out_path: Path):
    fig, ax = plt.subplots(figsize=(5, 5))
    sc = ax.scatter(delta_t, entropy, c=r_values, cmap="viridis")
    ax.set_xlabel("ΔT")
    ax.set_ylabel("ΔS/N")
    ax.set_title("Entropy vs Temperature Imbalance")
    cbar = fig.colorbar(sc, ax=ax)
    cbar.set_label("r / L")
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def plot_tradeoff(
    centralization: np.ndarray,
    ratio_mean: np.ndarray,
    ratio_std: np.ndarray,
    info_mean: np.ndarray,
    out_path: Path,
) -> None:
    fig, ax = plt.subplots(figsize=(6.5, 4.5))
    sc = ax.scatter(centralization, ratio_mean * 100.0, c=info_mean, cmap="plasma", s=60)
    if ratio_std.any():
        ax.errorbar(
            centralization,
            ratio_mean * 100.0,
            yerr=np.maximum(ratio_std * 100.0, 1e-9),
            fmt="none",
            ecolor="#444",
            alpha=0.3,
        )
    ax.set_xlabel("Degree of centralization (r / L)")
    ax.set_ylabel("Sorting performance (% of adaptive ΔT)")
    ax.set_title("Centralization vs Information Cost vs Sorting")
    ax.grid(alpha=0.3)
    cbar = fig.colorbar(sc, ax=ax)
    cbar.set_label("Information cost (bits per sim-second)")
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate aggregate report plots from experiment summaries.")
    parser.add_argument("--summary", type=Path, default=None, help="Path to experiments_summary_*.json (default: latest)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Directory for generated plots")
    parser.add_argument(
        "--experiments-dir",
        type=Path,
        default=DEFAULT_EXPERIMENTS,
        help="Directory that contains experiments outputs",
    )
    parser.add_argument("--project-root", type=Path, default=ROOT, help="Project root for resolving CSV paths")
    args = parser.parse_args()

    experiments_dir = args.experiments_dir.resolve()
    if args.summary is None:
        summary_path = find_latest_summary(experiments_dir)
    else:
        summary_path = (args.summary if args.summary.is_absolute() else (ROOT / args.summary)).resolve()
    entries = load_summary(summary_path)

    first_time_series: List[TimeSample] | None = None
    for entry in entries:
        csv_rel = Path(entry["csv_path"])
        if not csv_rel.is_absolute():
            csv_path = (args.project_root / csv_rel).resolve()
        else:
            csv_path = csv_rel
        ts = ensure_baseline_times(entry, csv_path)
        if first_time_series is None and ts:
            first_time_series = ts

    per_r, flat_delta_t, flat_entropy, flat_r = aggregate_samples(entries)
    x_vals, dt_mean, dt_std = stats_from_per_r(per_r, "deltaT")
    _, time_mean, time_std = stats_from_per_r(per_r, "time")
    _, bits_mean, bits_std = stats_from_per_r(per_r, "bits")
    _, ratio_mean, ratio_std = stats_from_per_r(per_r, "ratio")
    _, info_mean, _ = stats_from_per_r(per_r, "bits_per_time")

    fixed_dt = [entry.get("baseline_fixed_deltaT") for entry in entries if entry.get("baseline_fixed_deltaT") is not None]
    adaptive_dt = [entry.get("baseline_adaptive_deltaT") for entry in entries if entry.get("baseline_adaptive_deltaT") is not None]
    fixed_time = [entry.get("baseline_fixed_steady_time") for entry in entries if entry.get("baseline_fixed_steady_time") is not None]
    adaptive_time = [entry.get("baseline_adaptive_steady_time") for entry in entries if entry.get("baseline_adaptive_steady_time") is not None]

    out_dir = args.out.resolve()

    dt_baselines: List[Tuple[str, float, Dict[str, object]]] = []
    if fixed_dt:
        dt_baselines.append(("Classical (fixed)", float(np.mean(fixed_dt)), {"color": "#e76f51", "ls": "--"}))
    if adaptive_dt:
        dt_baselines.append(("Classical (adaptive)", float(np.mean(adaptive_dt)), {"color": "#2a9d8f", "ls": "--"}))

    plot_with_band(
        x_vals,
        dt_mean,
        dt_std,
        ylabel="ΔT at steady state",
        title="r-Sweep ΔT (mean across seeds)",
        out_path=out_dir / "sweep_deltaT.png",
        color="#e9c46a",
        baseline_lines=dt_baselines or None,
    )

    time_baselines: List[Tuple[str, float, Dict[str, object]]] = []
    if fixed_time:
        time_baselines.append(("Classical (fixed)", float(np.mean(fixed_time)), {"color": "#e76f51", "ls": "--"}))
    if adaptive_time:
        time_baselines.append(("Classical (adaptive)", float(np.mean(adaptive_time)), {"color": "#2a9d8f", "ls": "--"}))

    plot_with_band(
        x_vals,
        time_mean,
        time_std,
        ylabel="Time to steady state",
        title="r-Sweep Convergence Time",
        out_path=out_dir / "sweep_time.png",
        color="#90be6d",
        baseline_lines=time_baselines or None,
    )

    plot_with_band(
        x_vals,
        bits_mean,
        bits_std,
        ylabel="Cumulative information bits",
        title="Information Cost vs Neighborhood Radius",
        out_path=out_dir / "bits_vs_r.png",
        color="#577590",
        baseline_lines=None,
    )

    plot_entropy_scatter(flat_delta_t, flat_entropy, flat_r, out_dir / "entropy_vs_deltaT.png")

    if ratio_mean.size and info_mean.size:
        plot_tradeoff(
            x_vals,
            ratio_mean,
            ratio_std,
            info_mean,
            out_dir / "centralization_tradeoff.png",
        )

    if first_time_series:
        plot_time_series(first_time_series, out_dir)

    print(f"Wrote plots to {out_dir}")


if __name__ == "__main__":
    main()
