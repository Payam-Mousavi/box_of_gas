#!/usr/bin/env python3
"""
Automate Box of Gas r-sweep experiments.

This script launches the existing browser simulation in headless Chromium via
Playwright, runs the full r-sweep for multiple seeds/parameter settings, saves
the exported CSVs, and (optionally) regenerates the analysis plots using the
analyzer module.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import threading
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, List, Optional
import sys

from playwright.async_api import Browser, Page, async_playwright

import analyze_export
from analyze_export import (
    SweepSample,
    TimeSample,
    parse_export,
    plot_bits_vs_r,
    plot_entropy_vs_delta_t,
    plot_sweep_delta_t,
    plot_sweep_time,
    plot_time_series,
)

ROOT = Path(__file__).resolve().parent


@dataclass
class SweepRunSummary:
    seed: int
    csv_path: str
    baseline_fixed_deltaT: Optional[float]
    baseline_adaptive_deltaT: Optional[float]
    baseline_fixed_steady_time: Optional[float]
    baseline_adaptive_steady_time: Optional[float]
    best_local_deltaT: Optional[float]
    best_local_r: Optional[float]
    best_local_bits: Optional[float]
    samples: List[Dict[str, float]]
    peak_abs_deltaT: Optional[float]
    max_entropy_drop: Optional[float]
    plots: Dict[str, str]


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Automate Box of Gas sweeps.")
    parser.add_argument("--seeds", type=int, default=8, help="number of sweeps to run")
    parser.add_argument("--seed-base", type=int, default=1000, help="starting seed value")
    parser.add_argument("--particles", type=int, default=500, help="slider N value")
    parser.add_argument("--temperature", type=float, default=1.0, help="slider T value")
    parser.add_argument("--radius", type=float, default=0.5, help="particle radius slider")
    parser.add_argument("--door", type=float, default=0.3, help="door fraction (0-1)")
    parser.add_argument("--headless", action="store_true", help="force headless browser (default)")
    parser.add_argument("--headed", dest="headless", action="store_false", help="show browser window")
    parser.set_defaults(headless=True)
    parser.add_argument(
        "--timeout",
        type=int,
        default=2400,
        help="max seconds to wait per sweep (<=0 disables)",
    )
    parser.add_argument("--out", type=Path, default=ROOT / "experiments_out", help="output directory")
    parser.add_argument("--skip-analysis", action="store_true", help="only collect CSV files")
    return parser


@contextlib.contextmanager
def serve_directory(directory: Path):
    class QuietHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def log_message(self, *_):
            pass

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{httpd.server_address[1]}"
    try:
        yield url
    finally:
        httpd.shutdown()
        thread.join()


SEED_JS = """
(seedValue) => {
  function mulberry32(a) {
    let t = a >>> 0;
    return function() {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(seedValue >>> 0);
  Math.random = () => rng();
}
"""


SET_CONTROLS_JS = """
(params) => {
  const setSlider = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  setSlider('sliderN', params.N);
  setSlider('sliderT', params.T);
  setSlider('sliderR', params.R);
  setSlider('sliderDoor', params.doorPercent);
  const demonSelect = document.getElementById('selectDemon');
  if (demonSelect) {
    demonSelect.value = 'local';
    demonSelect.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
"""


async def configure_page(page: Page, cfg: argparse.Namespace, seed: int) -> None:
    await page.wait_for_function("typeof window.init === 'function'")
    await page.evaluate(SEED_JS, seed)
    await page.evaluate(
        SET_CONTROLS_JS,
        {
            "N": cfg.particles,
            "T": cfg.temperature,
            "R": cfg.radius,
            "doorPercent": int(cfg.door * 100),
        },
    )
    await page.click("#btnReset")
    # ensure reset finished and UI ready
    await page.wait_for_timeout(200)


async def wait_for_sweep(page: Page, timeout_s: int) -> None:
    start = time.monotonic()
    last_status = ""
    sweep_started = False
    while True:
        result = await page.evaluate(
            """() => {
            const running = (typeof sweepRunning !== 'undefined') ? sweepRunning : false;
            const statusEl = document.getElementById('sweepStatus');
            return {
                done: running === false,
                running,
                status: statusEl ? statusEl.textContent || '' : ''
            };
        }"""
        )
        status = (result.get("status") or "").strip()
        if status and status != last_status:
            sys.stdout.write(f"\r[experiments] {status:70.70s}")
            sys.stdout.flush()
            last_status = status
        running_flag = bool(result.get("running"))
        if running_flag:
            sweep_started = True
        if sweep_started and bool(result.get("done")):
            if last_status:
                sys.stdout.write("\r" + " " * 80 + "\r")
                sys.stdout.flush()
            return
        if timeout_s > 0 and (time.monotonic() - start) > timeout_s:
            raise TimeoutError(f"sweep timed out after {timeout_s} seconds")
        await asyncio.sleep(1.0)


async def run_sweep(page: Page, csv_path: Path, timeout_s: int, label: str) -> None:
    sys.stdout.write(f"\r{label}\n")
    sys.stdout.flush()
    await page.click("#btnSweep")
    await wait_for_sweep(page, timeout_s)
    await page.wait_for_timeout(200)
    async with page.expect_download() as dl_info:
        await page.click("#btnExport")
    download = await dl_info.value
    await download.save_as(str(csv_path))


def summarize_run(csv_path: Path, plots_root: Optional[Path], make_plots: bool) -> SweepRunSummary:
    data = parse_export(csv_path)
    time_series: List[TimeSample] = data["time_series"]  # type: ignore[assignment]
    sweep_samples: List[SweepSample] = data["sweep_samples"]  # type: ignore[assignment]
    baselines: Dict[str, float] = data["baselines"]  # type: ignore[assignment]

    peak_abs_dt = max((abs(s.delta_t) for s in time_series), default=None)
    max_entropy_drop = min((s.delta_s for s in time_series), default=None)
    best_local = max(sweep_samples, key=lambda s: s.final_delta_t, default=None)
    samples_payload = [
        {
            "r_over_l": s.r_over_l,
            "final_deltaT": s.final_delta_t,
            "final_deltaS": s.final_delta_s,
            "total_bits": s.total_bits,
            "steady_time": s.steady_time,
        }
        for s in sweep_samples
    ]

    plots: Dict[str, str] = {}
    if make_plots:
        assert plots_root is not None
        plots_root.mkdir(parents=True, exist_ok=True)
        ts_path, _ = plot_time_series(time_series, plots_root)
        dt_path, _ = plot_sweep_delta_t(sweep_samples, baselines, plots_root)
        tt_path, _ = plot_sweep_time(sweep_samples, baselines, plots_root)
        bits_path, _ = plot_bits_vs_r(sweep_samples, plots_root)
        entropy_path, _ = plot_entropy_vs_delta_t(sweep_samples, plots_root)
        if ts_path:
            plots["time_series"] = str(ts_path)
        if dt_path:
            plots["deltaT_vs_r"] = str(dt_path)
        if tt_path:
            plots["steady_time_vs_r"] = str(tt_path)
        if bits_path:
            plots["bits_vs_r"] = str(bits_path)
        if entropy_path:
            plots["entropy_vs_deltaT"] = str(entropy_path)

    return SweepRunSummary(
        seed=int(csv_path.stem.split("_")[-1]),
        csv_path=str(csv_path),
        baseline_fixed_deltaT=baselines.get("baseline_classical_fixed_deltaT"),
        baseline_adaptive_deltaT=baselines.get("baseline_classical_adaptive_deltaT"),
        baseline_fixed_steady_time=baselines.get("baseline_classical_fixed_steady_time"),
        baseline_adaptive_steady_time=baselines.get("baseline_classical_adaptive_steady_time"),
        best_local_deltaT=best_local.final_delta_t if best_local else None,
        best_local_r=best_local.r_over_l if best_local else None,
        best_local_bits=best_local.total_bits if best_local else None,
        samples=samples_payload,
        peak_abs_deltaT=peak_abs_dt,
        max_entropy_drop=max_entropy_drop,
        plots=plots,
    )


async def run_single_experiment(
    browser: Browser,
    base_url: str,
    cfg: argparse.Namespace,
    seed: int,
    csv_path: Path,
) -> None:
    page = await browser.new_page()
    await page.goto(f"{base_url}/index.html")
    await configure_page(page, cfg, seed)
    await run_sweep(page, csv_path, cfg.timeout, label=f"[experiments] Seed {seed} running")
    await page.close()


def render_progress(current: int, total: int, suffix: str = "") -> None:
    bar_width = 30
    filled = int(bar_width * current / max(total, 1))
    bar = "#" * filled + "-" * (bar_width - filled)
    text = f"[experiments] [{bar}] {current}/{total}"
    if suffix:
        text += f" {suffix}"
    sys.stdout.write("\r" + text)
    sys.stdout.flush()
    if current == total:
        sys.stdout.write("\n")
        sys.stdout.flush()


async def main_async(cfg: argparse.Namespace) -> None:
    cfg.out.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    csv_dir = cfg.out / f"csv_{timestamp}"
    csv_dir.mkdir(parents=True, exist_ok=True)
    plots_dir = cfg.out / f"plots_{timestamp}"
    summaries: List[SweepRunSummary] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=cfg.headless)
        with serve_directory(ROOT) as base_url:
            for i in range(cfg.seeds):
                seed = cfg.seed_base + i
                stem = f"seed_{seed:04d}"
                csv_path = csv_dir / f"{stem}.csv"
                print(f"[experiments] Running sweep for seed {seed} ...")
                await run_single_experiment(browser, base_url, cfg, seed, csv_path)
                print(f"[experiments] Saved CSV -> {csv_path}")
                plots_target = None if cfg.skip_analysis else plots_dir / stem
                summary = summarize_run(csv_path, plots_target, not cfg.skip_analysis)
                summary.seed = seed
                summaries.append(summary)
                render_progress(i + 1, cfg.seeds, suffix=f"seed {seed} complete")
        await browser.close()

    summary_path = cfg.out / f"experiments_summary_{timestamp}.json"
    payload = [asdict(s) for s in summaries]
    summary_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[experiments] Saved summary -> {summary_path}")


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    try:
        asyncio.run(main_async(args))
    except KeyboardInterrupt:
        print("\n[experiments] Interrupted by user.")


if __name__ == "__main__":
    main()
