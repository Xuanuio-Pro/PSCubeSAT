import test from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN_KEY, getAuthToken, saveAuthToken, clearAuthToken } from '../src/contexts/auth-storage.js';
import { loginDestination, tokenExpiresAt } from '../src/contexts/auth-session.js';

test('login destination stays internal and preserves the selected exercise', () => {
  for (const path of ['/', '/profile', '/lab0', '/lab8?lesson=Lab8-01_Custom_Mission', '/lab6?lesson=Lab6-01_Multitasking_Scheduler#editor']) assert.equal(loginDestination(path), path);
  for (const path of [undefined, null, '//evil.test', 'https://evil.test', '/login', '/lab9', '/lab1/../../evil', '/\\evil']) assert.equal(loginDestination(path), '/');
});

test('JWT expiry scheduling handles malformed and finite numeric expirations', () => {
  const token = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
  assert.equal(tokenExpiresAt(token({ exp: 12345 })), 12345000);
  for (const value of ['broken', '', token({}), token({ exp: '12345' }), token({ exp: null })]) assert.equal(tokenExpiresAt(value), null);
});

test('class and admin login destinations remain within the route allowlist', () => {
  for (const path of ['/classes', '/classes/12', '/classes/12?tab=members', '/admin/users']) assert.equal(loginDestination(path), path);
  for (const path of ['/classes/../admin', '/classes//evil.test', '/classes/0', '/admin', '/admin/users/../../evil', '/classes/%2f%2fevil.test']) assert.equal(loginDestination(path), '/');
});

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
