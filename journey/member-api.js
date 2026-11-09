/* Oneness Journey member API.
   Server-side sessions and progress partitioned by member, cohort, and lane.
   The browser does not choose the member id. Test sign-in exists only for a
   loopback process with JOURNEY_AUTH_MODE=test. Production sign-in is OpenID
   Connect authorization code + PKCE, and only when that mode is configured.
   This file is not loaded by the public page. */
"use strict";

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const P = require("./progress.js");

const COOKIE = "oneness_journey_session";
const OAUTH_COOKIE = "oneness_journey_oauth";
const MAX_BODY = 32000;
const SESSION_TTL_DEFAULT = 12 * 60 * 60;
const OAUTH_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

const TEST_ACCOUNTS = {
  "member-a": { sub: "test-member-a", email: "member-a@journey.test" },
  "member-b": { sub: "test-member-b", email: "member-b@journey.test" }
};

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  err.publicMessage = message;
  return err;
}

function loopbackHost(host) {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

function loopbackAddress(addr) {
  if (!addr) return false;
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function localOrigin(origin) {
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch (e) {
    return false;
  }
}

function httpsOrLocal(value) {
  let url;
  try { url = new URL(value); } catch (e) { return false; }
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) return true;
  return false;
}

function secretOk(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hashSession(id) {
  return crypto.createHash("sha256").update(String(id)).digest("hex");
}

function validSub(sub) {
  return typeof sub === "string" && sub.length >= 1 && sub.length <= 128 && !/[\u0000-\u001f\u007f]/.test(sub);
}

function envFromProcess(procEnv) {
  const env = procEnv || process.env;
  const mode = env.JOURNEY_AUTH_MODE || "disabled";
  return normalizeEnv({
    authMode: mode,
    host: env.JOURNEY_HOST || "127.0.0.1",
    port: env.JOURNEY_PORT ? Number(env.JOURNEY_PORT) : 8787,
    testSecret: env.JOURNEY_TEST_SECRET || "",
    cookieSecure: env.JOURNEY_COOKIE_SECURE === "0" ? false : true,
    sameSite: env.JOURNEY_COOKIE_SAMESITE || "Lax",
    allowedOrigin: env.JOURNEY_ALLOWED_ORIGIN || "",
    successUrl: env.JOURNEY_SUCCESS_URL || "",
    dataFile: env.JOURNEY_DATA_FILE || "",
    sessionTtlSeconds: env.JOURNEY_SESSION_TTL_SECONDS ? Number(env.JOURNEY_SESSION_TTL_SECONDS) : SESSION_TTL_DEFAULT,
    oidc: {
      issuer: (env.JOURNEY_OIDC_ISSUER || "").replace(/\/+$/, ""),
      clientId: env.JOURNEY_OIDC_CLIENT_ID || "",
      clientSecret: env.JOURNEY_OIDC_CLIENT_SECRET || "",
      redirectUri: env.JOURNEY_OIDC_REDIRECT_URI || ""
    }
  });
}

function normalizeEnv(input) {
  input = input || {};
  const authMode = input.authMode || "disabled";
  if (authMode !== "disabled" && authMode !== "test" && authMode !== "oidc") {
    throw fail(500, "JOURNEY_AUTH_MODE must be disabled, test, or oidc.");
  }
  const sameSite = input.sameSite === "None" ? "None" : "Lax";
  const env = {
    authMode: authMode,
    host: input.host || "127.0.0.1",
    port: Number.isInteger(input.port) ? input.port : (Number(input.port) || 0),
    testSecret: input.testSecret || "",
    cookieSecure: input.cookieSecure !== false && input.cookieSecure !== "0",
    sameSite: sameSite,
    allowedOrigin: input.allowedOrigin || "",
    successUrl: input.successUrl || "",
    dataFile: input.dataFile || "",
    sessionTtlSeconds: Number(input.sessionTtlSeconds) > 0 ? Number(input.sessionTtlSeconds) : SESSION_TTL_DEFAULT,
    authRateLimit: Number.isInteger(input.authRateLimit) ? input.authRateLimit : 30,
    oidc: {
      issuer: input.oidc && input.oidc.issuer ? String(input.oidc.issuer).replace(/\/+$/, "") : "",
      clientId: input.oidc && input.oidc.clientId ? String(input.oidc.clientId) : "",
      clientSecret: input.oidc && input.oidc.clientSecret ? String(input.oidc.clientSecret) : "",
      redirectUri: input.oidc && input.oidc.redirectUri ? String(input.oidc.redirectUri) : ""
    },
    now: typeof input.now === "function" ? input.now : function () { return Date.now(); },
    fetch: input.fetch || global.fetch,
    jwks: input.jwks || null
  };
  validateEnv(env);
  return env;
}

function validateEnv(env) {
  if (env.sameSite === "None" && !env.cookieSecure) {
    throw fail(500, "SameSite=None requires JOURNEY_COOKIE_SECURE=1.");
  }
  if (env.authMode === "test") {
    if (!loopbackHost(env.host)) throw fail(500, "Test auth mode only binds to loopback.");
    if (!env.testSecret || env.testSecret.length < 16) {
      throw fail(500, "JOURNEY_TEST_SECRET must be at least 16 characters in test mode.");
    }
  }
  if (env.authMode === "oidc") {
    const names = {
      issuer: "JOURNEY_OIDC_ISSUER",
      clientId: "JOURNEY_OIDC_CLIENT_ID",
      clientSecret: "JOURNEY_OIDC_CLIENT_SECRET",
      redirectUri: "JOURNEY_OIDC_REDIRECT_URI"
    };
    Object.keys(names).forEach(function (key) {
      if (!env.oidc[key]) throw fail(500, "Missing " + names[key] + ".");
    });
    if (!httpsOrLocal(env.oidc.issuer) || !httpsOrLocal(env.oidc.redirectUri)) {
      throw fail(500, "OIDC issuer and redirect URI must be https, or http on localhost.");
    }
    if (!env.allowedOrigin || !env.successUrl) {
      throw fail(500, "OIDC mode requires JOURNEY_ALLOWED_ORIGIN and JOURNEY_SUCCESS_URL.");
    }
    if (!httpsOrLocal(env.allowedOrigin) || !httpsOrLocal(env.successUrl)) {
      throw fail(500, "Allowed origin and success URL must be https, or http on localhost.");
    }
    if (new URL(env.successUrl).origin !== new URL(env.allowedOrigin).origin) {
      throw fail(500, "JOURNEY_SUCCESS_URL must be on JOURNEY_ALLOWED_ORIGIN.");
    }
    if (!env.cookieSecure && !localOrigin(env.allowedOrigin)) {
      throw fail(500, "OIDC mode requires JOURNEY_COOKIE_SECURE=1.");
    }
  }
}

function partitionKey(owner, cohort, lane) {
  return JSON.stringify([owner, cohort, lane]);
}

function createState(env) {
  const state = {
    sessions: new Map(),
    progress: new Map(),
    oauth: new Map(),
    buckets: new Map(),
    discovery: null,
    jwks: env.jwks || null
  };
  if (env.dataFile) loadFile(env.dataFile, state);
  return state;
}

function loadFile(file, state) {
  if (!fs.existsSync(file)) return;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw fail(500, "JOURNEY_DATA_FILE is not a valid member store. Refusing to start.");
  }
  if (!data || data.v !== 1 || !Array.isArray(data.sessions) || !Array.isArray(data.progress)) {
    throw fail(500, "JOURNEY_DATA_FILE is not a valid member store. Refusing to start.");
  }
  data.sessions.forEach(function (row) {
    if (!row || !row.hash || !validSub(row.sub)) return;
    state.sessions.set(row.hash, {
      sub: row.sub,
      email: typeof row.email === "string" ? row.email.slice(0, 254) : "",
      tag: typeof row.tag === "string" ? row.tag : "",
      exp: Number(row.exp) || 0
    });
  });
  data.progress.forEach(function (row) {
    if (!row || !validSub(row.owner)) return;
    const record = storedRecord(row.record, row.lane, row.cohort, Number(row.revision) || 0, row.updatedAt || null);
    state.progress.set(partitionKey(row.owner, record.cohortStart, record.lane), {
      owner: row.owner,
      revision: record.serverRevision,
      record: record,
      updatedAt: record.updatedAt
    });
  });
}

function persist(env, state) {
  if (!env.dataFile) return;
  const dir = path.dirname(env.dataFile);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const payload = {
    v: 1,
    sessions: Array.from(state.sessions.entries()).map(function (entry) {
      return {
        hash: entry[0],
        sub: entry[1].sub,
        email: entry[1].email,
        tag: entry[1].tag,
        exp: entry[1].exp
      };
    }),
    progress: Array.from(state.progress.values()).map(function (row) {
      return {
        owner: row.owner,
        cohort: row.record.cohortStart,
        lane: row.record.lane,
        revision: row.revision,
        updatedAt: row.updatedAt,
        record: row.record
      };
    })
  };
  const tmp = env.dataFile + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 });
  fs.renameSync(tmp, env.dataFile);
  fs.chmodSync(env.dataFile, 0o600);
}

