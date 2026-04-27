#!/usr/bin/env python3
"""
Reusable Report Service — Options Action Scan PDF Generator.

Reads JSON from stdin with shape:
{
  "scanData": {
    "generatedAt": "...",
    "rows": [...],
    "disclaimer": "...",
    "planTier": "...",
    "truncated": false
  },
  "title": "Options Action Scan"
}

Writes PDF bytes to stdout.
"""

import io
import json
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


BRAND_DARK = colors.HexColor("#0f172a")
BRAND_ACCENT = colors.HexColor("#22c55e")
BRAND_MUTED = colors.HexColor("#64748b")
BRAND_BG_LIGHT = colors.HexColor("#1e293b")


@dataclass
class ReportRow:
    source: str
    symbol: str
    strike: Optional[float]
    exp: Optional[str]
    option_type: Optional[str]
    qty: Optional[float]
    recommended_action: str
    why: str
    urgency: str
    confidence: str
    target_window: str


@dataclass
class ReportPayload:
    generated_at: str
    plan_tier: str
    truncated: bool
    disclaimer: str
    title: str
    rows: List[ReportRow]


def _create_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=styles["Title"],
            fontSize=22,
            textColor=BRAND_DARK,
            alignment=TA_CENTER,
            fontName="Helvetica-Bold",
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReportSubtitle",
            parent=styles["Normal"],
            fontSize=10,
            textColor=BRAND_MUTED,
            alignment=TA_CENTER,
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionHeader",
            parent=styles["Heading2"],
            fontSize=13,
            textColor=BRAND_DARK,
            spaceBefore=14,
            spaceAfter=6,
            fontName="Helvetica-Bold",
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReportBody",
            parent=styles["Normal"],
            fontSize=9.5,
            textColor=BRAND_DARK,
            alignment=TA_JUSTIFY,
            leading=13,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCell",
            parent=styles["Normal"],
            fontSize=7.5,
            textColor=BRAND_DARK,
            leading=9,
        )
    )
    styles.add(
        ParagraphStyle(
            name="WhyCell",
            parent=styles["Normal"],
            fontSize=7,
            textColor=BRAND_MUTED,
            leading=9,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Disclaimer",
            parent=styles["Normal"],
            fontSize=6.5,
            textColor=BRAND_MUTED,
            alignment=TA_JUSTIFY,
            leading=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Footer",
            parent=styles["Normal"],
            fontSize=7,
            textColor=BRAND_MUTED,
            alignment=TA_CENTER,
        )
    )
    return styles


def _confidence_label(value: str) -> str:
    v = (value or "").strip().lower()
    if v == "high":
        return "HIGH ●●●"
    if v == "medium":
        return "MED ●●○"
    return "LOW ●○○"


def _instrument_label(row: ReportRow) -> str:
    if row.strike is None or not row.exp or not row.option_type:
        return row.symbol
    return f"{row.symbol} {row.strike:.2f} {row.option_type.upper()} ({row.exp})"


