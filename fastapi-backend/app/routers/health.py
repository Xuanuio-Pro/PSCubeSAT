from fastapi import APIRouter
from app.services import compiler_svc, compiler_sandbox

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health():
    try:
        image = await compiler_sandbox.image_id()
    except OSError:
        image = None
    return {
        "status": "online",
        "compiler_installed": bool(image),
        "compiler_backend": "docker-sandbox",
        "compiler_image_id": image,
        "pio_version": "6.1.18 (sandbox image)" if image else "unavailable",
        "build_cache_ready": all((path / "src").is_dir() for path in compiler_svc._BOARD_DIRS.values()),
    }
