// Mirrors fastapi-backend/app/schemas/auth.py (validate_new_password). The server is authoritative.
export const PASSWORD_RULES = [
  { id: 'length', label: 'Tối thiểu 8 ký tự', test: (value) => value.length >= 8 },
  { id: 'upper', label: 'Có ít nhất 1 chữ cái in hoa (A–Z)', test: (value) => /\p{Lu}/u.test(value) },
  { id: 'special', label: 'Có ít nhất 1 ký tự đặc biệt (ví dụ ! @ # $ %)', test: (value) => /[^\p{L}\p{N}\s]/u.test(value) },
];

export function validatePassword(value) {
  if (new TextEncoder().encode(value).length > 72) return 'Mật khẩu không được vượt quá 72 byte UTF-8';
  const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
  return failed ? `Mật khẩu chưa đạt yêu cầu: ${failed.label.toLowerCase()}` : null;
}
