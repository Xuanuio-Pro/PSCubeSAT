"""Compatibility alias for the previous, misleading repository name."""

from app.repository.mqtt import MQTTACLRepository as TelemetryRepository

__all__ = ["TelemetryRepository"]
