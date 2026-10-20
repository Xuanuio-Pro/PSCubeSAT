"""Global exception handlers — chuẩn hóa mọi response lỗi về cùng 1 format JSON.

Thiết kế theo Docs/Global_Exception_Handling_Guide.md.
"""

from datetime import datetime, timezone

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.exceptions import HTTPException as StarletteHTTPException


def _envelope(error_code: str, message: str, details=None) -> dict:
    return {
        "success": False,
        "error_code": error_code,
        "message": message,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_envelope("BAD_REQUEST", str(exc)),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            # Omit input/ctx: they may contain secrets, exceptions, bytes or NaN.
            content=_envelope(
                "VALIDATION_ERROR",
                "Dữ liệu gửi lên không hợp lệ.",
                [
                    {"type": error["type"], "loc": list(error["loc"]), "msg": error["msg"]}
                    for error in exc.errors()
                ],
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        detail = exc.detail
        return JSONResponse(
            status_code=exc.status_code,
            headers=exc.headers,
            content=_envelope(
                f"HTTP_{exc.status_code}",
                detail if isinstance(detail, str) else "Lỗi yêu cầu HTTP",
                detail if not isinstance(detail, str) else None,
            ),
        )

    @app.exception_handler(Exception)
    async def global_unhandled_exception_handler(request: Request, exc: Exception):
        logger.error(f"[GLOBAL ERROR] Unhandled Exception at {request.url.path}: {exc}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope(
                "INTERNAL_SERVER_ERROR", "Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau."
            ),
        )