def _build_payload(data: Dict[str, Any]) -> ReportPayload:
    scan_data = data.get("scanData") if isinstance(data.get("scanData"), dict) else {}
    title = str(data.get("title") or "Options Action Scan")
    raw_rows = scan_data.get("rows") if isinstance(scan_data.get("rows"), list) else []
    rows: List[ReportRow] = []
    for raw in raw_rows:
        if not isinstance(raw, dict):
            continue
        rows.append(
            ReportRow(
                source=str(raw.get("source") or "watchlist"),
                symbol=str(raw.get("symbol") or "").strip().upper(),
                strike=float(raw.get("strike")) if isinstance(raw.get("strike"), (int, float)) else None,
                exp=str(raw.get("exp")).strip() if isinstance(raw.get("exp"), str) else None,
                option_type=str(raw.get("type")).strip().lower()
                if isinstance(raw.get("type"), str)
                else None,
                qty=float(raw.get("qty")) if isinstance(raw.get("qty"), (int, float)) else None,
                recommended_action=str(raw.get("recommendedAction") or "MONITOR"),
                why=str(raw.get("why") or "").strip(),
                urgency=str(raw.get("urgency") or "low").strip().lower(),
                confidence=str(raw.get("confidence") or "low").strip().lower(),
                target_window=str(raw.get("targetWindow") or "").strip(),
            )
        )
    generated_at_raw = str(scan_data.get("generatedAt") or "")
    try:
        generated_at = datetime.fromisoformat(generated_at_raw.replace("Z", "+00:00")).strftime(
            "%B %d, %Y • %I:%M:%S %p UTC"
        )
    except Exception:
        generated_at = generated_at_raw or datetime.utcnow().strftime("%B %d, %Y • %I:%M:%S %p UTC")
    return ReportPayload(
        generated_at=generated_at,
        plan_tier=str(scan_data.get("planTier") or "unknown"),
        truncated=bool(scan_data.get("truncated")),
        disclaimer=str(scan_data.get("disclaimer") or ""),
        title=title,
        rows=rows,
    )


def generate_options_action_scan_report(payload: ReportPayload) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.45 * inch,
        bottomMargin=0.5 * inch,
    )
    styles = _create_styles()
    story = []

    holdings = [row for row in payload.rows if row.source == "holding"]
    watchlist = [row for row in payload.rows if row.source == "watchlist"]
    high_conf = next((row.symbol for row in holdings if row.confidence == "high"), None)
    total_close = len(
        [
            row
            for row in holdings
            if row.recommended_action in {"STC", "BTC", "LET_EXPIRE"}
        ]
    )

    story.append(Paragraph("aTx Finance", styles["ReportTitle"]))
    story.append(Paragraph(payload.title, styles["ReportSubtitle"]))
    story.append(
        Paragraph(
            f"Generated: {payload.generated_at}  •  Plan tier: {payload.plan_tier.upper()}",
            styles["ReportSubtitle"],
        )
    )
    story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND_ACCENT, spaceBefore=2, spaceAfter=10))

    summary = (
        f"<b>{total_close} holdings recommended to close</b> • "
        f"<b>{len(watchlist)} watchlist symbols monitoring</b> • "
        f"<font color='#16a34a'><b>{'HIGH confidence on ' + high_conf if high_conf else 'No HIGH confidence signal'}</b></font><br/><br/>"
        "This report summarizes current option actions with urgency, confidence, and rationale to support "
        "advisor-grade decision workflows."
    )
    story.append(Paragraph("Executive Summary", styles["SectionHeader"]))
    story.append(Paragraph(summary, styles["ReportBody"]))

    metrics_data = [
        ["Close recommendations", str(total_close), "Rows scanned", str(len(payload.rows))],
        ["Holdings rows", str(len(holdings)), "Watchlist rows", str(len(watchlist))],
        ["High confidence rows", str(len([r for r in payload.rows if r.confidence == "high"])), "Truncated", "Yes" if payload.truncated else "No"],
    ]
    metrics_table = Table(metrics_data, colWidths=[2.0 * inch, 1.2 * inch, 2.0 * inch, 1.2 * inch])
    metrics_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("TEXTCOLOR", (0, 0), (0, -1), BRAND_MUTED),
                ("TEXTCOLOR", (2, 0), (2, -1), BRAND_MUTED),
                ("TEXTCOLOR", (1, 0), (1, -1), BRAND_DARK),
                ("TEXTCOLOR", (3, 0), (3, -1), BRAND_ACCENT),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
                ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
                ("ALIGN", (3, 0), (3, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("BOX", (0, 0), (-1, -1), 0.5, BRAND_MUTED),
            ]
        )
    )
    story.append(Spacer(1, 6))
    story.append(metrics_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Holdings — Recommended Close (STC)", styles["SectionHeader"]))
    story.append(_rows_table(holdings, styles))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Watchlist — Monitoring Queue", styles["SectionHeader"]))
    story.append(_rows_table(watchlist, styles))

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BRAND_MUTED, spaceBefore=4, spaceAfter=6))
    story.append(
        Paragraph(
            f"<b>IMPORTANT DISCLAIMER:</b> {payload.disclaimer or 'Not financial advice. Options trading involves substantial risk.'}",
            styles["Disclaimer"],
        )
    )
    story.append(Spacer(1, 4))
    story.append(
        Paragraph(
            f"Engine: OptionsStrategyEngine • © {datetime.utcnow().year} aTx Finance — Confidential",
            styles["Footer"],
        )
    )

    doc.build(story)
    return buffer.getvalue()