function storedRecord(raw, lane, cohort, revision, nowIso) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const clean = Object.create(null);
  Object.keys(source).forEach(function (key) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") return;
    if (key === "memberId" || key === "owner" || key === "sub" || key === "email") return;
    clean[key] = source[key];
  });
  const parsed = P.parseRecord(clean, lane, cohort);
  return {
    v: 1,
    lane: parsed.lane,
    cohortStart: parsed.cohortStart,
    updatedAt: typeof nowIso === "string" ? nowIso : null,
    sittingOpened: parsed.sittingOpened === true,
    journeyFeedback: parsed.journeyFeedback,
    days: parsed.days,
    serverRevision: revision
  };
}

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (typeof raw !== "string" || !raw) return "";
  const parts = raw.split(/; */);
  for (let i = 0; i < parts.length; i += 1) {
    const eq = parts[i].indexOf("=");
    if (eq === -1) continue;
    if (parts[i].slice(0, eq) === name) {
      try { return decodeURIComponent(parts[i].slice(eq + 1)); } catch (e) { return ""; }
    }
  }
  return "";
}

function cookieValue(id, env, maxAge) {
  const parts = [
    COOKIE + "=" + encodeURIComponent(id || ""),
    "HttpOnly",
    "Path=/",
    "SameSite=" + env.sameSite,
    "Max-Age=" + String(maxAge)
  ];
  if (env.cookieSecure) parts.push("Secure");
  if (env.sameSite === "None") parts.push("Partitioned");
  return parts.join("; ");
}

