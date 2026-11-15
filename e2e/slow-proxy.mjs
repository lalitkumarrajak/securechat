// A slow network between the browser and the server, for measuring Sanga on a weak connection:
// every byte both ways waits half the round trip, and the link is shared at a fixed speed.
import net from 'node:net';

export function slowProxy({ listen, target, rttMs = 1000, kbps = 400, log = [] }) {
  const t0 = Date.now();
  let bytesPerMs = (kbps * 1000) / 8 / 1000;
  const free = { up: 0, down: 0 };
  const send = (dir, sock, chunk) => {
    const now = Date.now();
    const start = Math.max(now, free[dir]);
    free[dir] = start + chunk.length / bytesPerMs;
    const at = free[dir] + rttMs / 2;
    sock.lastAt = Math.max(sock.lastAt || 0, at);
    setTimeout(() => { if (!sock.destroyed) sock.write(chunk); }, at - now);
  };
  // A side that closes: the other side hears of it after everything sent before it has arrived.
  const closeAfter = (sock) => setTimeout(() => sock.end(), Math.max(0, (sock.lastAt || 0) - Date.now()) + rttMs / 2);
  const server = net.createServer((client) => {
    const upstream = net.connect(target);
    client.on('data', (c) => {
      const line = c.subarray(0, 200).toString('latin1').split('\r\n')[0];
      if (/^(GET|POST|PUT|DELETE|PATCH) /.test(line)) log.push({ t: Date.now() - t0, req: line.replace(/ HTTP\/1\.1$/, '') });
      send('up', upstream, c);
    });
    upstream.on('data', (c) => send('down', client, c));
    client.on('end', () => closeAfter(upstream)); upstream.on('end', () => closeAfter(client));
    client.on('error', () => upstream.destroy()); upstream.on('error', () => client.destroy());
  });
  server.listen(listen);
  // Change the speed while running (e.g. set up at full speed, then measure on a slow link).
  const setNet = (n) => { rttMs = n.rttMs; bytesPerMs = (n.kbps * 1000) / 8 / 1000; };
  return { close: () => new Promise((r) => server.close(r)), log, reset: () => { log.length = 0; }, setNet };
}
