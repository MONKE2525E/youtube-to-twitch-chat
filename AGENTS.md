# Project instructions

This is a dependency-free Chromium Manifest V3 extension using plain JavaScript. It embeds Twitch's official chat on desktop YouTube; Twitch handles login and messages. Keep the video player untouched.

## Boundaries

- `extension/content.js` and `content.css` own YouTube integration and the chat panel; `popup.*` and `connect.*` own extension settings.
- `background.js` owns cookie exceptions, validated runtime messages, and serialized channel-link writes. Keep mapping updates there to avoid overwriting another tab's changes.
- `shared.js` owns URL parsing, channel identity, defaults, and embed URLs; its pure functions are tested in `tests/shared.test.cjs`.

## Guardrails

- Store Twitch links per YouTube creator, preferring stable channel IDs and retaining handle aliases. An unlinked creator must not inherit another creator's chat. Preserve the one-time legacy selection migration.
- Keep setup expanded for unlinked creators and collapsed after saving or restoring a link. Keep secondary controls inside the dropdown.
- Handle YouTube SPA navigation, browser Back, and stale creator metadata. Preserve keyboard isolation so dropdown/input keys do not trigger player shortcuts.
- Opening Twitch's homepage does not authenticate an embedded chat. Preserve automatic cookie access, required `storage`/`contentSettings` permissions, and the explicit `autoConnect` opt-out. Scope cookie exceptions to Twitch embedded on desktop YouTube; never read account tokens or cookies.

## Checks and delivery

- Run `npm test` for parser/mapping changes and `npm run lint` for JavaScript changes. Run `npm run build` for packaging changes; it requires Node.js and `zip` and writes `dist/youtube-to-twitch-chat.zip`.
- Load `extension/` unpacked in Chromium for browser checks. For panel, navigation, or storage changes, verify two creators, return navigation, restart persistence, and automatic connection with third-party cookies blocked. Capture compact and expanded states for UI changes.
- The user's delivery is the unpacked folder `/home/monke/Downloads/youtube-to-twitch-chat`, not a ZIP. When delivering an update, synchronize extension files and verify they match the source. Keep `package.json` and `extension/manifest.json` versions aligned.
