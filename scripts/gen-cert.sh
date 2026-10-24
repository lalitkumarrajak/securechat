#!/bin/sh
# Self-signed certificate for testing HTTPS on your LAN (e.g. opening the app from a phone).
# Browsers only allow the encryption APIs on https:// or http://localhost.
set -e
mkdir -p certs
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 365 \
  -keyout certs/key.pem -out certs/cert.pem -subj "/CN=securechat.local" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1${IP:+,IP:$IP}"
echo "Created certs/cert.pem and certs/key.pem"
echo "Run: TLS_CERT=certs/cert.pem TLS_KEY=certs/key.pem npm start  →  https://${IP:-localhost}:3000"
