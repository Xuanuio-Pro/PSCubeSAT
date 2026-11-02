from fastapi import APIRouter, Depends

from app.services import compiler_sandbox, compiler_svc, mqtt_consumer
from app.services.auth import get_required_user
from app.services.simulation.mqtt_publisher import simulation_mqtt_publisher

router = APIRouter(prefix="/api", tags=["health"], dependencies=[Depends(get_required_user)])


@router.get("/health")
async def health():
    try:
        image = await compiler_sandbox.image_id()
    except OSError:
        image = None
    return {
        "status": "online",
        "mqtt": {
            **mqtt_consumer.connection_status(),
            "publisher_connected": simulation_mqtt_publisher.connected,
        },
        "compiler_installed": bool(image),
        "compiler_backend": "docker-sandbox",
        "compiler_image_id": image,
        "pio_version": "6.1.18 (sandbox image)" if image else "unavailable",
        "build_cache_ready": all(
            (path / "src").is_dir() for path in compiler_svc._BOARD_DIRS.values()
        ),
    }
