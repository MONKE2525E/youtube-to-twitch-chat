const form = document.querySelector('#settings');
const status = document.querySelector('#status');
const fields = Object.fromEntries(['enabled', 'channel', 'dark'].map(key => [key, document.getElementById(key)]));
let sourceTab;
form.querySelector('button').disabled = true;
(async () => {
  const settings = await chrome.storage.local.get(YTTC.defaults);
  fields.enabled.checked = settings.enabled;
  fields.dark.checked = settings.dark;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  sourceTab = active?.id;
  let info;
  try { info = await chrome.tabs.sendMessage(sourceTab, { action: 'get-context' }); } catch {}
  if (info?.keys?.length) {
    const result = await chrome.runtime.sendMessage({ action: 'get-channel-settings', sourceTab });
    if (!result?.ok) throw new Error(result?.error);
    fields.channel.value = YTTC.linkedChannel(result.settings.channelLinks, info.keys);
    document.getElementById('youtube-channel').textContent = `Linked to ${info.name}`;
    form.querySelector('button').disabled = false;
  } else {
    fields.channel.disabled = true;
    status.textContent = 'Open a YouTube video to edit its channel link.';
    document.getElementById('save-global').hidden = false;
  }
})().catch(() => { status.textContent = 'Could not read settings. Reopen the extension on a YouTube video.'; });
async function saveGlobalSettings() {
  await chrome.storage.local.set({ enabled: fields.enabled.checked, dark: fields.dark.checked });
  status.textContent = 'Settings saved.';
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const input = fields.channel.value.trim();
  const channel = YTTC.normalizeChannel(input);
  if (input && !channel) { status.textContent = 'Enter a valid Twitch channel name or URL.'; fields.channel.focus(); return; }
  try {
    const result = await chrome.runtime.sendMessage({ action: 'save-channel-link', sourceTab, channel, enabled: fields.enabled.checked, dark: fields.dark.checked });
    if (!result?.ok) throw new Error(result?.error || 'Could not save settings');
    fields.channel.value = channel;
    status.textContent = channel ? 'Saved for this YouTube channel.' : 'Channel link removed.';
  } catch (error) { status.textContent = error.message; }
});
fields.channel.addEventListener('paste', event => {
  const text = event.clipboardData?.getData('text')?.trim();
  const channel = YTTC.normalizeChannel(text || '');
  if (!channel) return;
  event.preventDefault();
  fields.channel.value = channel;
  form.requestSubmit();
});
document.getElementById('save-global').addEventListener('click', () => saveGlobalSettings().catch(() => { status.textContent = 'Could not save settings.'; }));
document.getElementById('connect-login').addEventListener('click', async () => {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'open-twitch', kind: 'connect' });
    if (!result?.ok) throw new Error('Could not open connection page');
  } catch { status.textContent = 'Could not open connection page. Reload the extension and try again.'; }
});
