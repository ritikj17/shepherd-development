from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base application exception rendered in the locked SHEPHERD error format."""

    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details if details is not None else {}


class AuthenticationError(AppError):
    def __init__(self, message: str = "Missing or invalid authentication.", details: dict[str, Any] | None = None) -> None:
        super().__init__(status_code=401, code="UNAUTHORIZED", message=message, details=details)


class AuthorizationError(AppError):
    def __init__(self, message: str = "Not authorized to perform this action.", details: dict[str, Any] | None = None) -> None:
        super().__init__(status_code=403, code="FORBIDDEN", message=message, details=details)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found.", details: dict[str, Any] | None = None) -> None:
        super().__init__(status_code=404, code="NOT_FOUND", message=message, details=details)


class BadRequestError(AppError):
    def __init__(self, message: str = "Invalid request.", details: dict[str, Any] | None = None) -> None:
        super().__init__(status_code=400, code="BAD_REQUEST", message=message, details=details)


class PayloadTooLargeError(AppError):
    def __init__(self, message: str = "Uploaded file exceeds maximum allowed size.", details: dict[str, Any] | None = None) -> None:
        super().__init__(status_code=413, code="PAYLOAD_TOO_LARGE", message=message, details=details)


class UnsupportedMediaTypeError(AppError):
    def __init__(self, message: str = "Unsupported file type.", details: dict[str, Any] | None = None) -> None:
        super().__init__(status_code=415, code="UNSUPPORTED_MEDIA_TYPE", message=message, details=details)


class UpstreamServiceError(AppError):
    def __init__(self, message: str = "Upstream service returned an invalid response.", details: dict[str, Any] | None = None) -> None:
        super().__init__(status_code=502, code="UPSTREAM_ERROR", message=message, details=details)


class ServiceUnavailableError(AppError):
    def __init__(self, message: str = "Upstream service is unavailable.", details: dict[str, Any] | None = None) -> None:
        super().__init__(status_code=503, code="SERVICE_UNAVAILABLE", message=message, details=details)


def _error_payload(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details if details is not None else {},
        }
    }


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers conforming to docs/API_CONTRACTS.md Section 2."""

    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {
                "loc": list(err.get("loc", ())),
                "msg": err.get("msg", "Invalid value"),
                "type": err.get("type", "value_error"),
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_error_payload(
                "VALIDATION_ERROR",
                "Request validation failed.",
                {"errors": errors},
            ),
        )

    @app.exception_handler(HTTPException)
    async def handle_http_exception(_: Request, exc: HTTPException) -> JSONResponse:
        code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            413: "PAYLOAD_TOO_LARGE",
            415: "UNSUPPORTED_MEDIA_TYPE",
            422: "VALIDATION_ERROR",
            429: "RATE_LIMIT_EXCEEDED",
            502: "UPSTREAM_ERROR",
            503: "SERVICE_UNAVAILABLE",
        }
        code = code_map.get(exc.status_code, "HTTP_ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(code, message, {}),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, __: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=_error_payload(
                "INTERNAL_SERVER_ERROR",
                "An unexpected internal server error occurred.",
                {},
            ),
        )
