const status = document.getElementById('status');
const connect = document.getElementById('connect');
const sourceValue = new URLSearchParams(location.search).get('sourceTab');
const sourceTab = sourceValue !== null && /^\d+$/.test(sourceValue) ? Number(sourceValue) : undefined;
async function send(action) {
  const result = await chrome.runtime.sendMessage({ action, sourceTab });
  if (!result?.ok) throw new Error(result?.error || 'Could not connect. Reload the extension and try again.');
}
connect.addEventListener('click', async () => {
  // Request directly in an extension-page click so the browser can show its permission prompt.
  const permission = chrome.permissions.request({ permissions: ['contentSettings'] });
  connect.disabled = true;
  try {
    if (!await permission) {
      status.textContent = 'Approve the extension permission in your browser to connect Twitch storage. You can still use Pop out.';
      return;
    }
    await send('connect-session');
    status.textContent = 'Twitch cookie access is enabled on YouTube and X. Your chat has been reloaded.';
    document.getElementById('return').hidden = !Number.isInteger(sourceTab);
  } catch (error) {
    status.textContent = `${error.message}. Use Pop out if your browser continues to block the embedded login.`;
  } finally { connect.disabled = false; }
});
document.getElementById('login').addEventListener('click', async () => {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'open-twitch', kind: 'login' });
    if (!result?.ok) throw new Error('Could not open Twitch');
  } catch { status.textContent = 'Could not open Twitch. Reload the extension and try again.'; }
});
document.getElementById('return').addEventListener('click', async () => {
  try { await chrome.tabs.update(sourceTab, { active: true }); }
  catch { status.textContent = 'Your video tab has closed. Open a YouTube video or X broadcast to use chat.'; }
});
document.getElementById('disconnect').addEventListener('click', async () => {
  try {
    await send('disconnect-session');
    status.textContent = 'The extension\'s Twitch cookie exceptions have been removed. Refresh the video page to reset chat.';
    document.getElementById('return').hidden = !Number.isInteger(sourceTab);
  } catch (error) { status.textContent = error.message; }
});
