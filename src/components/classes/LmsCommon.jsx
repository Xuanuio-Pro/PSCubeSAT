import { useEffect, useId, useRef, useState } from 'react';

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

// "⋯" menu for secondary row actions; items: [{ label, onSelect, danger?, disabled? }].
export function ActionMenu({ label = 'Thao tác khác', items, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => { if (event.key === 'Escape') setOpen(false); };
    const onPointer = event => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [open]);
  const visible = items.filter(Boolean);
  if (!visible.length) return null;
  return <div className="lms-action-menu" ref={ref}>
    <button type="button" className="lms-action-menu-toggle" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} disabled={disabled} onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">⋯</span>
    </button>
    {open && <div className="lms-action-menu-list" role="menu" id={menuId}>
      {visible.map(item => <button key={item.label} type="button" role="menuitem" className={item.danger ? 'is-danger' : ''} disabled={item.disabled} onClick={() => { setOpen(false); item.onSelect(); }}>{item.label}</button>)}
    </div>}
  </div>;
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

export function MaxAttemptsField({ label, value, fallbackAttempts = 5, required = false, onChange }) {
  const isUnlimited = value === null;
  return <div className="lms-attempts-field">
    <span className="lms-attempts-label">{label}</span>
    <label className="lms-attempts-toggle">
      <input
        type="checkbox"
        checked={isUnlimited}
        onChange={event => onChange(event.target.checked ? null : fallbackAttempts)}
      />
      <span>Không giới hạn lượt</span>
    </label>
    {!isUnlimited && (
      <input
        type="number"
        aria-label={label}
        min={1}
        max={100}
        step="1"
        required={required}
        value={value === '' ? '' : value}
        onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))}
      />
    )}
  </div>;
}