def _rows_table(rows: List[ReportRow], styles) -> Table:
    header = ["INSTRUMENT", "ACTION", "URGENCY", "CONFIDENCE", "EXP", "RATIONALE", "WINDOW"]
    table_data = [header]
    if not rows:
        table_data.append([Paragraph("No rows.", styles["TableCell"]), "", "", "", "", "", ""])
    else:
        for row in rows:
            table_data.append(
                [
                    Paragraph(_instrument_label(row), styles["TableCell"]),
                    Paragraph(f"<b>{row.recommended_action}</b>", styles["TableCell"]),
                    Paragraph(f"<b>{row.urgency.upper()}</b>", styles["TableCell"]),
                    Paragraph(f"<font color='#16a34a'><b>{_confidence_label(row.confidence)}</b></font>", styles["TableCell"]),
                    Paragraph(row.exp or "—", styles["TableCell"]),
                    Paragraph(row.why or "—", styles["WhyCell"]),
                    Paragraph(row.target_window or "—", styles["TableCell"]),
                ]
            )
    col_widths = [1.45 * inch, 0.65 * inch, 0.7 * inch, 0.95 * inch, 0.8 * inch, 2.4 * inch, 1.0 * inch]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND_BG_LIGHT),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 7),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.5, BRAND_MUTED),
                ("LINEBELOW", (0, 0), (-1, -2), 0.2, colors.HexColor("#e2e8f0")),
            ]
        )
    )
    return table


def _sample_payload() -> ReportPayload:
    return ReportPayload(
        generated_at=datetime.utcnow().strftime("%B %d, %Y • %I:%M:%S %p UTC"),
        plan_tier="premium_plus",
        truncated=False,
        disclaimer="Not financial advice. Options trading involves substantial risk of loss.",
        title="Options Action Scan Report",
        rows=[
            ReportRow(
                source="holding",
                symbol="TSLA",
                strike=375.0,
                exp="2026-05-01",
                option_type="call",
                qty=1,
                recommended_action="STC",
                why="High theta decay and low upside capture probability.",
                urgency="high",
                confidence="high",
                target_window="Today",
            )
        ],
    )


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--sample":
        pdf_bytes = generate_options_action_scan_report(_sample_payload())
        with open("/tmp/options_scan_report_sample.pdf", "wb") as f:
            f.write(pdf_bytes)
        print("Sample report written to /tmp/options_scan_report_sample.pdf")
        raise SystemExit(0)

    if len(sys.argv) > 1 and sys.argv[1] == "--stdin":
        try:
            raw = json.load(sys.stdin)
            payload = _build_payload(raw if isinstance(raw, dict) else {})
            pdf = generate_options_action_scan_report(payload)
            sys.stdout.buffer.write(pdf)
            raise SystemExit(0)
        except Exception as error:
            print(f"report_generation_failed: {error}", file=sys.stderr)
            raise SystemExit(1)

    print("Usage:", file=sys.stderr)
    print("  python3 options_scan_report.py --sample", file=sys.stderr)
    print("  cat payload.json | python3 options_scan_report.py --stdin > report.pdf", file=sys.stderr)
    raise SystemExit(2)
