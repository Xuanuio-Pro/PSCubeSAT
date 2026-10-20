import test from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN_KEY, getAuthToken, saveAuthToken, clearAuthToken } from '../src/contexts/auth-storage.js';

test('remember choice controls persistence and switching/logging out removes old sessions', () => {
  const memoryStorage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  };
  const previous = { localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  try {
    saveAuthToken('remembered', true);
    assert.equal(getAuthToken(), 'remembered');
    assert.equal(localStorage.getItem(TOKEN_KEY), 'remembered');
    assert.equal(sessionStorage.getItem(TOKEN_KEY), null);
    saveAuthToken('temporary');
    assert.equal(getAuthToken(), 'temporary');
    assert.equal(localStorage.getItem(TOKEN_KEY), null);
    assert.equal(sessionStorage.getItem(TOKEN_KEY), 'temporary');
    clearAuthToken();
    assert.equal(getAuthToken(), null);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
