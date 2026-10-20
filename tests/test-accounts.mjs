import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {generateKeyPair, exportJWK, createLocalJWKSet, SignJWT} from 'jose';
import {verifyIdentity} from '../service/worker/identity.mjs';
import {createAccounts} from '../client/accounts-core.mjs';
const {resumeOrCreate} = createRequire(import.meta.url)('../dist/online-session.js');
const memory = () => {
  const data = new Map();
  return {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key)};
};
const id = 'ab817617-20ea-4c6d-b1f4-2ae32272b449';
const session = (anonymous = true) => ({user: {id, is_anonymous: anonymous}, access_token: 'access'});

test('timeouts, server failures and expired sessions never replace a remembered legacy guest', async () => {
  for (const status of [0, 401, 500]) {
    const store = memory(); store.setItem('afterhours-online-token', 'original');
    const paths = [];
    await assert.rejects(resumeOrCreate(store, async path => {
      paths.push(path); throw Object.assign(Error('unavailable'), {status});
    }, 'Nightowl', 0));
    assert.deepEqual(paths, ['/api/state']);
    assert.equal(store.getItem('afterhours-online-token'), 'original');
  }
});
test('successful legacy reconnect returns the original character without guest creation', async () => {
  const store = memory();store.setItem('afterhours-online-token', 'original');
  const result = await resumeOrCreate(store, async (path, body, token) => {
    assert.equal(path, '/api/state');assert.equal(token, 'original');return {self: {id}};
  });
  assert.equal(result.token, 'original');assert.equal(result.snapshot.self.id, id);
});
test('managed guest requires CAPTCHA and preserves identity through refresh failures', async () => {
  const store = memory();let current = null, fail = false, creations = 0;
  const auth = {
    async getSession() {return {data: {session: current}, error: fail ? Error('offline') : null};},
    async signInAnonymously(args) {
      assert.equal(args.options.captchaToken, 'challenge');creations++;current = session();return {data: {session: current}};
    }
  };
  const account = createAccounts(auth, store, () => {}, 'https://play.example.test/game/account-callback.html');
  await assert.rejects(account.enter(), /security check/);
  assert.equal(await account.enter('challenge'), 'access');
  fail = true;
  await assert.rejects(account.enter('challenge'), /offline/);
  assert.equal(creations, 1);assert.equal(store.getItem('afterhours-account-id'), id);
  fail = false;current = null;
  await assert.rejects(account.enter('challenge'), /Restore account/);
  assert.equal(creations, 1);
});
test('linking preserves the guest ID and recovery explicitly selects the linked identity', async () => {
  const store = memory();let current = session();let redirect;
  const auth = {
    async getSession() {return {data: {session: current}};},
    async linkIdentity(args) {assert.equal(args.provider, 'google');return {data: {url: 'https://accounts.google.com/'}};},
    async signInWithOAuth() {return {data: {url: 'https://accounts.google.com/'}};},
    async exchangeCodeForSession(code) {assert.equal(code, 'one-use');current = session(false);return {data: {session: current}};}
  };
  const account = createAccounts(auth, store, url => {redirect = url;}, 'https://play.example.test/game/account-callback.html');
  await account.enter();
  await account.link();assert.equal(redirect, 'https://accounts.google.com/');
  await account.finish('?code=one-use');
  assert.equal(store.getItem('afterhours-account-id'), id);assert.equal((await account.current()).anonymous, false);
  const newDevice = memory();
  const restored = createAccounts(auth, newDevice, () => {}, 'https://play.example.test/game/account-callback.html');
  await restored.restore();await restored.finish('?code=one-use');
  assert.equal(newDevice.getItem('afterhours-account-id'), id);
});
test('link callback rejects an unexpected account without moving the remembered character', async () => {
  const store = memory();store.setItem('afterhours-account-id', id);
  store.setItem('afterhours-account-flow', JSON.stringify({mode: 'link', id}));
  const account = createAccounts({exchangeCodeForSession: async () => ({data: {session: {user: {id: 'different'}}}})}, store);
  await assert.rejects(account.finish('?code=one-use'), /did not match/);
  assert.equal(store.getItem('afterhours-account-id'), id);
});
test('server verifies signed identity, expiry, issuer, audience and role', async () => {
  const pair = await generateKeyPair('ES256'), jwk = await exportJWK(pair.publicKey);
  const keys = createLocalJWKSet({keys: [{...jwk, kid: 'test', alg: 'ES256'}]});
  const make = (overrides = {}) => new SignJWT({sub: id, role: 'authenticated', is_anonymous: true,
    iss: 'https://project.supabase.co/auth/v1', aud: 'authenticated', iat: Math.floor(Date.now()/1000),
    exp: Math.floor(Date.now()/1000)+300, ...overrides}).setProtectedHeader({alg: 'ES256', kid: 'test'}).sign(pair.privateKey);
  assert.deepEqual(await verifyIdentity(await make(), 'https://project.supabase.co', keys), {id, anonymous: true});
  for (const bad of [{exp: 1}, {iss: 'https://attacker.test'}, {aud: 'other'}, {role: 'service_role'}, {sub: '__proto__'}, {is_anonymous: 'true'}])
    await assert.rejects(verifyIdentity(await make(bad), 'https://project.supabase.co', keys));
  const other = await generateKeyPair('ES256');
  const forged = await new SignJWT({sub: id}).setProtectedHeader({alg: 'ES256', kid: 'test'}).sign(other.privateKey);
  await assert.rejects(verifyIdentity(forged, 'https://project.supabase.co', keys));
});
