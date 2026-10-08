(() => {
  if (globalThis.__yttcLoaded) return;
  globalThis.__yttcLoaded = true;
  const { defaults, normalizeChannel, chatUrl, youtubeChannelKey, linkedChannel } = YTTC;
  let settings = { ...defaults };
  let panel = null;
  let host = null;
  let timer;
  let navigating = false;
  let renderedKey = '';
  let migrationPending = false;
  let sessionError = '';
  let ready = false;

  function context() {
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
  function unmount() {
    panel?.remove();
    host?.removeAttribute('data-yttc-host');
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
  function showError(message) {
    if (!panel) return;
    panel.querySelector('.yttc-settings').open = true;
    panel.querySelector('.yttc-error').textContent = message;
  }
  async function openTwitch(kind) {
    try {
      const result = await chrome.runtime.sendMessage({ action: 'open-twitch', kind, channel: selectedChannel(), dark: settings.dark });
      if (!result?.ok) throw new Error(result?.error);
    } catch { showError('Could not open Twitch. Reload the extension, then refresh YouTube.'); }
  }
  function reloadChat() {
    const frame = panel?.querySelector('iframe');
    const channel = selectedChannel();
    if (frame && channel) frame.src = chatUrl(channel, location.hostname, settings.dark);
  }
  function createPanel() {
    const root = element('section', '', { id: 'yttc-panel', 'aria-label': 'Twitch chat' });
    const config = element('details', '', { class: 'yttc-settings' });
    const summary = element('summary', '', { 'aria-label': 'Twitch chat settings' });
    summary.append(element('strong', 'Twitch chat'), element('span', 'Settings', { class: 'yttc-settings-label' }), element('span', '⌄', { class: 'yttc-chevron', 'aria-hidden': 'true' }));
    // YouTube's Space shortcut can consume native summary activation.
    summary.addEventListener('keydown', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) config.open = !config.open;
    });
    summary.addEventListener('keyup', event => {
      if (event.key === ' ' || event.key === 'Enter') event.preventDefault();
    });
    root.addEventListener('keydown', event => event.stopPropagation());
    root.addEventListener('keyup', event => event.stopPropagation());
    const form = element('form');
    const field = element('div', '', { class: 'yttc-field' });
    field.append(element('input', '', { id: 'yttc-channel', name: 'channel', placeholder: 'Paste a Twitch stream link', autocomplete: 'off', spellcheck: 'false', required: '' }), element('button', 'Open', { type: 'submit' }));
    form.append(element('label', 'Twitch stream link or channel', { for: 'yttc-channel' }), field, element('p', '', { class: 'yttc-owner' }), element('p', '', { class: 'yttc-error', role: 'alert' }));
    const nav = element('nav', '', { 'aria-label': 'Chat controls' });
    nav.append(button('Sign in', () => openTwitch('login')), button('Reload', reloadChat), button('Pop out', () => openTwitch('popout')), button('YouTube chat', () => chrome.storage.local.set({ enabled: false }).catch(() => showError('Could not save settings. Refresh YouTube and try again.'))));
    config.append(summary, form, nav, element('p', 'Twitch login connects automatically. If chat asks you to log in, use Sign in, then Reload.', { class: 'yttc-hint' }));
    root.append(config, element('div', '', { class: 'yttc-body' }));
    async function selectChannel(value) {
      const channel = normalizeChannel(value);
      if (!channel) { showError('Enter a Twitch channel name or a twitch.tv channel URL.'); return; }
      try {
        const result = await chrome.runtime.sendMessage({ action: 'save-channel-link', channel });
        if (!result?.ok) throw new Error(result?.error || 'Could not save the link');
        settings = { ...settings, ...result.settings };
        renderedKey = '';
        sync();
      } catch (error) { showError(error.message || 'Could not save settings. Refresh YouTube and try again.'); }
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
    const key = JSON.stringify([info?.keys[0], channel, settings.dark, settings.autoConnect, sessionError]);
    if (key === renderedKey) return;
    renderedKey = key;
    panel.dataset.theme = settings.dark ? 'dark' : 'light';
    panel.querySelector('.yttc-settings').open = !channel || !!sessionError;
    panel.querySelector('input').value = channel;
    panel.querySelector('input').disabled = !info;
    panel.querySelector('button[type="submit"]').disabled = !info;
    panel.querySelector('.yttc-owner').textContent = info ? `${channel ? 'Saved' : 'Will remember'} for ${info.name}.` : 'Waiting for the YouTube channel…';
    panel.querySelector('.yttc-error').textContent = sessionError;
    panel.querySelector('.yttc-hint').textContent = settings.autoConnect ? 'Twitch login connects automatically. If chat asks you to log in, use Sign in, then Reload.' : 'Twitch storage is disconnected. Restore it in Twitch login settings from the extension popup, or use Pop out.';
    const navButtons = panel.querySelectorAll('nav button');
    navButtons[1].disabled = navButtons[2].disabled = !channel;
    const body = panel.querySelector('.yttc-body');
    body.replaceChildren();
    if (!channel) {
      const empty = element('div', '', { class: 'yttc-empty' });
      empty.append(element('strong', info ? 'Link this YouTube channel' : 'Loading YouTube channel'), element('p', 'Paste its Twitch stream link above. We will remember it for the next video from this channel.'));
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
    if (!settings.enabled || navigating || location.pathname !== '/watch') { unmount(); return; }
    const native = document.querySelector('ytd-live-chat-frame:not([hidden])');
    const target = native || document.querySelector('#secondary-inner');
    if (!target) { unmount(); return; }
    if (host !== target || !panel?.isConnected) {
      unmount();
      host = target;
      panel = createPanel();
      if (native) host.setAttribute('data-yttc-host', '');
      else panel.classList.add('yttc-fallback');
      host.prepend(panel);
    }
    if (settings.channelLinks === null && context() && !migrationPending) migrate().catch(() => showError('Could not load your saved links. Refresh YouTube and try again.'));
    render();
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
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
    } catch { sessionError = 'Could not connect Twitch storage. Reload the extension and refresh YouTube.'; }
    ready = true;
    sync();
  }).catch(() => showError('Could not read settings. Refresh YouTube and try again.'));
  new MutationObserver(records => {
    if (records.some(record => !panel?.contains(record.target))) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('yt-navigate-start', () => { navigating = true; unmount(); });
  document.addEventListener('yt-navigate-finish', () => { navigating = false; schedule(); });
  window.addEventListener('popstate', schedule);
})();
