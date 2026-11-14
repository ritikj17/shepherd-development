from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.auth.dependencies import get_current_user
from app.auth.models import AuthenticatedUser
from app.database.base import BaseRepository
from app.database.dependencies import get_repository
from app.models.safety import ReportGenerateRequest, ReportGenerateResponse
from app.reports.repository import BaseReportRepository, get_report_repository
from app.reports.service import ReportService

router = APIRouter(prefix="/api/v1", tags=["JusticeBridge Reports"])


def get_report_service(
    report_repo: BaseReportRepository = Depends(get_report_repository),
    core_repo: BaseRepository = Depends(get_repository),
) -> ReportService:
    return ReportService(report_repo=report_repo, core_repo=core_repo)


@router.post(
    "/reports/{incident_id}",
    response_model=ReportGenerateResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate chronological JusticeBridge incident report PDF",
)
async def generate_incident_report(
    incident_id: UUID,
    data: ReportGenerateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: ReportService = Depends(get_report_service),
) -> ReportGenerateResponse:
    return await service.generate_incident_report(current_user.id, incident_id, data)


@router.get(
    "/reports/{report_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Download JusticeBridge incident report PDF",
)
async def download_report_pdf(
    report_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: ReportService = Depends(get_report_service),
) -> Response:
    pdf_bytes, file_name = await service.get_report_download(current_user.id, report_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{file_name}"',
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
    )


@router.get(
    "/reports",
    response_model=list[ReportGenerateResponse],
    status_code=status.HTTP_200_OK,
    summary="List generated JusticeBridge reports for authenticated user",
)
async def list_reports(
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: ReportService = Depends(get_report_service),
) -> list[ReportGenerateResponse]:
    reports = await service.list_reports(current_user.id)
    return [
        ReportGenerateResponse(
            report_id=r["id"],
            incident_id=r["incident_id"],
            status=r["status"],
            file_name=r.get("file_name") or f"incident-report-{str(r['incident_id'])[:8]}.pdf",
            download_url=f"/api/v1/reports/{r['id']}/download",
            generated_at=r["generated_at"],
            expires_at=r.get("expires_at"),
        )
        for r in reports
    ]
