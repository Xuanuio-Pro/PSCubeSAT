/** @typedef {{ allowsFeature: (feature: string) => boolean }} SerialPolicy */

function browserSerialPolicy() {
  // The policy APIs are not included in every TypeScript DOM declaration.
  const page = /** @type {Document & { permissionsPolicy?: SerialPolicy, featurePolicy?: SerialPolicy }} */ (globalThis.document);
  return page?.permissionsPolicy ?? page?.featurePolicy;
}

/** Detect browser requirements before requesting a USB port or downloading firmware. */
export function getSerialSupport({
  secureContext = globalThis.isSecureContext === true,
  serial = globalThis.navigator?.serial,
  policy = browserSerialPolicy(),
} = {}) {
  if (!secureContext) {
    return {
      available: false,
      code: 'https-required',
      label: 'Cần HTTPS',
      message: 'Nạp USB và Serial cần website HTTPS có chứng chỉ tin cậy. Khi thử trên máy cắm board, bạn có thể dùng localhost. Nếu đang mở trang trong khung nhúng, hãy mở trực tiếp ở tab riêng.',
    };
  }
  if (!serial || typeof serial.requestPort !== 'function') {
    return {
      available: false,
      code: 'unsupported-browser',
      label: 'Cần Chrome/Edge',
      message: 'Trình duyệt này chưa hỗ trợ Web Serial. Hãy mở website bằng Chrome hoặc Edge trên máy tính và cắm ESP32 vào chính máy đó.',
    };
  }
  // Some browsers do not expose the policy inspection API. Feature detection
  // remains sufficient there; requestPort will enforce browser policy itself.
  if (typeof policy?.allowsFeature === 'function' && !policy.allowsFeature('serial')) {
    return {
      available: false,
      code: 'policy-blocked',
      label: 'USB bị chặn',
      message: 'Website hoặc khung nhúng đang chặn quyền Serial. Hãy mở trang trực tiếp ở tab riêng hoặc liên hệ quản trị viên.',
    };
  }
  return { available: true, code: 'ready', label: '', message: '' };
}
