import * as Blockly from 'blockly';
import { allowedBlockTypes, registerCustomBlocks } from './blockly-toolbox.js';

export const projectKey = labId => `ptit:blockly:v1:lab:${labId}`;
export const sourceKey = labId => `ptit:source:v1:lab:${labId}`;
const value = (type, fields = {}) => ({ block: { type, fields } });
const chain = items => items.reduceRight((next, item) => ({ ...item, ...(next ? { next: { block: next } } : {}) }), null);

export function starterWorkspace(labId, empty = false) {
  const setup = [], loop = [];
  if (!empty) {
    if (labId === 1) {
      setup.push({ type: 'pin_mode', fields: { PIN: 2, MODE: 'OUTPUT' } });
      loop.push({ type: 'digital_write', fields: { PIN: 2, STATE: 'HIGH' } }, { type: 'delay_ms', fields: { MS: 500 } }, { type: 'digital_write', fields: { PIN: 2, STATE: 'LOW' } });
    } else if (labId === 2) {
      setup.push({ type: 'eps_init' });
      loop.push({ type: 'serial_print', inputs: { VALUE: value('eps_read_voltage') } });
    } else if (labId === 3) {
      setup.push({ type: 'eps_init' }, { type: 'storage_init' });
      loop.push({ type: 'storage_log', inputs: { VALUE: value('eps_read_voltage') } });
    } else if (labId === 5) {
      setup.push({ type: 'com_init' });
      loop.push({ type: 'com_send', inputs: { VALUE: value('text', { TEXT: 'Hello CubeSat' }) } }, { type: 'serial_print', inputs: { VALUE: value('com_receive') } });
    } else {
      setup.push({ type: 'sensor_init' }, { type: 'eps_init' });
      loop.push({ type: 'serial_print', inputs: { VALUE: value('sensor_read_temp') } });
    }
    loop.push({ type: 'telemetry_send', fields: { DEVICE: `cubesat-lab${labId}` } }, { type: 'delay_ms', fields: { MS: labId === 1 ? 500 : 1000 } });
  }
  return { blocks: { languageVersion: 0, blocks: [
    { type: 'arduino_setup', x: 30, y: 30, ...(setup.length ? { inputs: { DO: { block: chain(setup) } } } : {}) },
    { type: 'arduino_loop', x: 30, y: 210, ...(loop.length ? { inputs: { DO: { block: chain(loop) } } } : {}) },
  ] } };
}

export function encodeProject(workspace, labId) {
  return JSON.stringify({ format: 'ptit-blockly', version: 1, labId, workspace: Blockly.serialization.workspaces.save(workspace) }, null, 2);
}

export function decodeProject(json, labId) {
  if (typeof json !== 'string' || json.length > 1000000) throw new Error('File bài làm vượt quá 1 MB.');
  const data = JSON.parse(json);
  if (data?.format !== 'ptit-blockly' || data.version !== 1 || !data.workspace?.blocks) throw new Error('File không đúng định dạng bài Blockly phiên bản 1.');
  if (data.labId !== labId) throw new Error(`Đây là bài Lab ${data.labId}. Hãy mở đúng bài lab để nhập.`);
  const allowed = allowedBlockTypes(labId);
  let count = 0;
  const pending = [{ node: data.workspace.blocks, depth: 0 }];
  while (pending.length) {
    const { node, depth } = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (depth > 2000) throw new Error('Bài làm có quá nhiều tầng block lồng nhau.');
    if ('type' in node) {
      if (!allowed.has(node.type)) throw new Error(`Block ${node.type} không được hỗ trợ trong bài này.`);
      if (++count > 500) throw new Error('Mỗi bài làm hỗ trợ tối đa 500 block.');
    }
    for (const child of Object.values(node)) if (child && typeof child === 'object') pending.push({ node: child, depth: depth + 1 });
  }
  const state = { blocks: data.workspace.blocks, ...(data.workspace.variables ? { variables: data.workspace.variables } : {}) };
  registerCustomBlocks();
  const candidate = new Blockly.Workspace();
  try { Blockly.serialization.workspaces.load(state, candidate); }
  finally { candidate.dispose(); }
  return state;
}

export function downloadFile(name, contents, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
