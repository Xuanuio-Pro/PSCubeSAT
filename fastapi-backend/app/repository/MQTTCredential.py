"""Compatibility import. New code uses app.repository.mqtt."""

from app.repository.mqtt import MQTTCredentialRepository

__all__ = ["MQTTCredentialRepository"]
