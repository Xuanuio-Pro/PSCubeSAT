import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadFlashFiles, sha256, validateManifest, writeArtifact } from '../src/components/serial/flash-artifact.js';

async function fixture() {
  const data = new Uint8Array([1, 2, 3, 4]);
  const artifact = { id: 'a'.repeat(32), chip: 'esp32s3', board: 'esp32s3',
    expires_at: new Date(Date.now() + 60000).toISOString(), source_sha256: await sha256(new TextEncoder().encode('code')),
    flash: { mode: 'dio', frequency: '80m', size: '8MB', files: await Promise.all([
      ['bootloader.bin', 0], ['partitions.bin', 0x8000], ['boot_app0.bin', 0xe000], ['firmware.bin', 0x10000],
    ].map(async ([name, offset]) => ({ name, offset, size: data.length, sha256: await sha256(data) }))) } };
  return { artifact, data };
}

test('downloads all four images with auth, exact offsets and verified hashes', async () => {
  const { artifact, data } = await fixture();
  const requests = [];
  const files = await downloadFlashFiles(artifact, 'code', 'token', async (url, options) => {
    requests.push(url);
    assert.equal(options.headers.Authorization, 'Bearer token');
    return new Response(data);
  });
  assert.equal(requests.length, 4);
  assert.deepEqual(files.map(f => f.address), [0, 0x8000, 0xe000, 0x10000]);
});

test('rejects expired, missing, overlapping or wrong-board artifacts', async () => {
  const { artifact } = await fixture();
  for (const mutate of [a => { a.expires_at = '2000-01-01'; }, a => { a.flash.files.pop(); },
    a => { a.flash.files[1].offset = 0; }, a => { a.board = 'esp32'; }]) {
    const copy = structuredClone(artifact); mutate(copy);
    assert.throws(() => validateManifest(copy));
  }
});

test('changed source cannot download or flash an old build', async () => {
  const { artifact } = await fixture();
  await assert.rejects(downloadFlashFiles(artifact, 'edited', null, () => { throw new Error('must not fetch'); }), /Code đã thay đổi/);
});

test('download failure and corrupt content stop flashing preparation', async () => {
  const { artifact } = await fixture();
  await assert.rejects(downloadFlashFiles(artifact, 'code', null, async () => new Response(null, { status: 410 })), /HTTP 410/);
  await assert.rejects(downloadFlashFiles(artifact, 'code', null, async () => new Response(new Uint8Array([9, 8, 7, 6]))), /Hash/);
});

test('chip mismatch never writes flash', async () => {
  const { artifact } = await fixture();
  let writes = 0;
  const loader = { main: async () => {}, chip: { CHIP_NAME: 'ESP32' }, writeFlash: async () => { writes++; } };
  await assert.rejects(writeArtifact(loader, artifact, [], () => {}), /không khớp/);
  assert.equal(writes, 0);
});

test('uses real write progress and MD5 verification, then reset before 100 percent', async () => {
  const { artifact, data } = await fixture();
  const events = [];
  const loader = { main: async () => {}, chip: { CHIP_NAME: 'ESP32-S3' },
    writeFlash: async options => {
      assert.equal(options.eraseAll, false);
      assert.equal(options.calculateMD5Hash(data), '08d6c05a21512a79a1dfeb9d2a8f262f');
      options.reportProgress(0, 4, 4);
      events.push('verified');
    }, after: async mode => { assert.equal(mode, 'hard_reset'); events.push('reset'); } };
  await writeArtifact(loader, artifact, [{ data, address: 0 }], value => events.push(value));
  assert.deepEqual(events, [99, 'verified', 'reset', 100]);
  loader.writeFlash = async () => { throw new Error('USB lost'); };
  events.length = 0;
  await assert.rejects(writeArtifact(loader, artifact, [{ data, address: 0 }], value => events.push(value)), /USB lost/);
  assert.deepEqual(events, []);
});
