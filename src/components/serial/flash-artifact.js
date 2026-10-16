import SparkMD5 from 'spark-md5';

export async function sha256(data) {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateManifest(artifact) {
  if (!artifact || !/^[a-f0-9]{32}$/.test(artifact.id) ||
      !['esp32', 'esp32s3'].includes(artifact.chip) || artifact.board !== artifact.chip ||
      !Number.isFinite(Date.parse(artifact.expires_at)) || Date.parse(artifact.expires_at) <= Date.now()) {
    throw new Error('Artifact không hợp lệ hoặc đã hết hạn. Hãy biên dịch lại.');
  }
  const flash = artifact.flash;
  const offsets = { 'bootloader.bin': artifact.chip === 'esp32s3' ? 0 : 0x1000,
    'partitions.bin': 0x8000, 'boot_app0.bin': 0xe000, 'firmware.bin': 0x10000 };
  if (!flash || !['dio', 'qio', 'dout', 'qout'].includes(flash.mode) ||
      !['40m', '80m'].includes(flash.frequency) || !['4MB', '8MB'].includes(flash.size) ||
      !Array.isArray(flash.files) || flash.files.length !== 4 || new Set(flash.files.map(f => f.name)).size !== 4) {
    throw new Error('Manifest flash thiếu file hoặc sai cấu hình.');
  }
  let end = 0;
  for (const file of [...flash.files].sort((a, b) => a.offset - b.offset)) {
    if (!(file.name in offsets) || file.offset !== offsets[file.name] || file.offset < end ||
        !Number.isInteger(file.size) || file.size <= 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error('File flash có offset, kích thước hoặc hash không hợp lệ.');
    }
    end = file.offset + file.size;
    if (end > (flash.size === '8MB' ? 8 : 4) * 1024 * 1024) throw new Error('Firmware vượt dung lượng flash.');
  }
  return artifact;
}

export async function downloadFlashFiles(artifact, source, token, fetcher = fetch) {
  validateManifest(artifact);
  if (await sha256(new TextEncoder().encode(source)) !== artifact.source_sha256) {
    throw new Error('Code đã thay đổi. Hãy biên dịch lại trước khi nạp.');
  }
  const fileArray = [];
  for (const file of [...artifact.flash.files].sort((a, b) => a.offset - b.offset)) {
    const response = await fetcher(`/api/artifacts/${artifact.id}/files/${file.name}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error(`Không tải được ${file.name} (HTTP ${response.status}). Hãy đăng nhập/biên dịch lại.`);
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.length !== file.size || await sha256(data) !== file.sha256) throw new Error(`Hash hoặc kích thước ${file.name} không khớp.`);
    fileArray.push({ data, address: file.offset });
  }
  return fileArray;
}

export async function writeArtifact(loader, artifact, fileArray, reportProgress) {
  validateManifest(artifact);
  await loader.main();
  const detected = loader.chip.CHIP_NAME.toLowerCase().replaceAll('-', '');
  if (detected !== artifact.chip) throw new Error(`Chip thực tế ${loader.chip.CHIP_NAME} không khớp bản build ${artifact.chip}. Chưa ghi flash.`);
  const total = fileArray.reduce((sum, file) => sum + file.data.length, 0);
  await loader.writeFlash({ fileArray, flashMode: artifact.flash.mode,
    flashFreq: artifact.flash.frequency, flashSize: artifact.flash.size,
    eraseAll: false, compress: true,
    calculateMD5Hash: image => SparkMD5.ArrayBuffer.hash(image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength)),
    reportProgress: (index, written, size) => {
      const before = fileArray.slice(0, index).reduce((sum, file) => sum + file.data.length, 0);
      reportProgress(Math.min(99, Math.floor(100 * (before + fileArray[index].data.length * written / size) / total)));
    },
  });
  await loader.after('hard_reset');
  reportProgress(100);
}
