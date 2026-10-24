# SecureChat

A WhatsApp-style messenger with end-to-end encryption, built to work well on slow, flaky connections.

- Sign up / sign in with a username and password
- 1:1 chats with text and photos
- Sent ✓, delivered ✓✓ and read (blue ✓✓) ticks, typing indicator, online / last seen
- Security code check (60 digits, like WhatsApp's "Verify security code") with a warning if a contact's key changes
- Works offline: messages queue on the device and send when you're back online
- Installable as an app on phones and desktops (PWA)
- Light and dark mode, mobile and desktop layouts

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm install
npm start          # http://localhost:3000
npm test           # end-to-end test against a temporary server
```

Open two browser windows (one normal, one private/incognito), create two accounts, search one from the other, and chat.

**On your phone, same Wi-Fi:** the browser only allows the encryption APIs on `https://` or `localhost`, so use HTTPS:

```sh
npm run cert
TLS_CERT=certs/cert.pem TLS_KEY=certs/key.pem npm start
# open https://<your-computer-ip>:3000 and accept the self-signed certificate warning
```

## Deploy

You need a server with Docker and a domain name pointing at it.

```sh
DOMAIN=chat.example.com docker compose up -d --build
```

Caddy gets a free HTTPS certificate automatically. Messages and accounts are stored in the `chatdata` Docker volume.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | Where the SQLite database lives |
| `RETENTION_DAYS` | `30` | Encrypted messages are deleted from the server after this |
| `TLS_CERT`, `TLS_KEY` | – | Serve HTTPS directly (not needed behind Caddy) |
| `TRUST_PROXY` | – | Set to `1` behind a reverse proxy so rate limits see real client IPs |

## How the security works

| Threat | Protection |
|---|---|
| Server (or anyone who hacks it) reading messages | Messages are encrypted in the browser with AES-256-GCM. The server only stores ciphertext. |
| Server learning your password | The browser derives two keys from your password (PBKDF2, 600,000 rounds). Only the *auth key* is sent, and the server hashes it again with scrypt. The other key never leaves your device. |
| Signing in on a new device | Your private key is stored on the server encrypted with the key that never leaves your device, so only your password can unlock it. |
| Server swapping a contact's key (man-in-the-middle) | Contacts' keys are pinned on first use. If one changes, sending is paused until you compare security codes. |
| Tampered or replayed messages | Each message is authenticated together with its sender, recipient and message ID. Retransmits are de-duplicated. |
| Password guessing | Login is rate limited per IP and per username. |
| XSS / clickjacking | Strict Content-Security-Policy (no inline scripts), messages are always rendered as plain text, frames denied. |
| Network snooping | Use HTTPS in production (the Docker setup does this automatically). |

**Limits, compared with WhatsApp.** WhatsApp uses the Signal protocol, which changes keys for every message ("forward secrecy"): if a device key is stolen later, old messages still can't be decrypted. This app uses one long-term key pair per user, so a stolen key (or a guessed password plus a copy of the server database) would expose that user's past messages. Use a strong password. Adding the Signal protocol (for example via `libsignal`) is the next step if you need that level of protection. There are also no group chats, voice/video calls or push notifications when the app is closed yet.

## Why it's fast on slow networks

- No frameworks: the whole app is about 15 KB compressed, cached by a service worker, so it opens instantly on repeat visits, even offline.
- Static files are pre-compressed with Brotli/gzip. WebSocket frames over 512 bytes are compressed.
- Messages use short JSON keys. Sync after reconnecting fetches only what changed, using a single sequence number, in small batches.
- Photos are resized to 1280 px and re-encoded as WebP on the phone before sending, so a 4 MB camera photo is usually 100–250 KB.
- Heartbeats detect dead mobile connections within about 35 seconds. Reconnects back off with jitter.
- Receipts are batched into one frame. Chats and messages are kept in IndexedDB so the UI never waits on the network.

## Project layout

```
server.js            HTTP + WebSocket relay, SQLite storage, auth, rate limiting
public/crypto.js     All encryption (WebCrypto)
public/store.js      IndexedDB storage on the device
public/app.js        UI, sync, offline outbox
public/sw.js         Service worker (offline app shell)
scripts/smoke-test.js  End-to-end test
```
