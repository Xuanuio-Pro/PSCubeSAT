import { useEffect, useRef, useState, useCallback, useId } from 'react';
import BlocklyEditor from './BlocklyEditor';
import MonacoEditor from './MonacoEditor';
import CloudCompiler from '../serial/CloudCompiler';
import WebFlasher from '../serial/WebFlasher';
import { sourceKey, downloadFile, DEFAULT_ARDUINO_CODE } from './blockly-project.js';
import { cppToWorkspace } from './cpp-to-blockly.js';

function restoreDocument(labId, exerciseId, storageScope) {
  try {
    const saved = JSON.parse(localStorage.getItem(sourceKey(labId, exerciseId, storageScope)) || 'null');
    if (saved?.version === 2 && typeof saved.code === 'string') return { text: saved.code, origin: 'cpp', legacyManualCode: saved.legacyManualCode || '' };
    if (saved?.mode === 'manual' && typeof saved.manualCode === 'string') return { text: saved.manualCode, origin: 'cpp', legacyManualCode: '' };
    return { text: null, origin: 'blocks', legacyManualCode: saved?.manualCode || '' };
  } catch { return { text: null, origin: 'blocks', legacyManualCode: '' }; }
}

export default function IDEPanel({ labId, exerciseId = '', storageScope = '', legacyFallback = false, setCode, variant = 'default', showToolbar = true }) {
  return <LabIDE key={`${labId}:${exerciseId}:${storageScope}`} {...{ labId, exerciseId, storageScope, legacyFallback, setCode, variant, showToolbar }} />;
}

