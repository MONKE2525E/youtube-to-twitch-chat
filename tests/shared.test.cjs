const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../extension/shared.js');
test('accepts names and Twitch URLs without accepting other hosts or unsafe input', () => {
  for (const [input, expected] of [
    [' @TwitchDev ', 'twitchdev'], ['https://www.twitch.tv/TwitchDev?foo=1', 'twitchdev'],
    ['twitch.tv/TwitchDev', 'twitchdev'], ['m.twitch.tv/TwitchDev', 'twitchdev'],
    ['https://www.twitch.tv/popout/TwitchDev/chat?darkpopout', 'twitchdev'],
    ['https://www.twitch.tv/embed/TwitchDev/chat?parent=www.youtube.com', 'twitchdev'],
    ['https://www.twitch.tv/videos/1234', ''], ['https://www.twitch.tv/directory', ''],
    ['https://twitch.tv.evil.test/foo', ''], ['https://evil.test/twitchdev', ''],
    ['foo/bar', ''], ['<script>', ''], ['', ''], ['a'.repeat(26), '']
  ]) assert.equal(YTTC.normalizeChannel(input), expected);
});
test('constructs official embeds with the current parent and theme', () => {
  const dark = new URL(YTTC.chatUrl('twitchdev', 'www.youtube.com', true));
  assert.equal(dark.pathname, '/embed/twitchdev/chat');
  assert.equal(dark.searchParams.get('parent'), 'www.youtube.com');
  assert.equal(dark.searchParams.get('darkpopout'), 'true');
  assert.equal(new URL(YTTC.chatUrl('twitchdev', 'youtube.com', false)).searchParams.has('darkpopout'), false);
});
test('channel identity prefers stable IDs and accepts handle aliases', () => {
  assert.equal(YTTC.youtubeChannelKey('/channel/UCSJ4gkVC6NrvII8umztf0Ow'), 'channel:UCSJ4gkVC6NrvII8umztf0Ow');
  assert.equal(YTTC.youtubeChannelKey('/@LofiGirl'), 'handle:lofigirl');
  assert.equal(YTTC.youtubeChannelKey('https://evil.test/@LofiGirl'), '');
  assert.equal(YTTC.youtubeChannelKey('/watch?v=123'), '');
  const links = { 'channel:first': 'twitchdev', 'channel:second': 'twitch' };
  assert.equal(YTTC.linkedChannel(links, ['channel:first']), 'twitchdev');
  assert.equal(YTTC.linkedChannel(links, ['channel:second']), 'twitch');
  assert.equal(YTTC.linkedChannel(links, ['channel:third']), '');
});
test('X identities are namespaced, normalized, and limited to profile URLs', () => {
  for (const input of ['/Theo', 'https://x.com/theo', 'https://twitter.com/THEO/']) {
    assert.equal(YTTC.xChannelKey(input), 'x:handle:theo');
  }
  for (const input of ['/i/broadcasts/123', '/home', '/messages', '/theo/status/123', 'https://evil.test/theo', '/name-too-long-for-x']) {
    assert.equal(YTTC.xChannelKey(input), '');
  }
  assert.equal(YTTC.linkedChannel({ 'handle:theo': 'youtubechat' }, ['x:handle:theo']), '');
  const embed = new URL(YTTC.chatUrl('twitchdev', 'x.com', true));
  assert.equal(embed.searchParams.get('parent'), 'x.com');
});

test('broadcast detection accepts live and upcoming streams but not replays or other videos', () => {
  const now = Date.parse('2026-10-14T22:15:00Z');
  const scope = (publication, id = 'https://www.youtube.com/watch?v=abc123') => ({ '@id': id, publication });
  const live = { isLiveBroadcast: true, startDate: '2026-10-14T20:00:00Z' };
  const upcoming = { isLiveBroadcast: true, startDate: '2026-10-14T22:30:00Z' };
  const replay = { isLiveBroadcast: true, startDate: '2026-10-14T20:00:00Z', endDate: '2026-10-14T21:00:00Z' };
  assert.equal(YTTC.liveBroadcast(scope(live), 'abc123', now), true);
  assert.equal(YTTC.liveBroadcast(scope(upcoming), 'abc123', now), true);
  assert.equal(YTTC.liveBroadcast(scope([replay, live]), 'abc123', now), true);
  assert.equal(YTTC.liveBroadcast(scope(replay), 'abc123', now), false);
  assert.equal(YTTC.liveBroadcast(scope(live), 'other999', now), false);
  assert.equal(YTTC.liveBroadcast(scope(live, 'https://evil.test/watch?v=abc123'), 'abc123', now), false);
  assert.equal(YTTC.liveBroadcast(scope(undefined), 'abc123', now), false);
  assert.equal(YTTC.liveBroadcast(scope([{ isLiveBroadcast: false }]), 'abc123', now), false);
});
