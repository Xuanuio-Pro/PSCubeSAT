import { useId, useState } from 'react';

// Vietnamese file picker: "Chọn tệp" button + drop zone + chosen file name (replaces the browser's
// English "Choose File / No file chosen"). onChange receives the native input change event;
// pass fileName to control the shown name (e.g. clear it after the parent resets the input).
export default function FileInput({ label, accept, onChange, required = false, disabled = false, inputRef = undefined, keepName = true, fileName = undefined }) {
  const id = useId();
  const [name, setName] = useState('');
  const [dragging, setDragging] = useState(false);
  const handle = event => {
    const file = event.target.files?.[0];
    setName(keepName && file ? file.name : '');
    onChange(event);
  };
  const drop = event => {
    event.preventDefault();
    setDragging(false);
    if (disabled || !event.dataTransfer.files?.length) return;
    const input = /** @type {HTMLInputElement | null} */ (document.getElementById(id));
    if (!input) return;
    input.files = event.dataTransfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  return <div className={`file-input${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
    onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
    onDragLeave={() => setDragging(false)} onDrop={drop}>
    <label htmlFor={id} className="file-input-label">{label}</label>
    <div className="file-input-zone">
      <input id={id} ref={inputRef} type="file" accept={accept} required={required} disabled={disabled} onChange={handle} className="file-input-native" />
      <label htmlFor={id} className="file-input-button" aria-hidden="true">Chọn tệp</label>
      <span className="file-input-name">{(fileName ?? name) || 'Chưa chọn tệp · hoặc kéo thả tệp vào đây'}</span>
    </div>
  </div>;
}
