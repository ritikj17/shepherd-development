from datetime import datetime, timezone
import io
import logging
from typing import Any, Optional
from uuid import UUID

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger("shepherd.reports.pdf")


class NumberedCanvas(io.BytesIO):
    """Custom canvas wrapper helper for page numbering if needed."""
    pass


def build_justicebridge_pdf(
    report_id: UUID,
    incident: Any,
    evidence_items: list[Any],
    analyses: list[Any],
    graph_data: Optional[Any] = None,
    include_evidence_index: bool = True,
    include_analysis: bool = True,
) -> bytes:
    """Generate a chronological, structured JusticeBridge PDF report using ReportLab."""
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=12,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
    )
    mono_style = ParagraphStyle(
        "MonospaceHash",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
    )
    notice_style = ParagraphStyle(
        "NoticeBox",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#7c2d12"),
    )
    notice_body = ParagraphStyle(
        "NoticeBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#9a3412"),
    )
    caption_style = ParagraphStyle(
        "CaptionText",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        spaceBefore=4,
    )

    elements = []

    # 1. Header Banner
    elements.append(Paragraph("SHEPHERD JusticeBridge", title_style))
    elements.append(
        Paragraph(
            "Women's Safety Intelligence & Early Response Network — Chronological Incident Summary",
            subtitle_style,
        )
    )

    # Metadata row
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    meta_text = (
        f"<b>Report ID:</b> {report_id} &nbsp;|&nbsp; "
        f"<b>Incident ID:</b> {incident.id} &nbsp;|&nbsp; "
        f"<b>Generated At:</b> {now_utc}"
    )
    elements.append(Paragraph(meta_text, body_style))
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=10))

    # 2. Mandatory Legal and Ethical Notice
    notice_content = [
        [
            Paragraph("IMPORTANT INFORMATIONAL & LEGAL DISCLAIMER", notice_style),
        ],
        [
            Paragraph(
                "This document is an informational incident summary generated automatically by SHEPHERD for user-directed "
                "documentation and record-keeping purposes only. It is <b>NOT</b> an official law enforcement report, "
                "emergency service dispatch, legal determination, or certification of evidence admissibility. "
                "SHEPHERD does not claim crime prediction, offender identification, or guaranteed authenticity. "
                "If you are in immediate danger, please contact local emergency authorities immediately.",
                notice_body,
            ),
        ],
    ]
    notice_table = Table(notice_content, colWidths=[532])
    notice_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff7ed")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#fdba74")),
                ("PADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, 0), 6),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
            ]
        )
    )
    elements.append(notice_table)
    elements.append(Spacer(1, 12))

    # 3. Incident Summary Section
    elements.append(Paragraph("1. Incident Record Summary", section_heading))

    occurred_str = (
        incident.occurred_at.strftime("%Y-%m-%d %H:%M:%S UTC")
        if hasattr(incident.occurred_at, "strftime")
        else str(incident.occurred_at)
    )
    category_str = incident.category.value if hasattr(incident.category, "value") else str(incident.category)
    status_str = incident.status.value if hasattr(incident.status, "value") else str(incident.status)

    incident_summary_data = [
        [Paragraph("<b>Title:</b>", body_style), Paragraph(incident.title, body_style)],
        [Paragraph("<b>Category:</b>", body_style), Paragraph(category_str, body_style)],
        [Paragraph("<b>Occurred At:</b>", body_style), Paragraph(occurred_str, body_style)],
        [
            Paragraph("<b>Location Context:</b>", body_style),
            Paragraph(incident.location_description or "None provided by user", body_style),
        ],
        [Paragraph("<b>Status:</b>", body_style), Paragraph(status_str.upper(), body_style)],
        [
            Paragraph("<b>Description:</b>", body_style),
            Paragraph(incident.description.replace("\n", "<br/>"), body_style),
        ],
    ]

    summary_table = Table(incident_summary_data, colWidths=[120, 412])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(summary_table)
    elements.append(Spacer(1, 14))

    # 4. Evidence Vault Audit Index
    if include_evidence_index:
        elements.append(Paragraph("2. Evidence Vault Cryptographic Index", section_heading))
        if evidence_items:
            evidence_rows = [
                [
                    Paragraph("<b>File Name</b>", body_style),
                    Paragraph("<b>MIME Type</b>", body_style),
                    Paragraph("<b>Size</b>", body_style),
                    Paragraph("<b>Uploaded (UTC)</b>", body_style),
                    Paragraph("<b>SHA-256 Hash</b>", body_style),
                ]
            ]
            for ev in evidence_items:
                size_kb = f"{ev.size_bytes / 1024:.1f} KB" if hasattr(ev, "size_bytes") else "N/A"
                up_time = (
                    ev.uploaded_at.strftime("%Y-%m-%d %H:%M")
                    if hasattr(ev.uploaded_at, "strftime")
                    else str(ev.uploaded_at)[:16]
                )
                evidence_rows.append(
                    [
                        Paragraph(ev.file_name, body_style),
                        Paragraph(ev.mime_type, body_style),
                        Paragraph(size_kb, body_style),
                        Paragraph(up_time, body_style),
                        Paragraph(ev.sha256, mono_style),
                    ]
                )

            ev_table = Table(evidence_rows, colWidths=[100, 70, 52, 70, 240])
            ev_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("PADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            elements.append(ev_table)
            elements.append(
                Paragraph(
                    "<b>Integrity Note:</b> SHA-256 hashes establish byte-level consistency with the stored reference file. "
                    "They do not independently verify device provenance, capture timestamp, or legal authenticity.",
                    caption_style,
                )
            )
        else:
            elements.append(Paragraph("<i>No digital evidence uploaded for this incident record.</i>", body_style))
        elements.append(Spacer(1, 14))

    # 5. AI-Assisted ThreatLens Analysis
    if include_analysis:
        elements.append(Paragraph("3. AI-Assisted ThreatLens Analysis", section_heading))
        if analyses:
            latest = analyses[0] if isinstance(analyses, list) else analyses
            cls_label = getattr(latest, "classification_label", "N/A")
            conf = getattr(latest, "confidence", None)
            conf_str = f"{conf:.2f} (Model score, not calibrated probability)" if conf is not None else "N/A"
            expl = getattr(latest, "explanation", "N/A")
            risk_score = getattr(latest, "risk_score", None)
            risk_level = getattr(latest, "risk_level", None)
            risk_str = f"{risk_score}/100 ({str(risk_level).upper()})" if risk_score is not None else "Insufficient Data"

            analysis_rows = [
                [Paragraph("<b>Status:</b>", body_style), Paragraph(str(getattr(latest, "status", "completed")), body_style)],
                [Paragraph("<b>Classification Label:</b>", body_style), Paragraph(str(cls_label), body_style)],
                [Paragraph("<b>Confidence Metric:</b>", body_style), Paragraph(conf_str, body_style)],
                [Paragraph("<b>Review-Priority Risk:</b>", body_style), Paragraph(risk_str, body_style)],
                [Paragraph("<b>Model Explanation:</b>", body_style), Paragraph(str(expl), body_style)],
            ]

            indicators = getattr(latest, "indicators", [])
            if indicators:
                ind_list = "<br/>".join([f"• <b>{i.get('name', '')}:</b> {i.get('description', '')}" if isinstance(i, dict) else f"• {str(i)}" for i in indicators])
                analysis_rows.append([Paragraph("<b>Key Indicators:</b>", body_style), Paragraph(ind_list, body_style)])

            an_table = Table(analysis_rows, colWidths=[130, 402])
            an_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                        ("PADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            elements.append(an_table)
            elements.append(
                Paragraph(
                    "<b>AI Transparency Disclosure:</b> AI classification is an automated informational aid subject to error. "
                    "It does not constitute factual proof of guilt, danger prediction, or legal verification.",
                    caption_style,
                )
            )
        else:
            elements.append(Paragraph("<i>No AI ThreatLens analysis has been run for this incident record.</i>", body_style))
        elements.append(Spacer(1, 14))

    # 6. PatternGraph Relationships
    elements.append(Paragraph("4. PatternGraph Incident Relationships", section_heading))
    edges = getattr(graph_data, "edges", []) if graph_data else []
    if edges:
        graph_rows = [
            [
                Paragraph("<b>Target Incident</b>", body_style),
                Paragraph("<b>Relationship Type</b>", body_style),
                Paragraph("<b>Confidence</b>", body_style),
                Paragraph("<b>Explanation</b>", body_style),
            ]
        ]
        for e in edges:
            conf_val = f"{e.confidence:.2f}" if getattr(e, "confidence", None) is not None else "N/A"
            graph_rows.append(
                [
                    Paragraph(str(getattr(e, "target", "")), body_style),
                    Paragraph(str(getattr(e, "relationship", "")), body_style),
                    Paragraph(conf_val, body_style),
                    Paragraph(str(getattr(e, "explanation", "")), body_style),
                ]
            )
        gr_table = Table(graph_rows, colWidths=[120, 140, 52, 220])
        gr_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("PADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        elements.append(gr_table)
    else:
        elements.append(Paragraph("<i>No related incidents or connections identified in PatternGraph.</i>", body_style))

    elements.append(Spacer(1, 16))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=8))
    elements.append(
        Paragraph(
            "<b>End of SHEPHERD JusticeBridge Summary Report</b> — Generated under strict user consent.",
            caption_style,
        )
    )

    doc.build(elements)
    return buffer.getvalue()
