#!/usr/bin/env python3
"""Convert REPORT.md into a formatted Word document using pandoc."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPORT_MD = HERE / "REPORT.md"
OUTPUT = HERE / "report.docx"


def convert() -> None:
    cmd = [
        "pandoc",
        str(REPORT_MD),
        "-o", str(OUTPUT),
        "--from", "markdown",
        "--to", "docx",
        "--resource-path", str(HERE),
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except FileNotFoundError:
        print("Error: pandoc is not installed. Install with: brew install pandoc", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"pandoc failed:\n{e.stderr}", file=sys.stderr)
        sys.exit(1)

    print(f"Saved: {OUTPUT}")


if __name__ == "__main__":
    convert()
