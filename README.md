# Chattrix

Private, end-to-end encrypted messaging with the people you choose. Built to work well on slow, flaky connections.

- **Friends only:** search a username, send a friend request; you can chat once they accept. Block or remove friends any time.
- **Messages:** text, photos, voice messages (hold the mic), big animated emoji, replies (swipe right), reactions, edit (15 min), forward, copy, pin (up to 3 per chat), select several, delete for me or for everyone (5 min).
- **Chats:** unread divider, search inside a chat, drafts, mute (8 h / 1 week / always), archive, sent / delivered / read ticks, typing and "recording audio…".
- **Presence that's honest:** you show as online only while Chattrix is open in front of you; closing the tab switches you to "last seen" immediately.
- **Account security:** Active sessions shows each device (phone model where the browser shares it) and its approximate location and network; a new sign-in alerts your other devices straight away.
- **App lock:** a 4–6 digit PIN (Settings → Privacy, per device), asked whenever Chattrix opens or after you've been away; Lock now button in the header. 5 wrong PINs mean a 30 s wait, 10 sign the device out.
- **Quick exit:** turn on *Sign out when I close the tab* (Settings → Privacy, per device) and closing the tab ends your sign-in on the server and erases chats saved on that device. Reloading keeps you signed in.
- **Invite links:** share a link anywhere; people sign up from it and send you a friend request. Game links let anyone join a game.
- **Settings:** theme (system / light / dark), 6 accent colours, 5 chat wallpapers, text size, profile photo, name and about, last-seen and read-receipt privacy, push notifications, sounds, Enter to send, change password, sign out of all devices.
- **Groups:** up to 50 people, end-to-end encrypted (each member's app has its own group key, handed to the others pairwise and replaced when someone leaves or is removed). Everything a chat has, plus @mentions, admins (add/remove people, make admins, edit name/photo/description, only-admins-can-send), invite links, and Ludo with the group. New members see messages from when they joined.
- **Games:** Ludo with Ludo King's Classic rules for 2 to 6 players (a 6-arm board for 5–6), with a 30-second turn timer (the game plays for you when time runs out; 5 missed turns in a row and you're out), emoji, quick phrases and chat during the game. Invite friends, or share a link so anyone with an account can join. The server rolls the dice and checks every move, so nobody can cheat. Game moves and game chat aren't end-to-end encrypted, and are deleted after the game.
- **Works offline:** messages queue on the device and send when you're back. Installable as an app (PWA), with push notifications when it's closed.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm install
npm run build      # build the web app into web/dist
npm start          # http://localhost:3000
```

While developing the UI, `npm run dev` runs the server and Vite with hot reload (open the URL Vite prints).

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

## Adding a game

Games plug into a shared platform: invites and share links, lobby, turns and the turn timer, saving and restoring, in-game chat, and results all come for free.

1. **Rules:** `shared/games/<game>.js` exports a definition (`type`, `name`, `min`, `max`, `turnMs`, `begin`, `act`, `auto`, `pass`, `removed`); see `shared/games/core.js` for the contract and `ludo.js` for an example. The server runs it; the app imports it too.
2. **Register:** add it to `shared/games/index.js`.
3. **Board:** a React component in `web/src/features/games/<game>/`, listed in `web/src/features/games/registry.ts`. It gets the game state, an `act()` function and chat bubbles.
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

## Project layout

```
server/              Node HTTP + WebSocket server
  index.js           startup, routing, sockets
  auth.js            accounts, sessions, password change
  friends.js         friend requests, blocking (enforced for every message)
  messages.js        relay, receipts, delete for me / everyone
  hub.js             connected sockets and activity-based presence
  profiles.js        name, about, privacy, mutes, profile photos
  push.js            Web Push
  db.js              storage: MongoDB, Postgres or SQLite behind one interface
web/                 React + TypeScript + Tailwind app (Vite)
  src/lib/           crypto, local database, sync engine, message rules
  src/features/      landing, chat list, friends, conversation, settings
  public/sw.js       offline cache and push notifications
test/                server tests (node:test)
e2e/                 Playwright end-to-end tests
```
