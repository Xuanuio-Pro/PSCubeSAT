import { useEffect, useRef, useState, useCallback, useId } from 'react';
import BlocklyEditor from './BlocklyEditor';
import MonacoEditor from './MonacoEditor';
import CloudCompiler from '../serial/CloudCompiler';
import WebFlasher from '../serial/WebFlasher';
import { sourceKey, downloadFile } from './blockly-project.js';

export default function IDEPanel({ labId, setCode, variant = 'default', showToolbar = true }) {
  return <LabIDE key={labId} {...{ labId, setCode, variant, showToolbar }} />;
}

function LabIDE({ labId, setCode, variant, showToolbar }) {
  const [source, setSource] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(sourceKey(labId)) || 'null');
      if (['manual', 'blocks'].includes(saved?.mode) && typeof saved.manualCode === 'string') return saved;
    } catch { /* Start from blocks when source preferences cannot be read. */ }
    return { mode: 'blocks', manualCode: '' };
  });
  const [tab, setTab] = useState(source.mode === 'manual' ? 'cpp' : 'blocks');
  const [generated, setGenerated] = useState({ code: '', issues: [] });
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const expandButtonRef = useRef(null);
  const id = useId();
  const onGenerated = useCallback(result => setGenerated(result), []);
  const effectiveCode = source.mode === 'manual' ? source.manualCode : generated.code;
  useEffect(() => { setCode(effectiveCode); }, [effectiveCode, setCode]);
  useEffect(() => {
    try { localStorage.setItem(sourceKey(labId), JSON.stringify(source)); }
    catch { setMessage('Không lưu được mã C++ trên máy. Hãy tải file .ino để giữ lại.'); }
  }, [source, labId]);
  useEffect(() => {
    if (!expanded) return;
    const listener = event => {
      if (event.key === 'Escape') { setExpanded(false); expandButtonRef.current?.focus(); }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [expanded]);
  return <div className={`card ide-panel cube-ide ide-panel--${variant}${expanded ? ' cube-ide--expanded' : ''}`}>
    <div className="cube-ide-header">
      <div className="cube-ide-tabs" role="tablist" aria-label="Chế độ lập trình">
        {['blocks', 'cpp'].map((item, i) => <button key={item} type="button" role="tab" id={`${id}-${item}-tab`} aria-controls={`${id}-${item}`} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onKeyDown={event => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'blocks' : event.key === 'End' ? 'cpp' : i === 0 ? 'cpp' : 'blocks'; setTab(next); document.getElementById(`${id}-${next}-tab`)?.focus(); }
        }} onClick={() => setTab(item)}>{i === 0 ? 'Kéo thả' : 'Mã nguồn C++'}</button>)}
      </div>
      <button type="button" className="cube-expand" ref={expandButtonRef} aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Thu gọn' : 'Mở rộng'}</button>
    </div>
    <div className="cube-source-state">
      <span>Lab {labId} · Biên dịch từ <strong>{source.mode === 'manual' ? 'C++ chỉnh tay' : 'Blockly'}</strong></span>
      {source.mode === 'manual' && <button onClick={() => setSource(current => ({ ...current, mode: 'blocks' }))}>Dùng mã từ block</button>}
    </div>
    {message && <div className="blockly-notice" role="status">{message}<button onClick={() => setMessage('')}>Đóng</button></div>}
    <div className="cube-ide-body" id={`${id}-blocks`} role="tabpanel" aria-labelledby={`${id}-blocks-tab`} hidden={tab !== 'blocks'}>
      <BlocklyEditor labId={labId} onCodeChange={onGenerated} active={tab === 'blocks'} />
    </div>
    <div className="cube-ide-body cube-source-panel" id={`${id}-cpp`} role="tabpanel" aria-labelledby={`${id}-cpp-tab`} hidden={tab !== 'cpp'}>
      <div className="blockly-toolbar">
        <span>{source.mode === 'manual' ? 'Bản C++ riêng · tự lưu' : 'Mã C++ sinh từ các block'}</span>
        <div className="blockly-toolbar-group">
          {source.mode === 'blocks' && !source.manualCode && <button disabled={!generated.code} onClick={() => setSource({ mode: 'manual', manualCode: generated.code })}>Chỉnh sửa bản C++</button>}
          {source.mode === 'blocks' && source.manualCode && <button onClick={() => setSource(current => ({ ...current, mode: 'manual' }))}>Mở bản C++ đã lưu</button>}
          {source.mode === 'blocks' && source.manualCode && <button disabled={!generated.code} onClick={() => { downloadFile(`lab${labId}-cpp-ban-sao.ino`, source.manualCode, 'text/plain'); setSource({ mode: 'manual', manualCode: generated.code }); setMessage('Bản C++ trước đó đã được tải về máy.'); }}>Tạo bản mới từ block</button>}
          <button disabled={!effectiveCode} onClick={() => downloadFile(`cubesat-lab${labId}.ino`, effectiveCode, 'text/plain')}>Tải .ino</button>
        </div>
      </div>
      {source.mode === 'manual' && <div className="blockly-guide">Chỉnh sửa C++ không chuyển ngược thành block. Bản kéo thả vẫn được giữ lại.</div>}
      {tab === 'cpp' && <div className="cube-monaco"><MonacoEditor code={source.mode === 'manual' ? source.manualCode : generated.code || '// Hãy sửa các lỗi trong tab Kéo thả để sinh mã C++.'} onChange={value => { if (source.mode === 'manual') setSource({ mode: 'manual', manualCode: value ?? '' }); }} readOnly={source.mode !== 'manual'} height="100%" /></div>}
    </div>
    {showToolbar && <div className="blockly-toolbar"><CloudCompiler code={effectiveCode} labId={labId} inline /><WebFlasher code={effectiveCode} labId={labId} inline /></div>}
  </div>;
}
