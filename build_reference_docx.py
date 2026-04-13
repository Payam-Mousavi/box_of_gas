# /// script
# requires-python = ">=3.10"
# dependencies = ["python-docx>=1.1"]
# ///
"""Build reference.docx for pandoc styling.

Starts from pandoc's default reference, then sets a clean academic look:
- Body: Calibri 11pt
- Headings: Calibri bold, dark navy, descending sizes
- Tables: centered, grid borders, shaded navy header row with white bold text,
  alternating row banding
- Figures and captions centered on the page
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

HERE = Path(__file__).resolve().parent
REFERENCE = HERE / "reference.docx"

NAVY = RGBColor(0x1F, 0x38, 0x64)
NAVY_HEX = "1F3864"
BAND_HEX = "E8EEF7"  # very light blue for alternating rows
BORDER_HEX = "8FA3C4"
BODY_FONT = "Calibri"
MONO_FONT = "Consolas"


def regenerate_default() -> None:
    with REFERENCE.open("wb") as fh:
        subprocess.run(
            ["pandoc", "--print-default-data-file", "reference.docx"],
            stdout=fh,
            check=True,
        )


def set_font(style, name: str, size_pt: float, bold: bool = False, color: RGBColor | None = None) -> None:
    style.font.name = name
    style.font.size = Pt(size_pt)
    style.font.bold = bold
    if color is not None:
        style.font.color.rgb = color
    rpr = style.element.get_or_add_rPr()
    r_fonts = rpr.find(qn("w:rFonts"))
    if r_fonts is None:
        r_fonts = OxmlElement("w:rFonts")
        rpr.append(r_fonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        r_fonts.set(qn(attr), name)


def make_shd(fill_hex: str):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill_hex)
    return shd


def make_borders(tag: str, color_hex: str = BORDER_HEX, sz: str = "4") -> OxmlElement:
    borders = OxmlElement(f"w:{tag}")
    edges = ("top", "left", "bottom", "right", "insideH", "insideV") if tag == "tblBorders" else ("top", "left", "bottom", "right")
    for edge in edges:
        b = OxmlElement(f"w:{edge}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), sz)
        b.set(qn("w:space"), "0")
        b.set(qn("w:color"), color_hex)
        borders.append(b)
    return borders


def replace_child(parent, tag: str, new_child) -> None:
    existing = parent.find(qn(f"w:{tag}"))
    if existing is not None:
        parent.remove(existing)
    parent.append(new_child)


def style_tables(doc) -> None:
    target_styles = [s for s in doc.styles if s.name in ("Table", "Table Grid")]
    if not target_styles:
        return

    for style in target_styles:
        el = style.element

        # Table-level properties: center, borders, cell margins
        tbl_pr = el.find(qn("w:tblPr"))
        if tbl_pr is None:
            tbl_pr = OxmlElement("w:tblPr")
            el.append(tbl_pr)

        jc = OxmlElement("w:jc")
        jc.set(qn("w:val"), "center")
        replace_child(tbl_pr, "jc", jc)

        replace_child(tbl_pr, "tblBorders", make_borders("tblBorders"))

        cell_margin = OxmlElement("w:tblCellMar")
        for side, val in (("top", "80"), ("bottom", "80"), ("left", "120"), ("right", "120")):
            m = OxmlElement(f"w:{side}")
            m.set(qn("w:w"), val)
            m.set(qn("w:type"), "dxa")
            cell_margin.append(m)
        replace_child(tbl_pr, "tblCellMar", cell_margin)

        # Turn on first-row + banding look
        look = OxmlElement("w:tblLook")
        look.set(qn("w:val"), "04A0")
        look.set(qn("w:firstRow"), "1")
        look.set(qn("w:lastRow"), "0")
        look.set(qn("w:firstColumn"), "0")
        look.set(qn("w:lastColumn"), "0")
        look.set(qn("w:noHBand"), "0")
        look.set(qn("w:noVBand"), "1")
        replace_child(tbl_pr, "tblLook", look)

        # Remove any old conditional formatting before re-adding
        for existing in el.findall(qn("w:tblStylePr")):
            el.remove(existing)

        # First-row conditional formatting (header)
        first_row = OxmlElement("w:tblStylePr")
        first_row.set(qn("w:type"), "firstRow")

        fr_rpr = OxmlElement("w:rPr")
        fr_bold = OxmlElement("w:b")
        fr_rpr.append(fr_bold)
        fr_color = OxmlElement("w:color")
        fr_color.set(qn("w:val"), "FFFFFF")
        fr_rpr.append(fr_color)
        first_row.append(fr_rpr)

        fr_tcpr = OxmlElement("w:tcPr")
        fr_tcpr.append(make_shd(NAVY_HEX))
        first_row.append(fr_tcpr)

        el.append(first_row)

        # Banded rows (alternating light-blue shading)
        band = OxmlElement("w:tblStylePr")
        band.set(qn("w:type"), "band1Horz")
        band_tcpr = OxmlElement("w:tcPr")
        band_tcpr.append(make_shd(BAND_HEX))
        band.append(band_tcpr)
        el.append(band)


def center_paragraph_style(doc, name: str) -> None:
    if name not in [s.name for s in doc.styles]:
        return
    doc.styles[name].paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER


def main() -> None:
    regenerate_default()
    doc = Document(str(REFERENCE))

    set_font(doc.styles["Normal"], BODY_FONT, 11)

    heading_specs = [
        ("Heading 1", 20),
        ("Heading 2", 16),
        ("Heading 3", 13),
        ("Heading 4", 12),
    ]
    for name, size in heading_specs:
        if name in [s.name for s in doc.styles]:
            set_font(doc.styles[name], BODY_FONT, size, bold=True, color=NAVY)

    if "Title" in [s.name for s in doc.styles]:
        set_font(doc.styles["Title"], BODY_FONT, 26, bold=True, color=NAVY)

    for code_style in ("Source Code", "Verbatim Char"):
        if code_style in [s.name for s in doc.styles]:
            set_font(doc.styles[code_style], MONO_FONT, 10)

    # Center figures and their captions
    for fig_style in ("Figure", "Image Caption", "Caption"):
        center_paragraph_style(doc, fig_style)

    style_tables(doc)

    doc.save(str(REFERENCE))
    print(f"Saved: {REFERENCE}")


if __name__ == "__main__":
    main()
