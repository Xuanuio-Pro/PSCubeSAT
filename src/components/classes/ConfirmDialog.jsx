import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './confirm-dialog.css';

const ICONS = {
  danger: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>,
  info: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>,
};

/** In-app replacement for window.confirm; mount it only while a question is pending. */
export default function ConfirmDialog({ title, message, children = null, wide = false, locked = false, showClose = false, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', tone = 'danger', onConfirm, onCancel }) {
  const titleId = useId();
  const messageId = useId();
  const dialog = useRef(null);
  const cancelButton = useRef(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  // `locked` keeps one-time content (a temporary password) from vanishing on Esc or a stray click.
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    const previous = /** @type {HTMLElement | null} */ (document.activeElement);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // The safe choice has the focus first, so Enter never deletes by accident.
    (cancelButton.current || dialog.current?.querySelector('button'))?.focus();
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); if (!lockedRef.current) cancel.current(); return; }
      if (event.key !== 'Tab') return;
      const buttons = dialog.current?.querySelectorAll('button:not([disabled])');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !locked) onCancel(); }}>
      <div ref={dialog} className={`confirm-dialog confirm-${tone}${wide ? ' confirm-wide' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
        {showClose && <button type="button" className="confirm-close" aria-label="Đóng" title="Đóng" onClick={onCancel}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
        <span className="confirm-icon">{ICONS[tone] || ICONS.info}</span>
        <div className="confirm-body">
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
          {children}
        </div>
        <div className="confirm-actions">
          {cancelLabel !== null && <button type="button" ref={cancelButton} className="confirm-cancel" onClick={onCancel}>{cancelLabel}</button>}
          <button type="button" className="confirm-ok" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
