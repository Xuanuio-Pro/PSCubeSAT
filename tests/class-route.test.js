import test from 'node:test';
import assert from 'node:assert/strict';
import { classRouteTarget } from '../src/components/classes/class-route.js';

test('old /classes/labN alias redirects to the lab page', () => {
  assert.deepEqual(classRouteTarget('/classes/lab3'), { kind: 'redirect', to: '/lab3' });
  assert.deepEqual(classRouteTarget('/classes/lab0/'), { kind: 'redirect', to: '/lab0' });
  assert.deepEqual(classRouteTarget('/classes/LAB8'), { kind: 'redirect', to: '/lab8' });
});

test('numeric class ids and the class list pass through', () => {
  for (const path of ['/classes', '/classes/', '/classes/12', '/classes/12/learn', '/classes/7/labs/3/questions', '/profile']) {
    assert.deepEqual(classRouteTarget(path), { kind: 'pass' }, path);
  }
});

test('non-numeric class ids are a 404 instead of reaching the API', () => {
  for (const path of ['/classes/lab9', '/classes/abc', '/classes/lab3/learn', '/classes/12abc/progress']) {
    assert.deepEqual(classRouteTarget(path), { kind: 'not-found' }, path);
  }
});
