const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function background(initial, contexts) {
  const stored = structuredClone(initial);
  const rules = [];
  const chrome = {
    runtime: { id: 'extension', getURL: p => `chrome-extension://extension/${p}`, onMessage: { addListener() {} }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    storage: { local: { get: async defaults => structuredClone({ ...defaults, ...stored }), set: async values => Object.assign(stored, structuredClone(values)) } },
    tabs: { sendMessage: async id => contexts[id] },
    permissions: { contains: async () => true },
    contentSettings: { cookies: { set: async rule => rules.push(rule), get: async () => ({ setting: 'allow' }), clear: async () => { rules.length = 0; } } }
  };
  const scope = vm.createContext({ chrome, URL, crypto, importScripts: () => {} });
  vm.runInContext(fs.readFileSync('extension/shared.js', 'utf8'), scope);
  vm.runInContext(fs.readFileSync('extension/background.js', 'utf8'), scope);
  return { stored, rules, send: (message, id = 1, host = 'x.com') => scope.handleMessage(message, { id: 'extension', url: `https://${host}/`, tab: { id } }) };
}
test('X saves stay separate and preserve the pending YouTube legacy migration', async () => {
  const b = background({ channel: 'legacychat' }, { 1: { keys: ['x:handle:theo'] }, 2: { keys: ['channel:youtube'] } });
  await b.send({ action: 'save-channel-link', channel: 'xchat' });
  assert.deepEqual(b.stored.xChannelLinks, { 'x:handle:theo': 'xchat' });
  assert.equal(b.stored.channel, 'legacychat');
  assert.equal(b.stored.channelLinks, undefined);
  await b.send({ action: 'get-channel-settings' }, 2, 'www.youtube.com');
  assert.deepEqual(b.stored.channelLinks, { 'channel:youtube': 'legacychat' });
});
test('serialized saves retain both X creators and allow removing one link', async () => {
  const b = background({}, { 1: { keys: ['x:handle:first'] }, 2: { keys: ['x:handle:second'] } });
  await Promise.all([b.send({ action: 'save-channel-link', channel: 'firstchat' }), b.send({ action: 'save-channel-link', channel: 'secondchat' }, 2)]);
  assert.deepEqual(b.stored.xChannelLinks, { 'x:handle:first': 'firstchat', 'x:handle:second': 'secondchat' });
  await b.send({ action: 'save-channel-link', channel: '' });
  assert.deepEqual(b.stored.xChannelLinks, { 'x:handle:second': 'secondchat' });
  await assert.rejects(b.send({ action: 'save-channel-link', channel: 'other' }, 1, 'evil.test'), /Unsupported sender/);
});
test('cookie exceptions cover only supported sources and respect disconnect', async () => {
  const b = background({}, {});
  await b.send({ action: 'ensure-session' });
  assert.equal(b.rules.length, 6);
  for (const rule of b.rules) {
    assert.equal(rule.primaryPattern, 'https://*.twitch.tv/*');
    assert.match(rule.secondaryPattern, /^https:\/\/(www\.)?(youtube|x|twitter)\.com\/\*$/);
  }
  const disconnected = background({ autoConnect: false }, {});
  await disconnected.send({ action: 'ensure-session' });
  assert.equal(disconnected.rules.length, 0);
});
