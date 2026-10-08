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
