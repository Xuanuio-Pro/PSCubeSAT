export function Notice({ error = '', message = '' }) {
  if (error) return <p className="lms-notice lms-error" role="alert">{error}</p>;
  if (message) return <p className="lms-notice" role="status">{message}</p>;
  return null;
}

export function Pagination({ page, total, pageSize = 20, onChange, disabled = false }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav className="lms-pagination" aria-label="Phân trang">
    <span>{total} kết quả · Trang {page}/{pages}</span>
    <button disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>Trang trước</button>
    <button disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}>Trang sau</button>
  </nav>;
}

export function ClassFields({ value, onChange, creating = false }) {
  const field = key => ({ value: value[key] ?? '', onChange: event => onChange({ ...value, [key]: event.target.value }) });
  return <div className="lms-form-grid">
    {creating && <label>Mã lớp<input {...field('code')} required maxLength={40} pattern="[A-Za-z0-9_-]+" placeholder="VD: CUBESAT-2026-A" /></label>}
    <label>Tên lớp<input {...field('name')} required maxLength={200} /></label>
    <label>Học kỳ<input {...field('term')} maxLength={100} placeholder="VD: Học kỳ 1, 2026–2027" /></label>
    <label>Trạng thái<select {...field('status')}>
      {(creating || value.status === 'draft') && <option value="draft">Bản nháp</option>}
      <option value="active">Đang mở</option>
    </select></label>
    <label className="lms-wide">Mô tả<textarea {...field('description')} rows={3} maxLength={5000} /></label>
  </div>;
}
