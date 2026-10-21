import test from 'node:test';
import assert from 'node:assert/strict';
import { getSerialSupport } from '../src/components/serial/serial-support.js';

const serial = { requestPort() { throw new Error('Capability detection must not request USB'); } };

test('HTTP network origins are blocked before attempting USB access', () => {
  const result = getSerialSupport({ secureContext: false, serial });
  assert.equal(result.available, false);
  assert.equal(result.code, 'https-required');
  assert.match(result.message, /HTTPS/);
});

test('trusted HTTPS and browser-trusted localhost can use native Web Serial', () => {
  const result = getSerialSupport({ secureContext: true, serial, policy: undefined });
  assert.equal(result.available, true);
  assert.equal(result.code, 'ready');
});

test('unsupported browsers are explained separately from an insecure origin', () => {
  const result = getSerialSupport({ secureContext: true, serial: undefined });
  assert.equal(result.code, 'unsupported-browser');
  assert.match(result.message, /Chrome/);
  assert.equal(result.available, false);
});

test('an iframe or server policy can deny serial even on trusted HTTPS', () => {
  const result = getSerialSupport({ secureContext: true, serial,
    policy: { allowsFeature: feature => feature !== 'serial' } });
  assert.equal(result.available, false);
  assert.equal(result.code, 'policy-blocked');
});

test('same-origin serial policy permits Web Serial without requiring policy inspection', () => {
  assert.equal(getSerialSupport({ secureContext: true, serial,
    policy: { allowsFeature: feature => feature === 'serial' } }).available, true);
  assert.equal(getSerialSupport({ secureContext: true, serial, policy: {} }).available, true);
});

test('an insecure ancestor context stays blocked even if Serial was injected', () => {
  const result = getSerialSupport({ secureContext: false, serial,
    policy: { allowsFeature: () => true } });
  assert.equal(result.code, 'https-required');
});
