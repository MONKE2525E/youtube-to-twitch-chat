/* Shared by the popup and content script. */
(() => {
  const defaults = { enabled: true, channel: '', dark: true, channelLinks: null, autoConnect: true };
  function youtubeChannelKey(value) {
    try {
      const url = new URL(value, 'https://www.youtube.com');
      if (!['www.youtube.com', 'youtube.com'].includes(url.hostname)) return '';
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'channel' && /^UC[\w-]{22}$/.test(parts[1] || '')) return `channel:${parts[1]}`;
      if (parts[0]?.startsWith('@')) return `handle:${decodeURIComponent(parts[0].slice(1)).toLowerCase()}`;
    } catch {}
    return '';
  }
  function linkedChannel(links, keys) {
    for (const key of keys) {
      const channel = normalizeChannel(links?.[key] || '');
      if (channel) return channel;
    }
    return '';
  }
  function normalizeChannel(value) {
    const input = String(value).trim();
    let channel = input;
    if (/^(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv(?:\/|$)/i.test(input) || /^https?:\/\//i.test(input)) {
      try {
        const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
        if (!['twitch.tv', 'www.twitch.tv', 'm.twitch.tv'].includes(url.hostname)) return '';
        const parts = url.pathname.split('/').filter(Boolean);
        channel = ['popout', 'embed'].includes(parts[0]) && parts[2] === 'chat' ? parts[1] : parts[0] || '';
        if (['videos', 'directory', 'downloads', 'settings', 'login', 'signup', 'search', 'subscriptions', 'inventory', 'wallet', 'turbo', 'drops', 'p', 'jobs'].includes(channel.toLowerCase())) return '';
      } catch { return ''; }
    }
    channel = channel.replace(/^@/, '').toLowerCase();
    return /^[a-z0-9_]{1,25}$/.test(channel) ? channel : '';
  }
  function chatUrl(channel, parent, dark) {
    const url = new URL(`https://www.twitch.tv/embed/${channel}/chat`);
    url.searchParams.set('parent', parent);
    if (dark) url.searchParams.set('darkpopout', 'true');
    return url.href;
  }
  globalThis.YTTC = { defaults, normalizeChannel, chatUrl, youtubeChannelKey, linkedChannel };
})();