function oauthCookie(id, env) {
  const parts = [
    OAUTH_COOKIE + "=" + encodeURIComponent(id || ""),
    "HttpOnly",
    "Path=/",
    "SameSite=" + env.sameSite,
    "Max-Age=" + (id ? "600" : "0")
  ];
  if (env.cookieSecure) parts.push("Secure");
  if (env.sameSite === "None") parts.push("Partitioned");
  return parts.join("; ");
}

function getSession(req, env, state) {
  const id = readCookie(req, COOKIE);
  if (!id || id.length < 20) return null;
  const row = state.sessions.get(hashSession(id));
  if (!row || !row.tag || row.exp <= env.now()) {
    if (row) state.sessions.delete(hashSession(id));
    return null;
  }
  return row;
}

function createSession(env, state, member) {
  const id = crypto.randomBytes(32).toString("base64url");
  const tag = crypto.randomBytes(16).toString("base64url");
  state.sessions.set(hashSession(id), {
    sub: member.sub,
    email: member.email ? String(member.email).slice(0, 254) : "",
    tag: tag,
    exp: env.now() + env.sessionTtlSeconds * 1000
  });
  persist(env, state);
  return id;
}

function deleteSession(req, env, state) {
  const id = readCookie(req, COOKIE);
  if (id) state.sessions.delete(hashSession(id));
  persist(env, state);
}

