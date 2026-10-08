# YouTube to Twitch Chat

A Manifest V3 extension for Chrome, Chromium, Edge, and Brave. It places Twitch's official chat in YouTube's chat panel. On watch pages without a YouTube chat panel, it adds chat above the recommended videos.

## Install

1. Extract `youtube-to-twitch-chat.zip` to a folder you will keep.
2. Open `chrome://extensions` or `edge://extensions`.
3. Turn on **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`. If using this source checkout, select `extension/`.
4. Refresh an existing YouTube tab. Open the extension's toolbar popup or use the channel field beside the video. Enter a Twitch channel name or channel URL.

Each YouTube channel remembers its own Twitch chat link. The extension uses the YouTube channel ID when available and also saves its handle as an alias. A channel you have not linked starts with the setup dropdown open. After you paste a Twitch link, the dropdown closes; it remains closed when you return to that YouTube channel. Open **Settings** in the compact header to change a saved link.

When upgrading from the earlier version, the last selected Twitch chat is saved for the first YouTube channel you visit after reloading the extension. Other YouTube channels start unlinked.

## Sign in and send messages

Twitch storage access is configured automatically when the extension loads. The browser handles approval of the required site-settings permission during installation or update. The extension allows Twitch cookies specifically while Twitch is embedded on desktop YouTube. It does not read, store, or transfer your Twitch token.

If you aren't signed in yet, open **Settings** in the chat header, choose **Sign in**, complete Twitch's normal login, then return and choose **Reload**. Use Twitch's own message box to send messages. Subscriber-only, follower-only, verification, and moderation restrictions still apply.

Use **Twitch login settings** in the extension popup to remove or restore Twitch storage access. Removing it also disables automatic connection until you explicitly restore it. Refresh YouTube after removing access. Browser policies and privacy tools may still prevent embedded login; **Pop out** opens chat in a regular Twitch tab.

Paste a Twitch stream link into the panel or popup to select and open its chat immediately. Links with or without `https://`, mobile Twitch links, and Twitch chat pop-out URLs are accepted. Twitch VOD and directory URLs do not identify a live channel and are rejected.

Choose **YouTube chat** to restore the original panel. Re-enable replacement in the extension popup. The extension leaves the video player alone and responds to YouTube's navigation without requiring a page refresh after each video.

## Privacy and permissions

The required permissions are `storage` and `contentSettings`. The extension uses site settings only to allow Twitch cookies on desktop YouTube. Removing the connection or uninstalling the extension removes its cookie exceptions. Content scripts run on desktop YouTube. Stored settings include YouTube-to-Twitch channel links, the replacement toggle, theme, and whether automatic Twitch connection is enabled. No passwords, tokens, cookies, or chat messages are collected by the extension. Twitch serves the embedded chat and handles authentication and messages.

## Development

No dependencies or compilation are required. Node.js and `zip` are needed for these commands:

```
npm test
npm run lint
npm run build
```

The ZIP contains only the loadable extension files. Twitch's embed format is documented at https://dev.twitch.tv/docs/embed/chat/.

Firefox packaging and mobile YouTube are outside this version's scope.
