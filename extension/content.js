(() => {
  if (globalThis.__yttcLoaded) return;
  globalThis.__yttcLoaded = true;
  const { defaults, normalizeChannel, chatUrl, youtubeChannelKey, xChannelKey, linkedChannel } = YTTC;
  const isX = !['www.youtube.com', 'youtube.com'].includes(location.hostname);
  const sourceName = isX ? 'X broadcaster' : 'YouTube channel';
  const siteName = isX ? 'X' : 'YouTube';
  let settings = { ...defaults };
  let panel = null;
  let host = null;
  let timer;
  let navigating = false;
  let renderedKey = '';
  let migrationPending = false;
  let sessionError = '';
  let ready = false;
  let collapsed = false;
  let lastCreatorKey = '';

  function xContext() {
    if (!/^\/i\/broadcasts\/[a-z0-9]+\/?$/i.test(location.pathname)) return null;
    // Metadata must belong to this broadcast before trusting the visible owner.
    const canonical = document.querySelector('meta[property="og:url"]')?.content;
    if (!canonical || new URL(canonical, location.href).pathname !== location.pathname) return null;
    const main = document.querySelector('main');
    const video = main?.querySelector('video');
    if (!video) return null;
    let container = video.parentElement;
    while (container && container !== main) {
      const owner = [...container.querySelectorAll('a[href]')].find(a =>
        !a.closest('#yttc-panel') && xChannelKey(a.href) && /^@[a-z0-9_]+$/i.test(a.textContent.trim()));
      if (owner) {
        const title = document.querySelector('meta[property="og:title"]')?.content;
        const nameMatches = [...container.querySelectorAll('a[href]')].some(a =>
          a.href === owner.href && a.textContent.trim() === title);
        if (!nameMatches) { container = container.parentElement; continue; }
        const key = xChannelKey(owner.href);
        return { keys: [key], name: owner.textContent.trim(), channel: linkedChannel(settings.xChannelLinks, [key]), platform: 'x' };
      }
      container = container.parentElement;
    }
    return null;
  }
  function xChatHost() {
    // Restricted chats may have no message list; responsive chats can be portaled
    // outside main. Find the visible chat header and keep its full panel together.
    for (const button of document.querySelectorAll('button[aria-label="Chat settings" i]')) {
      if (!button.getClientRects().length) continue;
      let header = button.parentElement;
      while (header && !['MAIN', 'BODY'].includes(header.tagName)) {
        const hasTitle = header.querySelector('h2, [role="heading"]') ||
          [...header.querySelectorAll('span')].some(span => !span.children.length && span.textContent.trim() === 'Chat');
        if (hasTitle) {
          const container = header.parentElement;
          if (container && !['MAIN', 'BODY'].includes(container.tagName) && container.children.length > 1 && !container.querySelector('video')) return container;
          break;
        }
        header = header.parentElement;
      }
    }
    return null;
  }
  function context() {
    if (isX) return xContext();
    const video = new URLSearchParams(location.search).get('v');
    const watch = document.querySelector('ytd-watch-flexy');
    if (navigating || location.pathname !== '/watch' || !video || (watch?.getAttribute('video-id') && watch.getAttribute('video-id') !== video)) return null;
    const owner = watch?.querySelector('ytd-video-owner-renderer');
    if (!owner) return null;
    const keys = [...new Set([...owner.querySelectorAll('a[href]')].map(a => youtubeChannelKey(a.href)).filter(Boolean))];
    keys.sort((a, b) => Number(b.startsWith('channel:')) - Number(a.startsWith('channel:')));
    if (!keys.length) return null;
    const name = owner.querySelector('#channel-name a, #text a')?.textContent.trim() || 'this YouTube channel';
    return { keys, name, channel: linkedChannel(settings.channelLinks, keys) };
  }
  function selectedChannel() { return context()?.channel || ''; }
  function isLive() {
    const video = new URLSearchParams(location.search).get('v');
    const watch = document.querySelector('ytd-watch-flexy');
    if (!video || watch?.getAttribute('video-id') !== video) return false;
    // Broadcast metadata includes dates, unlike chat replay and the LIVE badge.
    // Watch pages render it as microdata on the VideoObject; JSON-LD is a fallback.
    for (const scope of document.querySelectorAll('[itemtype="http://schema.org/VideoObject"]')) {
      const publication = [...scope.querySelectorAll('[itemprop="publication"]')].map(event => ({
        isLiveBroadcast: event.querySelector('[itemprop="isLiveBroadcast"]')?.content === 'True',
        endDate: event.querySelector('[itemprop="endDate"]')?.content,
      }));
      if (YTTC.liveBroadcast({ '@id': scope.getAttribute('itemid'), publication }, video)) return true;
    }
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent);
        const entries = Array.isArray(data) ? data : data['@graph'] || [data];
        if (entries.some(entry => YTTC.liveBroadcast(entry, video))) return true;
      } catch {}
    }
    return false;
  }
  function unmount() {
    panel?.remove();
    host?.removeAttribute('data-yttc-host');
    host?.removeAttribute('data-yttc-collapsed');
    panel = host = null;
    renderedKey = '';
  }
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = undefined; sync(); }, 120);
  }
  function element(tag, text, attributes = {}) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }
  function button(label, handler) {
    const node = element('button', label, { type: 'button' });
    node.addEventListener('click', handler);
    return node;
  }
  // YouTube's Space shortcut can consume native summary activation.
  function keyActivation(node, handler) {
    node.addEventListener('keydown', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) handler();
    });
    node.addEventListener('keyup', event => {
      if (event.key === ' ' || event.key === 'Enter') event.preventDefault();
    });
  }
  function setCollapsed(value) {
    collapsed = value;
    applyCollapsed();
  }
  function applyCollapsed() {
    if (!panel) return;
    panel.classList.toggle('yttc-collapsed', collapsed);
    panel.querySelector('.yttc-content').hidden = collapsed;
    const toggle = panel.querySelector('.yttc-collapse');
    toggle.textContent = collapsed ? 'Show chat' : 'Hide chat';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    host?.toggleAttribute('data-yttc-collapsed', collapsed && host.hasAttribute('data-yttc-host'));
  }
  function showError(message) {
    if (!panel) return;
    setCollapsed(false);
    panel.querySelector('.yttc-settings').open = true;
    panel.querySelector('.yttc-error').textContent = message;
  }
  async function openTwitch(kind) {
    try {
      const result = await chrome.runtime.sendMessage({ action: 'open-twitch', kind, channel: selectedChannel(), dark: settings.dark });
      if (!result?.ok) throw new Error(result?.error);
    } catch { showError('Could not open Twitch. Reload the extension, then refresh the video page.'); }
  }
  function reloadChat() {
    const frame = panel?.querySelector('iframe');
    const channel = selectedChannel();
    if (frame && channel) frame.src = chatUrl(channel, location.hostname, settings.dark);
  }
  function createPanel() {
    const root = element('section', '', { id: 'yttc-panel', 'aria-label': 'Twitch chat' });
    const collapse = element('button', 'Hide chat', { type: 'button', class: 'yttc-collapse', 'aria-controls': 'yttc-content', 'aria-expanded': 'true' });
    collapse.addEventListener('click', () => setCollapsed(!collapsed));
    keyActivation(collapse, () => setCollapsed(!collapsed));
    const bar = element('header', '', { class: 'yttc-bar' });
    bar.append(element('strong', 'Twitch chat'), collapse);
    const config = element('details', '', { class: 'yttc-settings' });
    const summary = element('summary', '', { 'aria-label': 'Twitch chat settings' });
    summary.append(element('span', 'Settings', { class: 'yttc-settings-label' }), element('span', '⌄', { class: 'yttc-chevron', 'aria-hidden': 'true' }));
    keyActivation(summary, () => { config.open = !config.open; });
    root.addEventListener('keydown', event => event.stopPropagation());
    root.addEventListener('keyup', event => event.stopPropagation());
    const form = element('form');
    const field = element('div', '', { class: 'yttc-field' });
    field.append(element('input', '', { id: 'yttc-channel', name: 'channel', placeholder: 'Paste a Twitch stream link', autocomplete: 'off', spellcheck: 'false', required: '' }), element('button', 'Open', { type: 'submit' }));
    form.append(element('label', 'Twitch stream link or channel', { for: 'yttc-channel' }), field, element('p', '', { class: 'yttc-owner' }), element('p', '', { class: 'yttc-error', role: 'alert' }));
    const nav = element('nav', '', { 'aria-label': 'Chat controls' });
    nav.append(button('Sign in', () => openTwitch('login')), button('Reload', reloadChat), button('Pop out', () => openTwitch('popout')), button(`${siteName} chat`, () => chrome.storage.local.set({ enabled: false }).catch(() => showError('Could not save settings. Refresh the video page and try again.'))));
    config.append(summary, form, nav, element('p', 'Twitch login connects automatically. If chat asks you to log in, use Sign in, then Reload.', { class: 'yttc-hint' }));
    const content = element('div', '', { id: 'yttc-content', class: 'yttc-content' });
    content.append(config, element('div', '', { class: 'yttc-body' }));
    root.append(bar, content);

    async function selectChannel(value) {
      const channel = normalizeChannel(value);
      if (!channel) { showError('Enter a Twitch channel name or a twitch.tv channel URL.'); return; }
      try {
        const result = await chrome.runtime.sendMessage({ action: 'save-channel-link', channel });
        if (!result?.ok) throw new Error(result?.error || 'Could not save the link');
        settings = { ...settings, ...result.settings };
        renderedKey = '';
        sync();
      } catch (error) { showError(error.message || 'Could not save settings. Refresh the video page and try again.'); }
    }
    form.addEventListener('submit', event => { event.preventDefault(); selectChannel(root.querySelector('input').value); });
    root.querySelector('input').addEventListener('paste', event => {
      const text = event.clipboardData?.getData('text')?.trim();
      if (!text || !normalizeChannel(text)) return;
      event.preventDefault();
      root.querySelector('input').value = text;
      selectChannel(text);
    });
    return root;
  }
  function render() {
    if (!panel) return;
    const info = context();
    const channel = info?.channel || '';
    if (info && info.keys[0] !== lastCreatorKey) {
      lastCreatorKey = info.keys[0];
      if (!channel) collapsed = false;
    }
    const key = JSON.stringify([info?.keys[0], channel, settings.dark, settings.autoConnect, sessionError]);
    if (key === renderedKey) return;
    renderedKey = key;
    if (sessionError) collapsed = false;
    applyCollapsed();
    panel.dataset.theme = settings.dark ? 'dark' : 'light';
    panel.querySelector('.yttc-settings').open = !channel || !!sessionError;
    panel.querySelector('input').value = channel;
    panel.querySelector('input').disabled = !info;
    panel.querySelector('button[type="submit"]').disabled = !info;
    panel.querySelector('.yttc-owner').textContent = info ? `${channel ? 'Saved' : 'Will remember'} for ${info.name}.` : `Waiting for the ${sourceName}…`;
    panel.querySelector('.yttc-error').textContent = sessionError;
    panel.querySelector('.yttc-hint').textContent = settings.autoConnect ? 'Twitch login connects automatically. If chat asks you to log in, use Sign in, then Reload.' : 'Twitch storage is disconnected. Restore it in Twitch login settings from the extension popup, or use Pop out.';
    const navButtons = panel.querySelectorAll('nav button');
    navButtons[1].disabled = navButtons[2].disabled = !channel;
    const body = panel.querySelector('.yttc-body');
    body.replaceChildren();
    if (!channel) {
      const empty = element('div', '', { class: 'yttc-empty' });
      empty.append(element('strong', info ? `Link this ${sourceName}` : `Loading ${sourceName}`), element('p', 'Paste its Twitch stream link above. We will remember it for the next stream from this creator.'));
      body.append(empty);
      return;
    }
    const frame = element('iframe', '', { title: `Twitch chat for ${channel}`, allow: 'storage-access', referrerpolicy: 'strict-origin-when-cross-origin' });
    frame.src = chatUrl(channel, location.hostname, settings.dark);
    body.append(frame);
  }
  async function migrate() {
    migrationPending = true;
    try {
      const result = await chrome.runtime.sendMessage({ action: 'get-channel-settings' });
      if (result?.ok) settings = { ...settings, ...result.settings };
    } finally { migrationPending = false; schedule(); }
  }
  function sync() {
    if (!ready) return;
    if (!settings.enabled || navigating || (isX ? !/^\/i\/broadcasts\/[a-z0-9]+\/?$/i.test(location.pathname) : (location.pathname !== '/watch' || !isLive()))) { unmount(); return; }
    const native = isX ? xChatHost() : document.querySelector('ytd-live-chat-frame:not([hidden])');
    const target = native || (!isX && document.querySelector('#secondary-inner'));
    if (!target) { unmount(); return; }
    if (host !== target || !panel?.isConnected) {
      unmount();
      host = target;
      panel = createPanel();
      if (native) host.setAttribute('data-yttc-host', isX ? 'x' : '');
      else panel.classList.add('yttc-fallback');
      host.prepend(panel);
    }
    if (!isX && settings.channelLinks === null && context() && !migrationPending) migrate().catch(() => showError('Could not load your saved links. Refresh the video page and try again.'));
    render();
  }
  function chatDiagnostics() {
    const visible = node => !!node?.getClientRects().length;
    const structure = node => ({
      tag: node.tagName.toLowerCase(), role: node.getAttribute('role'),
      children: node.children.length, visible: visible(node),
      video: !!node.querySelector('video'),
      headings: [...node.querySelectorAll('h1,h2,h3,[role="heading"]')].filter(n => n.textContent.trim() === 'Chat').length,
      buttons: [...node.querySelectorAll('button')].slice(0, 8).map(button => {
        const label = button.getAttribute('aria-label') || button.getAttribute('title') || '';
        return /^(chat|chat settings|chat messages|more|more options|settings|send|send message|emoji)$/i.test(label) ? label : label ? '(other label)' : '(no label)';
      }),
    });
    const headings = [...document.querySelectorAll('h1,h2,h3,[role="heading"],div,span,p,strong')].filter(n => !n.childElementCount && n.textContent.trim() === 'Chat');
    return {
      version: chrome.runtime.getManifest().version,
      host: location.hostname, ready, enabled: settings.enabled,
      panel: !!panel?.isConnected, target: !!xChatHost(),
      chatButtons: document.querySelectorAll('button[aria-label="Chat settings" i]').length,
      messageLists: document.querySelectorAll('[aria-label="Chat messages"]').length,
      headers: headings.slice(0, 4).map(heading => {
        const ancestors = [];
        for (let node = heading; node && ancestors.length < 5 && !['MAIN', 'BODY'].includes(node.tagName); node = node.parentElement) ancestors.push(structure(node));
        return ancestors;
      }),
      frameHosts: [...document.querySelectorAll('iframe')].map(frame => {
        try { return new URL(frame.src, location.href).hostname; } catch { return '(unknown)'; }
      }),
      shadowRoots: [...document.querySelectorAll('*')].filter(node => node.shadowRoot).length,
    };
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.action === 'get-chat-diagnostics') respond(chatDiagnostics());
    if (message?.action === 'get-context') respond(context());
    if (message?.action === 'reload-chat') reloadChat();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const key of Object.keys(defaults)) if (changes[key]) settings[key] = changes[key].newValue ?? defaults[key];
    if (changes.connectionRevision) { sessionError = ''; reloadChat(); }
    schedule();
  });
  chrome.storage.local.get(defaults).then(async value => {
    settings = { ...defaults, ...value };
    try {
      const result = await chrome.runtime.sendMessage({ action: 'ensure-session' });
      if (!result?.ok) sessionError = result?.error || 'Could not connect Twitch storage. Use Pop out or check your browser settings.';
    } catch { sessionError = 'Could not connect Twitch storage. Reload the extension and refresh the video page.'; }
    ready = true;
    sync();
  }).catch(() => showError('Could not read settings. Refresh the video page and try again.'));
  new MutationObserver(records => {
    if (records.some(record => !panel?.contains(record.target))) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'content', 'video-id', 'hidden'] });
  document.addEventListener('yt-navigate-start', () => { navigating = true; unmount(); });
  document.addEventListener('yt-navigate-finish', () => { navigating = false; schedule(); });
  window.addEventListener('popstate', schedule);
  // X uses history.pushState without YouTube's navigation events.
  if (isX) {
    window.addEventListener('resize', schedule);
    let previousUrl = location.href;
    setInterval(() => {
      if (previousUrl === location.href) return;
      previousUrl = location.href;
      unmount();
      schedule();
    }, 250);
  }
})();
