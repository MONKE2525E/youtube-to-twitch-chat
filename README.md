# YouTube to Twitch Chat

A Manifest V3 browser extension that shows Twitch's official chat in place of YouTube's chat on desktop YouTube. It's useful when a creator streams on both platforms and their Twitch chat is the one worth reading.

Twitch handles sign-in and sending messages. The extension only embeds Twitch's chat and remembers which Twitch channel belongs to which YouTube creator. It never touches the video player.

Works in Chrome, Chromium, Edge, and Brave. Firefox and mobile YouTube are not supported.

## Features

- Replaces the YouTube chat panel with Twitch chat. On watch pages without a chat panel, it adds chat above the recommended videos.
- Links one Twitch channel per YouTube creator, keyed by YouTube channel ID with the handle kept as an alias. A creator you haven't linked never shows another creator's chat.
- Accepts a channel name or any Twitch stream link, including mobile and chat pop-out URLs. VOD and directory links are rejected because they don't identify a live channel.
- Follows YouTube's in-page navigation and browser Back without a refresh.
- Switch back to YouTube's own chat at any time, or pop Twitch chat out into its own tab.

## Install from source

There is no store listing yet, so load the extension unpacked:

1. Clone this repository: `git clone https://github.com/MONKE2525E/youtube-to-twitch-chat.git`
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select the `extension/` folder.
5. Refresh any open YouTube tab.

## Usage

1. Open a YouTube video.
2. In the chat panel's setup dropdown (or the toolbar popup), enter a Twitch channel name or paste a stream link. For a creator you haven't linked yet, the dropdown starts open. It closes once you save, and stays closed on later visits.
3. Open **Settings** in the chat header to change or remove a link.
4. To send messages, sign in through the embedded chat: choose **Sign in** in Settings, finish Twitch's normal login, return to YouTube, and choose **Reload**. Twitch's own restrictions (subscriber-only, follower-only, verification, moderation) still apply.

If you used an earlier version, your last selected Twitch chat is assigned to the first YouTube creator you visit after updating. Other creators start unlinked.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Saves your per-creator Twitch links, the replacement toggle, the theme, and the automatic-connection setting. |
| `contentSettings` | Lets Twitch's embedded chat use its own cookies while it is embedded on desktop YouTube, so you can log in and chat. Browsers often block third-party cookies, which would otherwise leave the embed signed out. |
| Content script on `youtube.com` | Draws the chat panel and reads the current channel from the page. |

The cookie exception is scoped to Twitch embedded on `youtube.com`. It is not a general cookie override. The extension never reads your Twitch token or cookies, and it never sees your password. It does not collect chat messages or send data to any server of its own. Everything stays in your browser, and Twitch serves the embedded chat.

Twitch access is set up automatically on install or update. To remove it, open **Twitch login settings** in the toolbar popup. Removing it clears the exceptions and turns automatic connection off until you restore it. Uninstalling the extension also removes them. If your browser policy or a privacy tool still blocks embedded login, use **Pop out** to chat in a regular Twitch tab.

## Development

There are no dependencies and nothing to compile. Node.js 18 or newer is needed for the checks, plus `zip` for packaging:

```sh
npm test         # unit tests for URL parsing and channel mapping
npm run lint     # syntax check of every extension script
npm run build    # writes dist/youtube-to-twitch-chat.zip
```

The ZIP contains only the loadable extension files.

### Layout

| Path | Role |
| --- | --- |
| `extension/content.js`, `content.css` | YouTube integration and the chat panel |
| `extension/popup.*`, `connect.*` | Toolbar popup and Twitch connection page |
| `extension/background.js` | Cookie exceptions, validated messages, serialized channel-link writes |
| `extension/shared.js` | URL parsing, channel identity, defaults, embed URLs |
| `tests/shared.test.cjs` | Tests for the pure functions in `shared.js` |

Twitch's embed format is documented at <https://dev.twitch.tv/docs/embed/chat/>.

## Contributing

Issues and pull requests are welcome. Please run `npm test` and `npm run lint` before submitting, and check UI changes in a Chromium browser with the extension loaded unpacked.

## License

[MIT](LICENSE) © MONKE2525E

This project is not affiliated with or endorsed by Google, YouTube, or Twitch.
