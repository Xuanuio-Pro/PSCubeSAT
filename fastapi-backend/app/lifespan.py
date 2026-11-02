"""Own background resources and release them on shutdown or partial startup failure."""

import asyncio
from contextlib import AsyncExitStack, asynccontextmanager, suppress

from fastapi import FastAPI
from loguru import logger

from app.core.config import get_settings, validate_production
from app.core.logging import configure_logging
from app.core.redis import close_redis, init_redis
from app.db import close_db, init_db
from app.services import compiler_svc, mqtt_consumer
from app.services.simulation.manager import simulation_manager
from app.services.simulation.mqtt_publisher import simulation_mqtt_publisher


async def _cancel_task(task: asyncio.Task) -> None:
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    validate_production(get_settings())
    logger.info("CubeSat FastAPI Backend starting")
    compiler_svc.init_all_caches()
    async with AsyncExitStack() as resources:
        resources.push_async_callback(close_db)
        await init_db()
        resources.push_async_callback(close_redis)
        await init_redis()

        resources.push_async_callback(simulation_mqtt_publisher.stop)
        await simulation_mqtt_publisher.start()
        simulation_manager.set_publisher(simulation_mqtt_publisher.publish)

        consumer = asyncio.create_task(mqtt_consumer.start(), name="mqtt-consumer")
        resources.push_async_callback(_cancel_task, consumer)
        resources.push_async_callback(simulation_manager.shutdown)
        if get_settings().lms_class_mode:
            from app.services.question_generation import worker

            quizzes = asyncio.create_task(worker(), name="quiz-worker")
            resources.push_async_callback(_cancel_task, quizzes)
        logger.success("Backend resources ready")
        yield
    logger.info("CubeSat FastAPI Backend stopped")
