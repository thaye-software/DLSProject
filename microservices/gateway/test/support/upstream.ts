import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

type Recorded = { method: string; url: string; headers: IncomingHttpHeaders; body: Buffer };

export async function startUpstream(): Promise<{ url: string; lastRequest(): Recorded | null; close(): Promise<void> }> {
  let last: Recorded | null = null;
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      last = { method: req.method ?? "", url: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) };
      res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    lastRequest: () => last,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