function claimsIdentity(obj) {
  if (!obj || typeof obj !== "object") return false;
  return ["memberId", "owner", "sub", "email"].some(function (key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  });
}

function validCohort(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function validLane(value) {
  return value === "buyer" || value === "advocate";
}

function rateAllow(state, env, key) {
  const now = env.now();
  const windowMs = 10 * 60 * 1000;
  const prev = state.buckets.get(key) || [];
  const fresh = prev.filter(function (stamp) { return now - stamp < windowMs; });
  if (fresh.length >= env.authRateLimit) {
    state.buckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  state.buckets.set(key, fresh);
  return true;
}

function testLoginAllowed(req, env) {
  if (!env || env.authMode !== "test") return false;
  if (!loopbackAddress(req.socket && req.socket.remoteAddress)) return false;
  const header = req.headers["x-journey-test-secret"];
  if (typeof header !== "string") return false;
  return secretOk(header, env.testSecret);
}

function csrfOk(req, env) {
  if (req.headers["x-journey-request"] !== "1") return false;
  if (!env.allowedOrigin) return env.authMode === "test";
  return req.headers.origin === env.allowedOrigin;
}

function baseHeaders(req, env) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "x-robots-tag": "noindex"
  };
  const origin = req.headers.origin;
  if (env.allowedOrigin && origin === env.allowedOrigin) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-credentials"] = "true";
    headers.vary = "Origin";
    headers["access-control-allow-headers"] = "content-type, x-journey-request, accept, x-journey-test-secret";
    headers["access-control-allow-methods"] = "GET, PUT, POST, OPTIONS";
  }
  return headers;
}

