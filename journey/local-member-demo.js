/* Local-only Journey member demo.
   Run: node journey/local-member-demo.js
   Serves this repo on 127.0.0.1 and a test-mode member API on 127.0.0.1.
   It does not read identity-provider secrets, send email, or accept connections
   from anywhere but this machine. Do not put it behind a proxy. */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const API = require("./member-api.js");

const ROOT = path.resolve(__dirname, "..");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon"
};

function resolveFile(urlPath) {
  let reqPath = "/";
  try { reqPath = decodeURIComponent(urlPath.split("?")[0]); } catch (e) { return null; }
  if (reqPath.endsWith("/")) reqPath += "index.html";
  const rel = reqPath.replace(/^\/+/, "");
  if (!rel || rel.split("/").some(function (part) { return part === "" || part === "." || part === ".." || part === ".git"; })) {
    return null;
  }
  const full = path.resolve(ROOT, rel);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  return full;
}

async function main() {
  const testSecret = crypto.randomBytes(24).toString("base64url");
  let apiUrl = "";
  const site = http.createServer(function (req, res) {
    if (!API.loopbackAddress(req.socket.remoteAddress)) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("Local demo only.");
      return;
    }
    const file = resolveFile(req.url || "/");
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found.");
      return;
    }
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    if (rel === "journey/auth-config.js") {
      const body = "window.ONENESS_JOURNEY_AUTH = " + JSON.stringify({
        enabled: true,
        apiBase: apiUrl,
        localDemo: true,
        testSecret: testSecret
      }) + ";\n";
      res.writeHead(200, {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store"
      });
      res.end(body);
      return;
    }
    fs.stat(file, function (err, stat) {
      if (err || !stat.isFile()) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found.");
        return;
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store"
      });
      fs.createReadStream(file).pipe(res);
    });
  });

  await new Promise(function (resolve) { site.listen(0, "127.0.0.1", resolve); });
  const sitePort = site.address().port;
  const origin = "http://127.0.0.1:" + sitePort;
  const api = await API.listen({
    authMode: "test",
    host: "127.0.0.1",
    port: 0,
    testSecret: testSecret,
    cookieSecure: false,
    allowedOrigin: origin,
    sessionTtlSeconds: 3600
  });
  apiUrl = api.url;
  console.log("LOCAL TEST ONLY. Not the live site. No email is sent.");
  console.log("Journey: " + origin + "/journey/");
  console.log("Use Local test member A and Local test member B. Stop with Ctrl-C.");

  function shutdown() {
    api.close().then(function () { site.close(); process.exit(0); });
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  main().catch(function (err) {
    console.error(err.publicMessage || err.message || "Local demo did not start.");
    process.exit(1);
  });
}
