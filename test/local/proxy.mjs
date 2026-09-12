// Supabase-shaped front for the local stack: /rest/v1/* → PostgREST,
// /storage/v1/* → an in-memory stub (signed upload slots, PUTs accepted),
// /auth/v1/* → 401 (tests use the x-test-email seam instead).
import http from "node:http";
const PORT = Number(process.env.PORT ?? 3002);
const REST = "http://127.0.0.1:3001";
const uploads = new Map();
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/rest/v1/")) {
      const target = REST + url.pathname.replace("/rest/v1", "") + url.search;
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = { ...req.headers };
      delete headers.host; delete headers.connection; delete headers["content-length"];
      const r = await fetch(target, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
      res.writeHead(r.status, Object.fromEntries([...r.headers.entries()].filter(([k]) => !["content-encoding", "transfer-encoding", "connection"].includes(k))));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    if (url.pathname.startsWith("/storage/v1/object/upload/sign/")) {
      const path = url.pathname.replace("/storage/v1/object/upload/sign/", "");
      const token = Math.random().toString(36).slice(2);
      uploads.set(token, { path, bytes: 0 });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ url: `http://127.0.0.1:${PORT}/storage/v1/object/upload/sign/${path}?token=${token}`, token }));
      return;
    }
    if (url.pathname.startsWith("/storage/v1/object/") && (req.method === "PUT" || req.method === "POST")) {
      let n = 0;
      for await (const c of req) n += c.length;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ Key: url.pathname.replace("/storage/v1/object/", ""), size: n }));
      return;
    }
    if (url.pathname.startsWith("/storage/v1/object/") && req.method === "DELETE") {
      res.writeHead(200, { "content-type": "application/json" }); res.end("[]"); return;
    }
    if (url.pathname.startsWith("/auth/v1/")) {
      res.writeHead(401, { "content-type": "application/json" }); res.end(JSON.stringify({ message: "no auth locally" })); return;
    }
    res.writeHead(404); res.end("not found: " + url.pathname);
  })
  .listen(PORT, "127.0.0.1", () => console.log(`proxy on ${PORT}`));