function sendJson(req, res, env, status, body, extra) {
  const headers = baseHeaders(req, env);
  if (extra) Object.keys(extra).forEach(function (key) { headers[key] = extra[key]; });
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function sendEmpty(req, res, env, status, extra) {
  const headers = baseHeaders(req, env);
  headers["content-type"] = "text/plain; charset=utf-8";
  if (extra) Object.keys(extra).forEach(function (key) { headers[key] = extra[key]; });
  res.writeHead(status, headers);
  res.end("");
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(fail(413, "Request is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () { resolve(Buffer.concat(chunks)); });
    req.on("error", function () { reject(fail(400, "Could not read the request.")); });
  });
}

async function readJson(req) {
  const type = String(req.headers["content-type"] || "");
  if (!/^application\/json\b/i.test(type)) throw fail(415, "Use application/json.");
  const buf = await readBody(req);
  if (!buf.length) return {};
  try {
    const parsed = JSON.parse(buf.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw fail(400, "JSON object required.");
    return parsed;
  } catch (err) {
    if (err.publicMessage) throw err;
    throw fail(400, "JSON object required.");
  }
}

function progressView(row) {
  if (!row) return { revision: 0, record: null };
  return { revision: row.revision, record: row.record };
}

function emptyView(lane, cohort) {
  return { revision: 0, record: storedRecord(null, lane, cohort, 0, null) };
}

function getProgress(state, owner, cohort, lane) {
  return state.progress.get(partitionKey(owner, cohort, lane)) || null;
}

function putProgress(env, state, owner, cohort, lane, raw, ifRevision) {
  if (typeof ifRevision !== "number" || ifRevision < 0 || ifRevision !== Math.floor(ifRevision)) {
    throw fail(400, "ifRevision must be a whole number.");
  }
  const current = getProgress(state, owner, cohort, lane);
  const rev = current ? current.revision : 0;
  if (ifRevision !== rev) {
    const err = fail(409, "Revision conflict.");
    err.conflict = current ? progressView(current) : emptyView(lane, cohort);
    throw err;
  }
  const nextRev = rev + 1;
  const record = storedRecord(raw, lane, cohort, nextRev, new Date(env.now()).toISOString());
  const row = { owner: owner, revision: nextRev, record: record, updatedAt: record.updatedAt };
  state.progress.set(partitionKey(owner, cohort, lane), row);
  persist(env, state);
  return progressView(row);
}

function endpointOnIssuer(endpoint, issuer) {
  let actual;
  let expected;
  try {
    actual = new URL(endpoint);
    expected = new URL(issuer);
  } catch (e) {
    return false;
  }
  if (actual.origin !== expected.origin) return false;
  return httpsOrLocal(actual.href);
}

async function discover(env, state) {
  if (state.discovery) return state.discovery;
  const url = env.oidc.issuer + "/.well-known/openid-configuration";
  let res;
  try {
    res = await env.fetch(url, { headers: { accept: "application/json" } });
  } catch (e) {
    throw fail(502, "Sign-in is unavailable.");
  }
  if (!res || !res.ok) throw fail(502, "Sign-in is unavailable.");
  let doc;
  try { doc = await res.json(); } catch (e) { throw fail(502, "Sign-in is unavailable."); }
  if (!doc || doc.issuer !== env.oidc.issuer) throw fail(502, "Sign-in is unavailable.");
  if (!endpointOnIssuer(doc.authorization_endpoint, env.oidc.issuer)) throw fail(502, "Sign-in is unavailable.");
  if (!endpointOnIssuer(doc.token_endpoint, env.oidc.issuer)) throw fail(502, "Sign-in is unavailable.");
  if (!endpointOnIssuer(doc.jwks_uri, env.oidc.issuer)) throw fail(502, "Sign-in is unavailable.");
  state.discovery = {
    authorization_endpoint: doc.authorization_endpoint,
    token_endpoint: doc.token_endpoint,
    jwks_uri: doc.jwks_uri
  };
  return state.discovery;
}

async function loadJwks(env, state, force) {
  if (state.jwks && !force) return state.jwks;
  if (env.jwks && !force) {
    state.jwks = env.jwks;
    return state.jwks;
  }
  const doc = await discover(env, state);
  let res;
  try {
    res = await env.fetch(doc.jwks_uri, { headers: { accept: "application/json" } });
  } catch (e) {
    throw fail(502, "Sign-in is unavailable.");
  }
  if (!res || !res.ok) throw fail(502, "Sign-in is unavailable.");
  let jwks;
  try { jwks = await res.json(); } catch (e) { throw fail(502, "Sign-in is unavailable."); }
  if (!jwks || !Array.isArray(jwks.keys)) throw fail(502, "Sign-in is unavailable.");
  state.jwks = jwks;
  return jwks;
}

function verifyIdToken(token, options) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts.some(function (part) { return !part; })) throw fail(401, "Sign-in did not complete.");
  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch (e) {
    throw fail(401, "Sign-in did not complete.");
  }
  if (!header || header.alg !== "RS256" || typeof header.kid !== "string") throw fail(401, "Sign-in did not complete.");
  const jwk = (options.jwks.keys || []).find(function (key) { return key && key.kid === header.kid; });
  if (!jwk) {
    const err = fail(401, "Sign-in did not complete.");
    err.unknownKid = true;
    throw err;
  }
  let key;
  try { key = crypto.createPublicKey({ key: jwk, format: "jwk" }); } catch (e) { throw fail(401, "Sign-in did not complete."); }
  const data = Buffer.from(parts[0] + "." + parts[1]);
  const sig = Buffer.from(parts[2], "base64url");
  if (!crypto.verify("sha256", data, key, sig)) throw fail(401, "Sign-in did not complete.");
  const now = options.now();
  if (!claims || claims.iss !== options.issuer) throw fail(401, "Sign-in did not complete.");
  const audOk = claims.aud === options.audience || (Array.isArray(claims.aud) && claims.aud.indexOf(options.audience) !== -1);
  if (!audOk) throw fail(401, "Sign-in did not complete.");
  if (typeof claims.exp !== "number" || now > claims.exp * 1000 + CLOCK_SKEW_MS) throw fail(401, "Sign-in did not complete.");
  if (typeof claims.nbf === "number" && now + CLOCK_SKEW_MS < claims.nbf * 1000) throw fail(401, "Sign-in did not complete.");
  if (typeof claims.nonce !== "string" || claims.nonce !== options.nonce) throw fail(401, "Sign-in did not complete.");
  if (claims.email_verified !== true) throw fail(401, "Sign-in did not complete.");
  if (!validSub(claims.sub)) throw fail(401, "Sign-in did not complete.");
  return { sub: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
}

async function verifyWithRefresh(token, env, state, nonce) {
  const options = {
    jwks: await loadJwks(env, state, false),
    issuer: env.oidc.issuer,
    audience: env.oidc.clientId,
    nonce: nonce,
    now: env.now
  };
  try {
    return verifyIdToken(token, options);
  } catch (err) {
    if (!err.unknownKid) throw err;
    options.jwks = await loadJwks(env, state, true);
    return verifyIdToken(token, options);
  }
}

function plainPage(req, res, env, status, message, extra) {
  const headers = baseHeaders(req, env);
  if (extra) Object.keys(extra).forEach(function (key) { headers[key] = extra[key]; });
  headers["content-type"] = "text/html; charset=utf-8";
  const safe = String(message).replace(/[&<>]/g, function (ch) {
    return ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : "&gt;";
  });
  res.writeHead(status, headers);
  res.end("<!DOCTYPE html><html lang=\"en\"><meta charset=\"utf-8\"><title>Journey sign-in</title><body><p>" + safe + "</p></body></html>");
}

async function handle(req, res, env, state) {
  if (req.method === "OPTIONS") {
    sendEmpty(req, res, env, 204);
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1");
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/health") {
    sendJson(req, res, env, 200, {
      ok: true,
      auth: env.authMode,
      acceptsMembers: env.authMode === "oidc"
    });
    return;
  }

  if (req.method === "GET" && pathname === "/me") {
    const session = getSession(req, env, state);
    if (!session) return sendJson(req, res, env, 200, { signedIn: false });
    sendJson(req, res, env, 200, { signedIn: true, email: session.email, sessionTag: session.tag });
    return;
  }

  if (req.method === "GET" && pathname === "/progress") {
    if (url.searchParams.has("memberId") || url.searchParams.has("owner") || url.searchParams.has("sub")) {
      return sendJson(req, res, env, 400, { error: "Member identity comes from the session." });
    }
    const session = getSession(req, env, state);
    if (!session) return sendJson(req, res, env, 401, { error: "Sign in required." });
    const cohort = url.searchParams.get("cohort");
    const lane = url.searchParams.get("lane");
    if (!validCohort(cohort) || !validLane(lane)) {
      return sendJson(req, res, env, 400, { error: "Cohort and lane are required." });
    }
    const row = getProgress(state, session.sub, cohort, lane);
    sendJson(req, res, env, 200, row ? progressView(row) : emptyView(lane, cohort));
    return;
  }

  if (req.method === "PUT" && pathname === "/progress") {
    if (!csrfOk(req, env)) return sendJson(req, res, env, 403, { error: "Request was not accepted." });
    const session = getSession(req, env, state);
    if (!session) return sendJson(req, res, env, 401, { error: "Sign in required." });
    const body = await readJson(req);
    if (claimsIdentity(body) || claimsIdentity(body.record)) {
      return sendJson(req, res, env, 400, { error: "Member identity comes from the session." });
    }
    if (!validCohort(body.cohortStart) || !validLane(body.lane)) {
      return sendJson(req, res, env, 400, { error: "Cohort and lane are required." });
    }
    try {
      const saved = putProgress(env, state, session.sub, body.cohortStart, body.lane, body.record, body.ifRevision);
      sendJson(req, res, env, 200, saved);
    } catch (err) {
      if (err.status === 409 && err.conflict) {
        sendJson(req, res, env, 409, {
          error: "Revision conflict.",
          revision: err.conflict.revision,
          record: err.conflict.record
        });
        return;
      }
      throw err;
    }
    return;
  }

  if (req.method === "POST" && pathname === "/auth/logout") {
    if (!csrfOk(req, env)) return sendJson(req, res, env, 403, { error: "Request was not accepted." });
    deleteSession(req, env, state);
    sendEmpty(req, res, env, 204, { "set-cookie": cookieValue("", env, 0) });
    return;
  }

  if (req.method === "POST" && pathname === "/auth/test-session") {
    if (env.authMode !== "test" || !testLoginAllowed(req, env)) {
      return sendJson(req, res, env, 404, { error: "Not found." });
    }
    if (!csrfOk(req, env)) return sendJson(req, res, env, 403, { error: "Request was not accepted." });
    if (!rateAllow(state, env, "test:" + (req.socket && req.socket.remoteAddress))) {
      return sendJson(req, res, env, 429, { error: "Too many sign-in attempts." });
    }
    const body = await readJson(req);
    if (claimsIdentity(body)) return sendJson(req, res, env, 400, { error: "Member identity comes from the session." });
    const member = TEST_ACCOUNTS[body.account];
    if (!member) return sendJson(req, res, env, 400, { error: "Unknown local test member." });
    const id = createSession(env, state, member);
    sendJson(req, res, env, 200, { ok: true }, { "set-cookie": cookieValue(id, env, env.sessionTtlSeconds) });
    return;
  }

  if (req.method === "GET" && pathname === "/auth/start") {
    if (env.authMode !== "oidc") return sendJson(req, res, env, 404, { error: "Not found." });
    if (!rateAllow(state, env, "start:" + (req.socket && req.socket.remoteAddress))) {
      return sendJson(req, res, env, 429, { error: "Too many sign-in attempts." });
    }
    const doc = await discover(env, state);
    const stateId = crypto.randomBytes(32).toString("base64url");
    const cookieId = crypto.randomBytes(32).toString("base64url");
    const verifier = crypto.randomBytes(32).toString("base64url");
    const nonce = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    state.oauth.set(stateId, { verifier: verifier, nonce: nonce, cookieId: cookieId, exp: env.now() + OAUTH_TTL_MS });
    const target = new URL(doc.authorization_endpoint);
    target.searchParams.set("response_type", "code");
    target.searchParams.set("client_id", env.oidc.clientId);
    target.searchParams.set("redirect_uri", env.oidc.redirectUri);
    target.searchParams.set("scope", "openid email");
    target.searchParams.set("state", stateId);
    target.searchParams.set("nonce", nonce);
    target.searchParams.set("code_challenge", challenge);
    target.searchParams.set("code_challenge_method", "S256");
    sendEmpty(req, res, env, 302, {
      location: target.toString(),
      "set-cookie": oauthCookie(cookieId, env)
    });
    return;
  }

  if (req.method === "GET" && pathname === "/auth/callback") {
    if (env.authMode !== "oidc") return sendJson(req, res, env, 404, { error: "Not found." });
    const code = url.searchParams.get("code") || "";
    const stateId = url.searchParams.get("state") || "";
    const clearOauth = { "set-cookie": oauthCookie("", env) };
    if (code.length < 1 || code.length > 2048 || stateId.length < 20 || stateId.length > 200) {
      return plainPage(req, res, env, 400, "Sign-in did not complete. You can return to the journey and try again.", clearOauth);
    }
    const pending = state.oauth.get(stateId);
    state.oauth.delete(stateId);
    const oauthJar = readCookie(req, OAUTH_COOKIE);
    const bound = pending && secretOk(oauthJar, pending.cookieId);
    if (!pending || pending.exp <= env.now() || !bound) {
      return plainPage(req, res, env, 400, "Sign-in did not complete. You can return to the journey and try again.", clearOauth);
    }
    const doc = await discover(env, state);
    let tokenRes;
    try {
      tokenRes = await env.fetch(doc.token_endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: env.oidc.redirectUri,
          client_id: env.oidc.clientId,
          client_secret: env.oidc.clientSecret,
          code_verifier: pending.verifier
        })
      });
    } catch (e) {
      return plainPage(req, res, env, 502, "Sign-in is unavailable. You can return to the journey and try again.", clearOauth);
    }
    if (!tokenRes || !tokenRes.ok) {
      return plainPage(req, res, env, 401, "Sign-in did not complete. You can return to the journey and try again.", clearOauth);
    }
    let tokenBody;
    try { tokenBody = await tokenRes.json(); } catch (e) {
      return plainPage(req, res, env, 401, "Sign-in did not complete. You can return to the journey and try again.", clearOauth);
    }
    let member;
    try {
      member = await verifyWithRefresh(tokenBody && tokenBody.id_token, env, state, pending.nonce);
    } catch (e) {
      return plainPage(req, res, env, 401, "Sign-in did not complete. You can return to the journey and try again.", clearOauth);
    }
    const id = createSession(env, state, member);
    sendEmpty(req, res, env, 302, {
      location: env.successUrl,
      "set-cookie": [cookieValue(id, env, env.sessionTtlSeconds), oauthCookie("", env)]
    });
    return;
  }

  sendJson(req, res, env, 404, { error: "Not found." });
}