function LabIDE({ labId, exerciseId, storageScope, legacyFallback, setCode, variant, showToolbar }) {
  const [document, setDocument] = useState(() => restoreDocument(labId, exerciseId, storageScope));
  const [tab, setTab] = useState('cpp');
  const [generated, setGenerated] = useState({ code: '', issues: [] });
  const [sync, setSync] = useState({ status: 'pending', error: '' });
  const [workspaceUpdate, setWorkspaceUpdate] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const expandButtonRef = useRef(null);
  const lastGeneratedCode = useRef(null);
  const id = useId();
  const fileStem = exerciseId || `cubesat-lab${labId}`;
  const onGenerated = useCallback((result, reason = 'blocks') => {
    const unchanged = lastGeneratedCode.current === result.code;
    lastGeneratedCode.current = result.code;
    setGenerated(result);
    if (reason === 'cpp') {
      setWorkspaceUpdate(null);
      setSync({ status: 'synced', error: '' });
      return;
    }
    if (reason === 'blocks') setWorkspaceUpdate(null);
    // Layout, comments and collapse events must not replace the student's
    // formatting or resynchronize C++ when the generated program is unchanged.
    if (reason === 'blocks' && unchanged) return;
    setDocument(current => reason === 'load' && current.origin === 'cpp'
      ? current : { ...current, text: result.code, origin: 'blocks' });
  }, []);

  useEffect(() => {
    if (document.origin !== 'cpp' || document.text === null) return;
    const timer = setTimeout(() => {
      try {
        const state = cppToWorkspace(document.text, labId);
        setWorkspaceUpdate({ state });
      } catch (error) {
        setSync({ status: 'error', error: error.message });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [document.text, document.origin, labId]);

  const pendingCpp = document.origin === 'cpp' && sync.status !== 'synced';
  const effectiveCode = pendingCpp ? '' : document.text || '';
  useEffect(() => { setCode(effectiveCode); }, [effectiveCode, setCode]);
  useEffect(() => {
    if (document.text === null) return;
    try { localStorage.setItem(sourceKey(labId, exerciseId, storageScope), JSON.stringify({ version: 2, code: document.text, legacyManualCode: document.legacyManualCode })); }
    catch { setMessage('Không lưu được mã C++ trên máy. Hãy tải file .ino để giữ lại.'); }
  }, [document.text, document.legacyManualCode, labId, exerciseId, storageScope]);
  useEffect(() => {
    if (!expanded) return;
    const listener = event => {
      if (event.key === 'Escape') { setExpanded(false); expandButtonRef.current?.focus(); }
    };
    window.document.addEventListener('keydown', listener);
    return () => window.document.removeEventListener('keydown', listener);
  }, [expanded]);

  const editCpp = value => {
    const text = value ?? '';
    if (text === document.text) return;
    setSync({ status: 'pending', error: '' });
    setDocument(current => ({ ...current, text, origin: 'cpp' }));
  };
  const backupCpp = () => { if (document.text) downloadFile(`${fileStem}-cpp-ban-sao.ino`, document.text, 'text/plain'); };
  const restoreLegacy = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(sourceKey(labId, exerciseId)) || localStorage.getItem(sourceKey(labId)) || 'null');
      const code = saved?.version === 2 ? saved.code : saved?.manualCode;
      if (typeof code !== 'string') throw new Error('Không tìm thấy bản C++ cũ phù hợp.');
      backupCpp(); editCpp(code);
      setMessage('Đã khôi phục C++ cũ vào bài hiện tại. Bản lưu cũ được giữ lại.');
    } catch (error) { setMessage(error.message); }
  };

  return <div className={`card ide-panel cube-ide ide-panel--${variant}${expanded ? ' cube-ide--expanded' : ''}`}>
    <div className="cube-ide-header">
      <div className="cube-ide-tabs" role="tablist" aria-label="Chế độ lập trình">
        {['blocks', 'cpp'].map((item, i) => <button key={item} type="button" role="tab" id={`${id}-${item}-tab`} aria-controls={`${id}-${item}`} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onKeyDown={event => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 'blocks' : event.key === 'End' ? 'cpp' : i === 0 ? 'cpp' : 'blocks';
            setTab(next); window.document.getElementById(`${id}-${next}-tab`)?.focus();
          }
        }} onClick={() => setTab(item)}>{i === 0 ? 'Kéo thả' : 'Mã nguồn C++'}</button>)}
      </div>
      <button type="button" className="cube-expand" ref={expandButtonRef} aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Thu gọn' : 'Mở rộng'}</button>
    </div>
    <div className="cube-source-state" role="status">
      <span>{exerciseId || `Lab ${labId}`} · C++ ↔ Blockly · {pendingCpp ? sync.status === 'error' ? 'Chưa đồng bộ' : 'Đang đồng bộ…' : generated.issues.length ? 'Blockly cần sửa lỗi' : 'Đã đồng bộ'}</span>
    </div>
    {message && <div className="blockly-notice" role="status">{message}<button onClick={() => setMessage('')}>Đóng</button></div>}
    {pendingCpp && <div className="blockly-notice" role={sync.status === 'error' ? 'alert' : 'status'}>
      <span>{sync.error || 'Đang cập nhật các block từ C++…'} {sync.status === 'error' ? 'Bài Blockly gần nhất được giữ lại. Sửa C++ để tiếp tục đồng bộ.' : ''}</span>
      {sync.status === 'error' && generated.code && <button onClick={() => { backupCpp(); setDocument(current => ({ ...current, text: generated.code, origin: 'blocks' })); }}>Lấy lại C++ từ block</button>}
    </div>}
    <div className="cube-ide-body" id={`${id}-blocks`} role="tabpanel" aria-labelledby={`${id}-blocks-tab`} hidden={tab !== 'blocks'} inert={pendingCpp}>
      <BlocklyEditor labId={labId} exerciseId={exerciseId} storageScope={storageScope} legacyFallback={legacyFallback} onCodeChange={onGenerated} active={tab === 'blocks'} workspaceUpdate={workspaceUpdate} />
    </div>
    <div className="cube-ide-body cube-source-panel" id={`${id}-cpp`} role="tabpanel" aria-labelledby={`${id}-cpp-tab`} hidden={tab !== 'cpp'}>
      <div className="blockly-toolbar">
        <span>Sửa trực tiếp · tự lưu và cập nhật Blockly</span>
        <div className="blockly-toolbar-group">
          {(storageScope || legacyFallback) && <button onClick={restoreLegacy}>Khôi phục C++ cũ</button>}
          {document.legacyManualCode && <button onClick={() => { backupCpp(); setSync({ status: 'pending', error: '' }); setDocument(current => ({ ...current, text: current.legacyManualCode, legacyManualCode: '', origin: 'cpp' })); }}>Mở bản C++ cũ</button>}
          <button disabled={!document.text} onClick={() => downloadFile(`${fileStem}.ino`, document.text, 'text/plain')}>Tải .ino</button>
        </div>
      </div>
      <div className="cube-monaco"><MonacoEditor code={document.text ?? DEFAULT_ARDUINO_CODE} onChange={editCpp} height="100%" /></div>
    </div>
    {showToolbar && <div className="blockly-toolbar"><CloudCompiler code={effectiveCode} labId={labId} inline /><WebFlasher code={effectiveCode} labId={labId} inline /></div>}
  </div>;
}
