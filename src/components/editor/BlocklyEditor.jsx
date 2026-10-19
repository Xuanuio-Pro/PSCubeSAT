import { useRef, useEffect, useState } from 'react';
import * as Blockly from 'blockly';
import { getToolboxForLab, registerCustomBlocks } from './blockly-toolbox.js';
import { generateArduino } from './arduino-generator.js';
import { projectKey, starterWorkspace, encodeProject, decodeProject, downloadFile } from './blockly-project.js';
import './blockly-editor.css';

registerCustomBlocks();
const theme = Blockly.Theme.defineTheme('ptit', {
  name: 'ptit', base: Blockly.Themes.Classic,
  componentStyles: { workspaceBackgroundColour: '#f7fafc', toolboxBackgroundColour: '#edf3f8', toolboxForegroundColour: '#23425c', flyoutBackgroundColour: '#e6eff6', flyoutForegroundColour: '#23425c', flyoutOpacity: 1, scrollbarColour: '#a5b7c7', scrollbarOpacity: 0.6, insertionMarkerColour: '#2277a5', insertionMarkerOpacity: 0.4 },
  fontStyle: { family: 'system-ui, sans-serif', weight: '500', size: 12 },
});

export default function BlocklyEditor({ labId = 1, onCodeChange, active = true }) {
  const containerRef = useRef(null), workspaceRef = useRef(null), callbackRef = useRef(onCodeChange), inputRef = useRef(null);
  const [report, setReport] = useState({ issues: [], blockCount: 0 });
  const [saveState, setSaveState] = useState('Đang mở bài…');
  const [notice, setNotice] = useState('');
  const [canUndo, setCanUndo] = useState(false), [canRedo, setCanRedo] = useState(false);
  const [replacement, setReplacement] = useState('');
  const refreshRef = useRef(null);
  useEffect(() => { callbackRef.current = onCodeChange; }, [onCodeChange]);

  useEffect(() => {
    const workspace = Blockly.inject(containerRef.current, {
      toolbox: getToolboxForLab(labId), theme, renderer: 'zelos',
      grid: { spacing: 24, length: 1, colour: '#c5d4df', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 1.8, minScale: 0.4 },
      move: { scrollbars: true, drag: true, wheel: true }, trashcan: true,
      maxBlocks: 500, maxInstances: { arduino_setup: 1, arduino_loop: 1 },
    });
    workspaceRef.current = workspace;
    let saveAllowed = true;
    let previousWarnings = new Map();
    const refresh = (persist = true) => {
      const result = generateArduino(workspace, labId);
      setReport(result);
      setCanUndo(workspace.getUndoStack().length > 0);
      setCanRedo(workspace.getRedoStack().length > 0);
      callbackRef.current?.(result);
      const warnings = new Map();
      for (const issue of result.issues) {
        if (!issue.blockId) continue;
        const previous = warnings.get(issue.blockId);
        warnings.set(issue.blockId, previous ? `${previous}\n${issue.message}` : issue.message);
      }
      const nextWarnings = new Map();
      for (const block of workspace.getAllBlocks(false)) {
        const warning = warnings.get(block.id) || null;
        if ((previousWarnings.get(block) || null) !== warning) block.setWarningText(warning, 'validation');
        if (warning) nextWarnings.set(block, warning);
      }
      // Key by block instance: imports can replace blocks while retaining their IDs.
      previousWarnings = nextWarnings;
      if (persist && saveAllowed) {
        try { localStorage.setItem(projectKey(labId), encodeProject(workspace, labId)); setSaveState('Đã lưu trên máy'); }
        catch { setSaveState('Chưa lưu được · hãy xuất bài'); }
      }
    };
    refreshRef.current = () => { saveAllowed = true; refresh(); };
    Blockly.Events.disable();
    try {
      const saved = localStorage.getItem(projectKey(labId));
      Blockly.serialization.workspaces.load(saved ? decodeProject(saved, labId) : starterWorkspace(labId), workspace);
      setNotice('');
    } catch {
      saveAllowed = false;
      Blockly.serialization.workspaces.load(starterWorkspace(labId, true), workspace);
      setNotice('Không đọc được bài đã lưu. Bản lưu cũ được giữ lại. Có thể xuất bài đang sửa rồi nhập lại để tiếp tục lưu.');
      setSaveState('Chưa lưu · lỗi đọc bản cũ');
    } finally { Blockly.Events.enable(); }
    workspace.clearUndo();
    refresh();
    const listener = event => {
      if (event.isUiEvent || event.type === Blockly.Events.FINISHED_LOADING) return;
      refresh();
    };
    workspace.addChangeListener(listener);
    const resize = () => { if (containerRef.current?.offsetWidth) Blockly.svgResize(workspace); };
    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current);
    resize();
    return () => {
      observer.disconnect();
      workspace.removeChangeListener(listener);
      workspace.dispose();
      workspaceRef.current = null;
      refreshRef.current = null;
    };
  }, [labId]);

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => { if (workspaceRef.current) Blockly.svgResize(workspaceRef.current); });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const replace = state => {
    const workspace = workspaceRef.current;
    const backup = Blockly.serialization.workspaces.save(workspace);
    Blockly.Events.disable();
    try { Blockly.serialization.workspaces.load(state, workspace); workspace.clearUndo(); workspace.scrollCenter(); refreshRef.current(); }
    catch (error) { Blockly.serialization.workspaces.load(backup, workspace); throw error; }
    finally { Blockly.Events.enable(); }
  };
  const importFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const workspace = workspaceRef.current;
    try {
      if (file.size > 1000000) throw new Error('File bài làm vượt quá 1 MB.');
      const contents = await file.text();
      // The reader can finish after navigation has disposed or replaced this workspace.
      if (workspaceRef.current !== workspace) return;
      const state = decodeProject(contents, labId);
      downloadFile(`lab${labId}-truoc-khi-nhap.json`, encodeProject(workspace, labId));
      replace(state);
      setNotice(`Đã nhập ${file.name}. Bài trước đó đã được tải về máy.`);
    } catch (error) {
      if (workspaceRef.current === workspace) setNotice(`Không nhập được: ${error.message}`);
    }
  };

  return <div className="blockly-editor">
    <div className="blockly-toolbar" role="toolbar" aria-label="Công cụ Blockly">
      <div className="blockly-toolbar-group">
        <button type="button" onClick={() => workspaceRef.current.undo(false)} disabled={!canUndo} title="Hoàn tác (Ctrl+Z)">Hoàn tác</button>
        <button type="button" onClick={() => workspaceRef.current.undo(true)} disabled={!canRedo} title="Làm lại (Ctrl+Shift+Z)">Làm lại</button>
        <button type="button" onClick={() => { workspaceRef.current.cleanUp(); workspaceRef.current.zoomToFit(); }}>Sắp xếp</button>
      </div>
      <div className="blockly-toolbar-group">
        <select aria-label="Tạo bài Blockly" value="" onChange={e => setReplacement(e.target.value)}><option value="" disabled>Tạo bài…</option><option value="starter">Mẫu Lab {labId}</option><option value="empty">Bài trống</option></select>
        <button type="button" onClick={() => inputRef.current.click()}>Nhập</button>
        <button type="button" onClick={() => downloadFile(`cubesat-lab${labId}.json`, encodeProject(workspaceRef.current, labId))}>Xuất bài</button>
        <input ref={inputRef} type="file" accept=".json,application/json" hidden onChange={importFile} aria-label="File bài Blockly" />
      </div>
    </div>
    {replacement && <div className="blockly-notice" role="alert">
      <span>Thay bài hiện tại bằng {replacement === 'starter' ? 'bài mẫu' : 'bài trống'}? Bản hiện tại sẽ được tải về để giữ lại.</span>
      <button onClick={() => { downloadFile(`lab${labId}-ban-sao.json`, encodeProject(workspaceRef.current, labId)); replace(starterWorkspace(labId, replacement === 'empty')); setReplacement(''); setNotice(''); }}>Thay bài</button>
      <button onClick={() => setReplacement('')}>Hủy</button>
    </div>}
    {notice && <div className="blockly-notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Đóng thông báo">Đóng</button></div>}
    <div className="blockly-guide">Chọn nhóm bên trái → kéo block vào <strong>Khởi tạo</strong> hoặc <strong>Lặp liên tục</strong>.</div>
    <div ref={containerRef} className="blockly-canvas" aria-label={`Vùng kéo thả Blockly Lab ${labId}`} />
    <div className={`blockly-status ${report.issues.length ? 'has-errors' : ''}`} role="status">
      <span>{report.issues.length ? `${report.issues.length} lỗi cần sửa` : 'Sẵn sàng sinh C++'} · {report.blockCount} block</span><span>{saveState}</span>
    </div>
    {report.issues.length > 0 && <div className="blockly-issues" aria-label="Lỗi chương trình">
      {report.issues.map((issue, i) => <button key={i} onClick={() => { const b = workspaceRef.current.getBlockById(issue.blockId); if (b) { b.select(); workspaceRef.current.centerOnBlock(b.id); } }}>{issue.message}</button>)}
    </div>}
  </div>;
}
