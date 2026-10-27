# Sanga

Private, end-to-end encrypted messaging with the people you choose: chats, stories, calls, a diary and games, made of separate apps that load when you open them. Built to work well on slow, flaky connections.

- **Friends only:** search a username, send a friend request; you can chat once they accept. Block or remove friends any time Tap a friend's photo for their profile card (photo, about, Message / Play / Info).
- **Messages:** text, photos (pick up to 100 at once and review them first: swipe through, remove, add more, a caption on each; they arrive as one album grid; any format the phone takes, including HEIC/HEIF camera photos; swipe through a chat's photos full screen), voice messages (hold the mic), big animated emoji, replies (swipe right), reactions, edit (15 min), forward, copy, pin (up to 3 per chat), select several, delete for me or for everyone (5 min).
- **Chats:** the whole history on the device (older messages load as you scroll up), unread divider, search inside a chat (matches highlighted), drafts, mute (8 h / 1 week / always), archive, sent / delivered / read ticks, typing and "recording audio…".
- **Presence that's honest:** you show as online only while Sanga is open in front of you; closing the tab switches you to "last seen" immediately.
- **Account security:** Active sessions shows each device (phone model where the browser shares it) and its approximate location and network; a new sign-in alerts your other devices straight away.
- **App lock:** a 4–6 digit PIN (Settings → Privacy, per device), asked whenever Sanga opens or after you've been away; Lock now button in the header. 5 wrong PINs mean a 30 s wait, 10 sign the device out.
- **Privacy screen:** blur names, photos, previews and messages on this device (Settings → Privacy), keeping the newest 0–5 messages readable if you like. Hover or tap one to read it, or the eye button shows everything for 30 s. Optionally the whole app blurs while you're in another app or window. Notifications from the open page then say only "New message".
- **Quick exit:** turn on *Sign out when I close the tab* (Settings → Privacy, per device) and closing the tab ends your sign-in on the server and erases chats saved on that device. Reloading keeps you signed in.
- **Invite links:** share a link anywhere; people sign up from it and send you a friend request. Game links let anyone join a game.
- **Settings:** theme (system / light / dark), 6 accent colours, 5 chat wallpapers, text size, profile photo (choose the part to show: drag and zoom; tap to view it full size), name and about, last-seen and read-receipt privacy, push notifications, sounds, Enter to send, change password, sign out of all devices.
- **Groups:** up to 50 people, end-to-end encrypted (each member's app has its own group key, handed to the others pairwise and replaced when someone leaves or is removed). Everything a chat has, plus @mentions, admins (add/remove people, make admins, edit name/photo/description, only-admins-can-send), invite links, and games (Ludo, UNO) with the group. New members see messages from when they joined.
- **Diary and notes:** write about any day, for yourself or about a chat (from its menu). A calendar marks the days you wrote something; filter by chat, search, add a mood. End-to-end encrypted with a key only your own devices have, synced between them, never deleted after the message retention period.
- **Stories:** a photo with a caption or a few words on a colour, for 24 hours. Share with all friends or only the ones you pick, tag friends (they're notified and can add it to their own story). Friends like and comment (only you see the comments); you see who viewed, liked and commented. Each story is sealed with its own key, wrapped for each friend it's shared with.
- **Voice and video calls:** with any friend, from the chat header. Ringing on all their devices (the first to answer takes it), mute, camera off, front/back camera, minimise to keep chatting. Sound and video go directly between the phones (WebRTC); the setup is sealed with your conversation key, so the server can't listen in. Calls show in the chat (missed, declined, how long) with a call-back button.
- **Games:** Ludo (Ludo King Classic rules, 2–6 players, 6-arm board for 5–6) and UNO (standard 108-card deck, 2–8 players, UNO! calls and catching). Invite friends or group-mates, share a link anyone can join, or fill seats with computer players. 30-second turns (the game plays for you when time runs out; 5 missed turns and you're out), emoji, quick phrases, @mentions and chat in the game. The server deals, rolls and checks every move, and each UNO player only ever receives their own cards. Game moves and game chat aren't end-to-end encrypted, and are deleted after the game.
- **Works offline:** messages queue on the device and send when you're back. Installable as an app (PWA), with push notifications when it's closed.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm install
npm run build      # build every app (apps/*/dist) with Turborepo
npm start          # http://localhost:3000
```

While developing the UI, `npm run dev` runs the server and the shell with hot reload (open the URL Vite prints). The other apps are served from their last build; to work on one, `npm run dev -w @sanga/notes` runs it on its own with hot reload.

**On your phone, same Wi-Fi:** browsers only allow the encryption APIs on `https://` or `localhost`, so use HTTPS:

```sh
npm run cert
TLS_CERT=certs/cert.pem TLS_KEY=certs/key.pem npm start
# open https://<your-computer-ip>:3000 and accept the self-signed certificate warning
```

## Tests

```sh
npm test               # server integration tests (SQLite)
MONGODB_URI=mongodb://localhost:27017 npm test   # …or against MongoDB / Postgres (DATABASE_URL)
npm run test:unit      # client logic (edits, reactions, pins, delete rules, emoji)
npm run typecheck      # every app and package
npm run build && npm run test:e2e   # Playwright: two phones in Chrome doing everything above
```

## Deploy

**Render (free):** create a free MongoDB Atlas cluster (allow access from `0.0.0.0/0`), then in Render choose **New → Blueprint**, pick this repo and paste the Atlas connection string as `MONGODB_URI`. `render.yaml` builds with `npm ci && npm run build`.

**Your own server with Docker:** point a domain at it, then:

```sh
DOMAIN=chat.example.com docker compose up -d --build
```

Caddy gets a free HTTPS certificate automatically.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `MONGODB_URI` | – | Store data in MongoDB (e.g. Atlas) |
| `DATABASE_URL` | – | Store data in Postgres |
| `DATA_DIR` | `./data` | Where the SQLite database lives when neither of the above is set |
| `ALLOW_SIGNUP` | open | Set to `0` to close sign-up |
| `RETENTION_DAYS` | `30` | Encrypted messages are deleted from the server after this (they stay on devices) |
| `GAME_LOBBY_MS` | `600000` | How long a game waits for players before it's called off |
| `GEOIP_URL` | `https://ipwho.is/{ip}` | Looks up the approximate location of sign-ins for Active sessions; set empty to turn off |
| `KLIPY_API_KEY` | – | Turns on GIF and sticker search ([KLIPY](https://docs.klipy.com)) |
| `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` | – | A TURN relay for calls ([Cloudflare Realtime TURN](https://developers.cloudflare.com/realtime/turn/), free tier). Without one, most calls connect directly, but some mobile networks block that |
| `TURN_URLS` + `TURN_USERNAME`, `TURN_CREDENTIAL` | – | Or any other TURN service (comma-separated `turn:` URLs) |
| `TURN_URLS` + `TURN_SECRET` | – | Or your own coturn with `use-auth-secret` (short-lived credentials per user) |

## Adding a game

Games plug into a shared platform: invites and share links, lobby, turns and the turn timer, saving and restoring, in-game chat, and results all come for free.

1. **Rules:** `packages/game-rules/<game>.js` exports a definition (`type`, `name`, `min`, `max`, `turnMs`, `begin`, `act`, `auto`, `pass`, `removed`); see `packages/game-rules/core.js` for the contract and `ludo.js` for an example. The server runs it; the app imports it too (`@sanga/game-rules/<game>.js`).
2. **Register:** add it to `packages/game-rules/index.js`.
3. **Board:** a React component in `apps/shell/src/features/games/<game>/`, listed in `apps/shell/src/features/games/registry.ts`. It gets the game state, an `act()` function and chat bubbles.
| `TRUST_PROXY` | – | Set to `1` behind a reverse proxy so rate limits see real client IPs |
| `TLS_CERT`, `TLS_KEY` | – | Serve HTTPS directly |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | generated | Web Push keys; generated once and stored in the database if not set |
| `PUBLIC_URL` | Render's URL | Contact URL sent to push services |

## How the security works

| Threat | Protection |
|---|---|
| The server (or anyone who hacks it) reading messages | Messages, photos, voice notes, replies, reactions, edits and pins are encrypted in the browser with AES-256-GCM. The server only stores ciphertext. |
| The server learning your password | The browser derives two keys from your password (PBKDF2, 600,000 rounds). Only the *auth key* is sent, and the server hashes it again with scrypt. The other key never leaves your device. |
| Signing in on a new device | Your private key is stored on the server encrypted with the key that never leaves your device. Changing your password re-encrypts it, so old chats stay readable. |
| Strangers messaging you | The server only relays messages, typing and presence between accepted friends where nobody has blocked the other. |
| The server swapping a contact's key | Contacts' keys are pinned on first use. If one changes, sending pauses until you compare security codes. |
| Tampered or replayed messages | Each message is authenticated together with its sender, recipient and message id. Edits and reactions only apply from the right person, to messages in the same chat. |
| Password guessing | Login is rate limited per IP and per username. |
| XSS / clickjacking | Strict Content-Security-Policy (scripts only from this site), messages always rendered as text, frames denied. |
| Push notifications leaking content | Notifications contain only the sender's name, never the message. |

**Not end-to-end encrypted:** profile photos, names and "about", friend lists, and who talks to whom and when (like WhatsApp). **Limits compared with WhatsApp:** one long-term key pair per user instead of the Signal protocol's per-message keys, so a stolen device key (or a guessed password plus a copy of the server database) would expose that user's past messages. Use a strong password. No group chats or calls yet.

## Apps (micro-frontends)

Sanga is a **shell** plus separate apps, each built and deployed on its own with Vite and
[Module Federation](https://module-federation.io):

- **The shell** (`apps/shell`) loads first: sign-in, chats and stories, calls, games, settings,
  notifications. It knows the other apps only from `/apps.json`, which the server builds from every
  `apps/<name>/dist/app.json`.
- **An app** (today: the diary, `apps/notes`) is downloaded **only when it's opened**: the first
  time, the shell fetches `/apps.json` and that app's `remoteEntry.js` and code, nothing else. It is
  also a page of its own (`/apps/notes/`), using the sign-in the device already has.
- **Apps never import the shell or each other.** Everything outside them comes from the SDK
  (`@sanga/sdk`): who's signed in and their keys, server requests, live updates, on-device storage,
  friends and groups, photos, confirmations. The shell provides it; a standalone page uses
  `@sanga/sdk/standalone`.
- **Shared once:** React and the SDK (`vite.shared.ts`). Everything else, including the UI kit
  (`@sanga/ui`), each app bundles itself.
- **Same address for all:** apps are served from `/apps/<name>/` on the same domain, so the
  sign-in, encryption keys and saved data on the device are shared, and one deploy ships them all
  (Turborepo rebuilds only what changed).
- **Failures stay contained:** an app that can't download (offline) or crashes shows "Couldn't
  open … Try again" in its place; the rest keeps working.

### Adding an app

1. Copy `apps/notes`: rename it in `package.json`, `vite.config.ts` (`name`, `base: '/apps/<name>/'`)
   and `public/app.json` (`id`, `name`, `icon`).
2. Its `src/App.tsx` default-exports a component taking `{ onClose, params }` (`AppProps`) and uses
   `sdk()` for everything outside the app.
3. In the shell, open it with `<AppFrame id="<name>" name="…" onClose={…} />` (see
   `features/notes/NotesPanel.tsx`).
4. Its server part goes in `server/<name>.js` (routes, plus live messages through `sendTo`).

## Project layout

```
apps/
  shell/             the main app (React + TypeScript + Tailwind, Vite): chats, stories, calls, games, settings
    src/lib/         local database, sync engine, message rules, sdk.ts (the shell's side of the SDK), apps.ts (loads apps)
    public/sw.js     offline cache and push notifications
  notes/             the diary, a separate app (loaded when opened, or on its own at /apps/notes/)
packages/
  sdk/               the contract between the shell and the apps
  ui/                theme, buttons, dialogs, menus, formatting helpers
  crypto/            end-to-end encryption (WebCrypto), also used by the server tests
  game-rules/        Ludo, UNO, …: rules the server runs and the boards draw
server/              Node HTTP + WebSocket server
  index.js           startup, routing, sockets
  http.js            serves the shell at / and each app at /apps/<name>/
  auth.js            accounts, sessions, password change
  friends.js         friend requests, blocking (enforced for every message)
  messages.js        relay, receipts, delete for me / everyone
  stories.js, calls.js, notes.js, games.js, groups.js
  hub.js             connected sockets and activity-based presence
  db.js              storage: MongoDB, Postgres or SQLite behind one interface
vite.shared.ts       build settings every app uses (what's shared, compression)
turbo.json           builds and tests only what changed
test/                server tests (node:test)
e2e/                 Playwright end-to-end tests
```
