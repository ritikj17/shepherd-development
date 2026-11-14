from datetime import datetime, timedelta, timezone
import logging
from typing import Optional
from uuid import UUID, uuid4

from app.core.exceptions import NotFoundError
from app.database.base import BaseRepository
from app.models.safety import ReportGenerateRequest, ReportGenerateResponse
from app.reports.pdf_builder import build_justicebridge_pdf
from app.reports.repository import BaseReportRepository

logger = logging.getLogger("shepherd.reports")


class ReportService:
    """Service orchestrating JusticeBridge PDF compilation and retrieval."""

    def __init__(
        self,
        report_repo: BaseReportRepository,
        core_repo: BaseRepository,
    ) -> None:
        self.report_repo = report_repo
        self.core_repo = core_repo

    async def generate_incident_report(
        self,
        user_id: UUID,
        incident_id: UUID,
        data: ReportGenerateRequest,
    ) -> ReportGenerateResponse:
        # 1. Verify incident exists and belongs to user
        incident = await self.core_repo.get_incident(user_id, incident_id)
        if not incident:
            raise NotFoundError("Incident not found.")

        # 2. Collect evidence if requested
        evidence_items = []
        if data.include_evidence_index:
            evidence_items = await self.core_repo.list_evidence(user_id, incident_id)

        # 3. Collect threat analysis and graph if requested
        analyses = []
        graph_data = None
        if data.include_analysis:
            try:
                analyses = await self.core_repo.list_threat_analyses(user_id, incident_id)
            except Exception as exc:
                logger.warning("Could not retrieve threat analyses: %s", exc)
            try:
                graph_data = await self.core_repo.get_incident_graph(user_id, incident_id)
            except Exception as exc:
                logger.warning("Could not retrieve incident graph: %s", exc)

        report_id = uuid4()
        file_name = f"incident-report-{str(incident_id)[:8]}.pdf"
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=24)

        # 4. Generate PDF bytes
        pdf_bytes = build_justicebridge_pdf(
            report_id=report_id,
            incident=incident,
            evidence_items=evidence_items,
            analyses=analyses,
            graph_data=graph_data,
            include_evidence_index=data.include_evidence_index,
            include_analysis=data.include_analysis,
        )

        # 5. Save report metadata and binary
        saved_record = await self.report_repo.save_report(
            user_id=user_id,
            incident_id=incident_id,
            report_id=report_id,
            file_name=file_name,
            pdf_bytes=pdf_bytes,
            expires_at=expires_at,
        )

        download_url = f"/api/v1/reports/{report_id}/download"

        return ReportGenerateResponse(
            report_id=report_id,
            incident_id=incident_id,
            status="generated",
            file_name=file_name,
            download_url=download_url,
            generated_at=saved_record["generated_at"],
            expires_at=saved_record["expires_at"],
        )

    async def get_report_download(self, user_id: UUID, report_id: UUID) -> tuple[bytes, str]:
        report = await self.report_repo.get_report(user_id, report_id)
        if not report:
            raise NotFoundError("Report not found.")

        pdf_bytes = await self.report_repo.get_report_pdf(user_id, report_id)
        if not pdf_bytes:
            raise NotFoundError("Report PDF content not found.")

        file_name = report.get("file_name") or f"incident-report-{str(report['incident_id'])[:8]}.pdf"
        return pdf_bytes, file_name

    async def list_reports(self, user_id: UUID, incident_id: Optional[UUID] = None) -> list[dict]:
        return await self.report_repo.list_reports(user_id, incident_id)
