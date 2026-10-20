"""Compatibility exports for the retired local Mosquitto provisioning path."""

from app.integrations.legacy_mosquitto import add_device, list_device_ids, remove_device

__all__ = ["add_device", "list_device_ids", "remove_device"]
