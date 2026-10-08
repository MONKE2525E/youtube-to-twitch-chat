importScripts('shared.js');
let settingsQueue = Promise.resolve();
function queued(work) {
  const next = settingsQueue.then(work, work);
  settingsQueue = next.catch(() => {});
  return next;
}
function isExtensionPage(sender) {
  return sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL(''));
}
function isYouTube(sender) {
  try {
    const url = new URL(sender.url);
    return sender.id === chrome.runtime.id && url.protocol === 'https:' && ['www.youtube.com', 'youtube.com'].includes(url.hostname);
  } catch { return false; }
}
async function reloadChats() {
  await chrome.storage.local.set({ connectionRevision: crypto.randomUUID() });
}
async function ensureSession(force = false) {
  const { autoConnect } = await chrome.storage.local.get({ autoConnect: true });
  if (!force && !autoConnect) return;
  if (!await chrome.permissions.contains({ permissions: ['contentSettings'] })) throw new Error('Approve the extension\'s site-settings permission in your browser, then refresh YouTube');
  try {
    for (const youtube of ['www.youtube.com', 'youtube.com']) {
      await chrome.contentSettings.cookies.set({ primaryPattern: 'https://*.twitch.tv/*', secondaryPattern: `https://${youtube}/*`, setting: 'allow', scope: 'regular' });
    }
    for (const youtube of ['www.youtube.com', 'youtube.com']) {
      const result = await chrome.contentSettings.cookies.get({ primaryUrl: 'https://www.twitch.tv/', secondaryUrl: `https://${youtube}/` });
      if (result.setting !== 'allow') throw new Error('Your browser policy is blocking Twitch cookies. Use Pop out');
    }
  } catch (error) {
    await chrome.contentSettings.cookies.clear({ scope: 'regular' });
    throw error;
  }
  if (force) await chrome.storage.local.set({ autoConnect: true });
}
async function sourceContext(sender, sourceTab) {
  const tabId = isYouTube(sender) ? sender.tab?.id : sourceTab;
  if (!Number.isInteger(tabId)) throw new Error('Open a YouTube video to save a channel link');
  const info = await chrome.tabs.sendMessage(tabId, { action: 'get-context' });
  if (!info?.keys?.length) throw new Error('Wait for the YouTube channel to load, then try again');
  return info;
}
async function channelSettings(sender, message) {
  return queued(async () => {
    const info = await sourceContext(sender, message.sourceTab);
    const settings = await chrome.storage.local.get(YTTC.defaults);
    if (settings.channelLinks === null) {
      settings.channelLinks = {};
      const previous = YTTC.normalizeChannel(settings.channel);
      if (previous) for (const key of info.keys) settings.channelLinks[key] = previous;
      await chrome.storage.local.set({ channelLinks: settings.channelLinks });
    }
    if (message.action === 'save-channel-link') {
      const channel = YTTC.normalizeChannel(message.channel || '');
      if (message.channel && !channel) throw new Error('Enter a Twitch channel name or stream link');
      for (const key of info.keys) {
        if (channel) settings.channelLinks[key] = channel;
        else delete settings.channelLinks[key];
      }
      const values = { channelLinks: settings.channelLinks, channel };
      if (typeof message.enabled === 'boolean') values.enabled = message.enabled;
      if (typeof message.dark === 'boolean') values.dark = message.dark;
      await chrome.storage.local.set(values);
      Object.assign(settings, values);
    }
    return { ok: true, settings };
  });
}
async function handleMessage(message, sender) {
  if (!isExtensionPage(sender) && !isYouTube(sender)) throw new Error('Unsupported sender');
  if (['save-channel-link', 'get-channel-settings'].includes(message?.action)) return channelSettings(sender, message);
  if (message?.action === 'ensure-session') { await ensureSession(); return { ok: true }; }
  if (message?.action === 'open-twitch') {
    let url;
    if (message.kind === 'connect') {
      url = chrome.runtime.getURL('connect.html');
      if (isYouTube(sender) && Number.isInteger(sender.tab?.id)) url += `?sourceTab=${sender.tab.id}`;
    } else if (message.kind === 'login') {
      await ensureSession();
      url = 'https://www.twitch.tv/login';
    } else if (message.kind === 'popout') {
      const channel = YTTC.normalizeChannel(message.channel);
      if (!channel) throw new Error('Choose a Twitch channel first');
      url = `https://www.twitch.tv/popout/${channel}/chat${message.dark ? '?darkpopout' : ''}`;
    } else throw new Error('Unsupported Twitch action');
    await chrome.tabs.create({ url, active: true });
    return { ok: true };
  }
  if (message?.action === 'connect-session') {
    if (!isExtensionPage(sender)) throw new Error('Open the connection page first');
    await ensureSession(true);
    await reloadChats();
    return { ok: true };
  }
  if (message?.action === 'disconnect-session') {
    if (!isExtensionPage(sender)) throw new Error('Open the connection page first');
    await chrome.contentSettings.cookies.clear({ scope: 'regular' });
    await chrome.storage.local.set({ autoConnect: false });
    await reloadChats();
    return { ok: true };
  }
  throw new Error('Unsupported action');
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  handleMessage(message, sender).then(respond, error => respond({ ok: false, error: error.message }));
  return true;
});
chrome.runtime.onInstalled.addListener(() => { ensureSession().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { ensureSession().catch(() => {}); });
