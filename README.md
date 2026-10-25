# Chattrix

Private, end-to-end encrypted messaging with the people you choose. Built to work well on slow, flaky connections.

- **Friends only:** search a username, send a friend request; you can chat once they accept. Block or remove friends any time.
- **Messages:** text, photos, voice messages (hold the mic), big animated emoji, replies (swipe right), reactions, edit (15 min), forward, copy, pin (up to 3 per chat), select several, delete for me or for everyone (5 min).
- **Chats:** unread divider, search inside a chat, drafts, mute (8 h / 1 week / always), archive, sent / delivered / read ticks, typing and "recording audio…".
- **Presence that's honest:** you show as online only while Chattrix is open in front of you; closing the tab switches you to "last seen" immediately.
- **Settings:** theme (system / light / dark), 6 accent colours, 5 chat wallpapers, text size, profile photo, name and about, last-seen and read-receipt privacy, push notifications, sounds, Enter to send, change password, sign out of all devices.
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
