import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.services import device_images, mqtt_consumer

JPEG = b"\xff\xd8\xff\xe0fake-jpeg-body\xff\xd9"


class DeviceImageStoreTests(unittest.TestCase):
    def test_validation_and_ring_keeps_newest_only(self):
        self.assertTrue(device_images.is_jpeg(JPEG))
        self.assertFalse(device_images.is_jpeg(b"GIF89a-not-a-jpeg"))
        self.assertFalse(device_images.is_jpeg(JPEG[:-2]))  # truncated: missing EOI marker
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ids = []
            for _ in range(device_images.KEEP_IMAGES + 3):
                ids.append(device_images.save_image("cube_01", JPEG, root))
            listed = device_images.list_images("cube_01", root)
            self.assertEqual(len(listed), device_images.KEEP_IMAGES)
            self.assertEqual(listed[0], ids[-1])
            self.assertIsNone(device_images.image_path("cube_01", "../../etc", root))
            self.assertIsNotNone(device_images.image_path("cube_01", listed[0], root))
            device_images.clear_images("cube_01", root)
            self.assertEqual(device_images.list_images("cube_01", root), [])


class ConsumerImageTests(unittest.IsolatedAsyncioTestCase):
    async def _deliver(self, payload, device):
        message = MagicMock(topic="sensors/cube_01/image", payload=payload)
        session = MagicMock()
        session.__aenter__ = AsyncMock(return_value=session)
        session.__aexit__ = AsyncMock(return_value=None)
        repo = MagicMock(get_by_uid=AsyncMock(return_value=device))
        with (
            patch.object(mqtt_consumer, "get_session_maker", return_value=lambda: session),
            patch.object(mqtt_consumer, "DeviceRepository", return_value=repo),
            patch.object(device_images, "save_image", return_value="1") as save,
        ):
            await mqtt_consumer._handle_message(message)
        return save

    async def test_only_valid_jpeg_from_owned_enabled_device_is_stored(self):
        owned = MagicMock(enabled=True, user_id=1)
        self.assertEqual((await self._deliver(JPEG, owned)).call_count, 1)
        self.assertEqual((await self._deliver(b"not a jpeg", owned)).call_count, 0)
        self.assertEqual((await self._deliver(JPEG, None)).call_count, 0)
        self.assertEqual(
            (await self._deliver(JPEG, MagicMock(enabled=False, user_id=1))).call_count, 0
        )
        self.assertEqual(
            (await self._deliver(JPEG, MagicMock(enabled=True, user_id=None))).call_count, 0
        )