function createHandler(env, state) {
  return function (req, res) {
    handle(req, res, env, state).catch(function (err) {
      if (res.headersSent || res.writableEnded) return;
      const status = err.status || 500;
      sendJson(req, res, env, status, { error: err.publicMessage || "Something went wrong." });
    });
  };
}

function listen(options) {
  return new Promise(function (resolve, reject) {
    let env;
    let state;
    try {
      env = normalizeEnv(options || envFromProcess());
      state = createState(env);
    } catch (err) {
      reject(err);
      return;
    }
    const server = http.createServer(createHandler(env, state));
    server.listen(env.port, env.host, function () {
      const addr = server.address();
      const host = env.host === "::1" ? "[::1]" : env.host;
      resolve({
        server: server,
        state: state,
        env: env,
        url: "http://" + host + ":" + addr.port,
        close: function () { return new Promise(function (done) { server.close(function () { done(); }); }); }
      });
    });
    server.on("error", reject);
  });
}

module.exports = {
  TEST_ACCOUNTS: TEST_ACCOUNTS,
  envFromProcess: envFromProcess,
  normalizeEnv: normalizeEnv,
  createState: createState,
  createHandler: createHandler,
  listen: listen,
  testLoginAllowed: testLoginAllowed,
  verifyIdToken: verifyIdToken,
  storedRecord: storedRecord,
  loopbackAddress: loopbackAddress
};

if (require.main === module) {
  let env;
  try {
    env = envFromProcess();
  } catch (err) {
    console.error(err.publicMessage || "Member API configuration is not valid.");
    process.exit(1);
  }
  listen(env).then(function (api) {
    console.log("Oneness Journey member API");
    console.log("auth: " + api.env.authMode);
    if (api.env.authMode === "test") console.log("LOCAL TEST MODE. Not for a public host.");
    if (api.env.authMode !== "oidc") {
      console.log("This process does not accept real member sign-in. The public journey page stays device-only until it is pointed here.");
    }
    console.log("listening on " + api.url);
  }).catch(function (err) {
    console.error(err.publicMessage || "Member API did not start.");
    process.exit(1);
  });
}
