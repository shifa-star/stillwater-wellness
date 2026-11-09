const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const API = require("./member-api.js");
const A = require("./account.js");
const P = require("./progress.js");

const ORIGIN = "https://app.example.test";
const COHORT = "2026-11-09";
const TEST_SECRET = "local-test-secret-not-production";
const CLIENT_ID = "journey-client";
const CLIENT_SECRET = "journey-client-secret-do-not-leak-9f3a";
const seenText = [];

function cookiePair(res, name) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const hit = list.find(function (line) { return line.startsWith(name + "="); });
  return hit ? hit.split(";")[0] : "";
}

async function call(base, method, pathname, opts) {
  opts = opts || {};
  const headers = Object.assign({
    accept: "application/json",
    origin: opts.origin === undefined ? ORIGIN : opts.origin
  }, opts.headers || {});
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.json) {
    headers["content-type"] = "application/json";
    headers["x-journey-request"] = "1";
  }
  const res = await fetch(base + pathname, {
    method: method,
    headers: headers,
    body: opts.json ? JSON.stringify(opts.json) : opts.rawBody,
    redirect: "manual"
  });
  const text = await res.text();
  seenText.push(text);
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
  return { status: res.status, body: body, text: text, headers: res.headers };
}

function testEnv(extra) {
  return Object.assign({
    authMode: "test",
    host: "127.0.0.1",
    port: 0,
    testSecret: TEST_SECRET,
    cookieSecure: false,
    allowedOrigin: ORIGIN,
    sessionTtlSeconds: 3600
  }, extra || {});
}

async function signIn(base, account) {
  const res = await call(base, "POST", "/auth/test-session", {
    json: { account: account },
    headers: { "x-journey-test-secret": TEST_SECRET }
  });
  assert.strictEqual(res.status, 200, res.text);
  assert.deepStrictEqual(res.body, { ok: true });
  const cookie = cookiePair(res, "oneness_journey_session");
  assert.ok(cookie);
  assert.match(res.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(res.headers.get("set-cookie"), /SameSite=Lax/i);
  assert.ok(!res.text.includes("test-member"));
  return cookie;
}

function createJar(origin) {
  const jar = new Map();
  return {
    fetch: function (url, opts) {
      opts = opts || {};
      const headers = new Headers(opts.headers || {});
      if (!headers.has("origin")) headers.set("origin", origin);
      if (jar.size) headers.set("cookie", Array.from(jar.values()).join("; "));
      return fetch(url, Object.assign({}, opts, { headers: headers, redirect: opts.redirect || "follow" })).then(function (res) {
        const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
        list.forEach(function (line) {
          const pair = line.split(";")[0];
          const name = pair.slice(0, pair.indexOf("="));
          if (/Max-Age=0/i.test(line) || pair.endsWith("=")) jar.delete(name);
          else jar.set(name, pair);
        });
        return res;
      });
    }
  };
}

function signJwt(payload, privateKey, kid, alg) {
  const header = Buffer.from(JSON.stringify({ alg: alg || "RS256", typ: "JWT", kid: kid || "test-1" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = header + "." + body;
  if ((alg || "RS256") === "none") return data + ".";
  const sig = crypto.sign("sha256", Buffer.from(data), privateKey).toString("base64url");
  return data + "." + sig;
}

function startIssuer() {
  const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = pair.publicKey.export({ format: "jwk" });
  jwk.kid = "test-1";
  jwk.alg = "RS256";
  jwk.use = "sig";
  const seen = { tokenBodies: [] };
  let port = 0;
  const server = http.createServer(function (req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    const origin = "http://127.0.0.1:" + port;
    if (url.pathname === "/.well-known/openid-configuration") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        issuer: origin,
        authorization_endpoint: origin + "/authorize",
        token_endpoint: origin + "/token",
        jwks_uri: origin + "/jwks"
      }));
      return;
    }
    if (url.pathname === "/jwks") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (url.pathname === "/token" && req.method === "POST") {
      const chunks = [];
      req.on("data", function (chunk) { chunks.push(chunk); });
      req.on("end", function () {
        const raw = Buffer.concat(chunks).toString("utf8");
        seen.tokenBodies.push(raw);
        const params = new URLSearchParams(raw);
        if (params.get("client_secret") !== CLIENT_SECRET || params.get("client_id") !== CLIENT_ID) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_client" }));
          return;
        }
        const challenge = crypto.createHash("sha256").update(params.get("code_verifier") || "").digest("base64url");
        if (challenge !== seen.expectedChallenge || params.get("redirect_uri") !== seen.redirectUri) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant" }));
          return;
        }
        const now = Math.floor(Date.now() / 1000);
        const claims = Object.assign({
          iss: origin,
          aud: CLIENT_ID,
          sub: "oidc-member-1",
          email: "oidc-member@journey.test",
          email_verified: true,
          nonce: seen.nonce,
          exp: now + 300
        }, seen.claimsOverride || {});
        const token = signJwt(claims, seen.signKey || pair.privateKey, seen.kid || "test-1", seen.alg || "RS256");
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ id_token: token }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise(function (resolve) {
    server.listen(0, "127.0.0.1", function () {
      port = server.address().port;
      resolve({
        seen: seen,
        origin: "http://127.0.0.1:" + port,
        privateKey: pair.privateKey,
        otherKey: other.privateKey,
        jwk: jwk,
        close: function () { return new Promise(function (done) { server.close(function () { done(); }); }); }
      });
    });
  });
}

async function oidcLogin(api, issuer, mutate) {
  issuer.seen.claimsOverride = null;
  issuer.seen.signKey = null;
  issuer.seen.alg = "RS256";
  issuer.seen.kid = "test-1";
  const start = await fetch(api.url + "/auth/start", { redirect: "manual" });
  const location = start.headers.get("location");
  const oauth = cookiePair(start, "oneness_journey_oauth");
  assert.strictEqual(start.status, 302);
  assert.ok(oauth);
  const params = new URL(location).searchParams;
  assert.strictEqual(new URL(location).origin, issuer.origin);
  assert.strictEqual(params.get("code_challenge_method"), "S256");
  assert.strictEqual(params.get("client_id"), CLIENT_ID);
  issuer.seen.expectedChallenge = params.get("code_challenge");
  issuer.seen.nonce = params.get("nonce");
  issuer.seen.redirectUri = params.get("redirect_uri");
  if (mutate) mutate(issuer.seen);
  const callback = await fetch(api.url + "/auth/callback?code=good-code&state=" + encodeURIComponent(params.get("state")), {
    redirect: "manual",
    headers: { cookie: oauth }
  });
  seenText.push(await callback.clone().text());
  return { start: start, callback: callback, params: params, oauth: oauth };
}

async function main() {
  const disabled = await API.listen({ authMode: "disabled", host: "127.0.0.1", port: 0, allowedOrigin: ORIGIN });
  try {
    const health = await call(disabled.url, "GET", "/health");
    assert.deepStrictEqual(health.body, { ok: true, auth: "disabled", acceptsMembers: false });
    assert.strictEqual(health.headers.get("set-cookie"), null);
    const open = await call(disabled.url, "GET", "/progress?cohort=" + COHORT + "&lane=buyer");
    assert.strictEqual(open.status, 401);
    const write = await call(disabled.url, "PUT", "/progress", {
      json: { cohortStart: COHORT, lane: "buyer", ifRevision: 0, record: { journeyFeedback: "nope" } }
    });
    assert.strictEqual(write.status, 401);
    assert.strictEqual((await call(disabled.url, "POST", "/auth/test-session", {
      json: { account: "member-a" },
      headers: { "x-journey-test-secret": TEST_SECRET }
    })).status, 404);
    assert.strictEqual((await call(disabled.url, "GET", "/auth/start")).status, 404);
  } finally {
    await disabled.close();
  }

  await assert.rejects(
    API.listen({ authMode: "test", host: "0.0.0.0", port: 0, testSecret: TEST_SECRET }),
    /loopback/
  );

  const spoofEnv = API.normalizeEnv(testEnv());
  const spoofState = API.createState(spoofEnv);
  const spoofed = { statusCode: 0, body: "", headersSent: false, writableEnded: false, writeHead: function (status) { this.statusCode = status; this.headersSent = true; }, end: function (body) { this.body = body || ""; this.writableEnded = true; } };
  API.createHandler(spoofEnv, spoofState)({
    method: "POST",
    url: "/auth/test-session",
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      "x-journey-request": "1",
      "x-journey-test-secret": TEST_SECRET,
      "x-forwarded-for": "127.0.0.1"
    },
    socket: { remoteAddress: "203.0.113.9" }
  }, spoofed);
  assert.strictEqual(spoofed.statusCode, 404);
  assert.strictEqual(API.testLoginAllowed({
    headers: { "x-journey-test-secret": TEST_SECRET, "x-forwarded-for": "127.0.0.1" },
    socket: { remoteAddress: "203.0.113.9" }
  }, spoofEnv), false);
    const api = await API.listen(testEnv());
  try {
    assert.strictEqual((await call(api.url, "GET", "/progress?cohort=" + COHORT + "&lane=buyer")).status, 401);
    assert.strictEqual((await call(api.url, "PUT", "/progress", {
      json: { cohortStart: COHORT, lane: "buyer", ifRevision: 0, record: {} }
    })).status, 401);
    const anonMe = await call(api.url, "GET", "/me");
    assert.strictEqual(anonMe.status, 200);
    assert.deepStrictEqual(anonMe.body, { signedIn: false });
    assert.strictEqual((await call(api.url, "POST", "/auth/test-session", {
      json: { account: "member-a" },
      headers: { "x-journey-test-secret": "wrong-secret-value" }
    })).status, 404);
    assert.strictEqual((await call(api.url, "POST", "/auth/test-session", {
      json: { account: "member-a", memberId: "test-member-b" },
      headers: { "x-journey-test-secret": TEST_SECRET }
    })).status, 400);

    const cookieA = await signIn(api.url, "member-a");
    const cookieB = await signIn(api.url, "member-b");
    const meA = await call(api.url, "GET", "/me", { cookie: cookieA });
    assert.strictEqual(meA.status, 200);
    assert.strictEqual(meA.body.email, "member-a@journey.test");
    assert.ok(meA.body.sessionTag);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(meA.body, "sub"), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(meA.body, "memberId"), false);
    const meB = await call(api.url, "GET", "/me", { cookie: cookieB });
    assert.notStrictEqual(meA.body.sessionTag, meB.body.sessionTag);

    const voice = "It felt like \"home\".\nTruly.";
    const saved = await call(api.url, "PUT", "/progress", {
      cookie: cookieA,
      json: {
        cohortStart: COHORT,
        lane: "buyer",
        ifRevision: 0,
        record: {
          lane: "advocate",
          cohortStart: "2027-01-04",
          serverRevision: 99,
          journeyFeedback: voice,
          days: { "1": { video: true, reflection: "member A buyer" }, "0": { video: true } }
        }
      }
    });
    assert.strictEqual(saved.status, 200, saved.text);
    assert.strictEqual(saved.body.revision, 1);
    assert.strictEqual(saved.body.record.lane, "buyer");
    assert.strictEqual(saved.body.record.cohortStart, COHORT);
    assert.strictEqual(saved.body.record.serverRevision, 1);
    assert.strictEqual(saved.body.record.journeyFeedback, voice);
    assert.strictEqual(saved.body.record.days["1"].reflection, "member A buyer");
    assert.strictEqual(saved.body.record.days["0"], undefined);
    assert.ok(!saved.text.includes("test-member"));

    const again = await call(api.url, "GET", "/progress?cohort=" + COHORT + "&lane=buyer", { cookie: cookieA });
    assert.strictEqual(again.body.record.days["1"].reflection, "member A buyer");
    const otherLane = await call(api.url, "GET", "/progress?cohort=" + COHORT + "&lane=advocate", { cookie: cookieA });
    assert.deepStrictEqual(otherLane.body.record.days, {});
    const otherCohort = await call(api.url, "GET", "/progress?cohort=2027-01-04&lane=buyer", { cookie: cookieA });
    assert.deepStrictEqual(otherCohort.body.record.days, {});
    const asB = await call(api.url, "GET", "/progress?cohort=" + COHORT + "&lane=buyer", { cookie: cookieB });
    assert.deepStrictEqual(asB.body.record.days, {});
    assert.strictEqual(asB.body.record.journeyFeedback, "");
    assert.ok(!asB.text.includes("member A buyer"));
    assert.ok(!asB.text.includes("home"));

    const named = await call(api.url, "GET", "/progress?cohort=" + COHORT + "&lane=buyer&memberId=test-member-a", { cookie: cookieB });
    assert.strictEqual(named.status, 400);
    const planted = await call(api.url, "PUT", "/progress", {
      cookie: cookieB,
      json: {
        memberId: "test-member-a",
        cohortStart: COHORT,
        lane: "buyer",
        ifRevision: 0,
        record: { days: { "1": { reflection: "planted by B" } } }
      }
    });
    assert.strictEqual(planted.status, 400);
    const stillA = await call(api.url, "GET", "/progress?cohort=" + COHORT + "&lane=buyer", { cookie: cookieA });
    assert.strictEqual(stillA.body.record.days["1"].reflection, "member A buyer");
    assert.strictEqual(stillA.body.revision, 1);

    const conflict = await call(api.url, "PUT", "/progress", {
      cookie: cookieA,
      json: { cohortStart: COHORT, lane: "buyer", ifRevision: 0, record: { days: { "1": { reflection: "stale" } } } }
    });
    assert.strictEqual(conflict.status, 409);
    assert.strictEqual(conflict.body.record.days["1"].reflection, "member A buyer");
    const forged = await call(api.url, "GET", "/me", { cookie: "oneness_journey_session=forged-session-token-value" });
    assert.deepStrictEqual(forged.body, { signedIn: false });
    const badOrigin = await call(api.url, "PUT", "/progress", {
      cookie: cookieA,
      origin: "https://evil.example",
      json: { cohortStart: COHORT, lane: "buyer", ifRevision: 1, record: { days: { "1": { reflection: "crossed" } } } }
    });
    assert.strictEqual(badOrigin.status, 403);
    const noHeader = await call(api.url, "PUT", "/progress", {
      cookie: cookieA,
      rawBody: JSON.stringify({ cohortStart: COHORT, lane: "buyer", ifRevision: 1, record: {} }),
      headers: { "content-type": "application/json" }
    });
    assert.strictEqual(noHeader.status, 403);
    assert.strictEqual((await call(api.url, "GET", "/progress?cohort=" + COHORT + "&lane=buyer", { cookie: cookieA })).body.record.days["1"].reflection, "member A buyer");

    const polluted = await call(api.url, "PUT", "/progress", {
      cookie: cookieB,
      rawBody: '{"cohortStart":"' + COHORT + '","lane":"advocate","ifRevision":0,"record":{"__proto__":{"polluted":true},"days":{"3":{"reflection":"b advocate"}}}}',
      headers: { "content-type": "application/json", "x-journey-request": "1" }
    });
    assert.strictEqual(polluted.status, 200, polluted.text);
    assert.strictEqual(({}).polluted, undefined);
    assert.strictEqual(polluted.body.record.days["3"].reflection, "b advocate");
    assert.strictEqual(polluted.body.record.polluted, undefined);
    assert.strictEqual((await call(api.url, "GET", "/progress?cohort=" + COHORT + "&lane=advocate", { cookie: cookieA })).body.record.days["3"], undefined);

    const loggedOut = await call(api.url, "POST", "/auth/logout", { cookie: cookieA, json: {} });
    assert.strictEqual(loggedOut.status, 204);
    assert.match(loggedOut.headers.get("set-cookie"), /Max-Age=0/i);
    assert.strictEqual((await call(api.url, "GET", "/progress?cohort=" + COHORT + "&lane=buyer", { cookie: cookieA })).status, 401);
    assert.strictEqual((await call(api.url, "GET", "/progress?cohort=" + COHORT + "&lane=advocate", { cookie: cookieB })).body.record.days["3"].reflection, "b advocate");

    const jar = createJar(ORIGIN);
    const writes = [];
    const storage = {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(storage.data, key) ? storage.data[key] : null; },
      setItem: function (key, value) { storage.data[key] = String(value); writes.push(key); },
      data: {}
    };
    const device = P.save(storage, P.setReflection(P.emptyRecord("buyer", COHORT), 1, "unattributed device reflection"));
    const beforeWrites = writes.length;
    const account = A.create({
      config: { enabled: true, apiBase: api.url, localDemo: true, testSecret: TEST_SECRET },
      progress: P,
      fetch: jar.fetch
    });
    assert.strictEqual((await account.signInLocal("member-a")).ok, true);
    assert.strictEqual((await account.boot()).mode, "account");
    const loaded = await account.load("buyer", COHORT, device);
    assert.strictEqual(loaded.imported, false);
    assert.strictEqual(loaded.deviceNote, true);
    assert.strictEqual(loaded.source, "account");
    assert.ok(!JSON.stringify(loaded.record).includes("unattributed"));
    assert.strictEqual(loaded.record.days["1"].reflection, "member A buyer");
    assert.strictEqual(writes.length, beforeWrites);
    const accountSave = await account.save("buyer", COHORT, P.setReflection(loaded.record, 1, "account reflection A"));
    assert.strictEqual(accountSave.synced, true);
    assert.strictEqual(accountSave.record.days["1"].reflection, "account reflection A");
    assert.ok(!JSON.stringify(storage.data).includes("account reflection"));
    const advocate = await account.load("advocate", COHORT, P.emptyRecord("advocate", COHORT));
    assert.deepStrictEqual(advocate.record.days, {});
    const nextCohort = await account.load("buyer", "2027-01-04", device);
    assert.ok(!JSON.stringify(nextCohort.record).includes("account reflection"));
    const tagA = account.sessionTag();
    assert.strictEqual((await account.signInLocal("member-b")).ok, true);
    const changed = await account.refreshIdentity();
    assert.strictEqual(changed.changed, true);
    assert.notStrictEqual(account.sessionTag(), tagA);
    const memberB = await account.load("buyer", COHORT, device);
    const view = A.recordForViewer({
      mode: "changed",
      serverRecord: memberB.record,
      deviceRecord: device,
      emptyRecord: P.emptyRecord("buyer", COHORT)
    });
    assert.strictEqual(view.showDevice, false);
    assert.ok(!JSON.stringify(view.record).includes("account reflection A"));
    assert.ok(!JSON.stringify(view.record).includes("unattributed"));
    assert.strictEqual((await account.logout()).ok, true);
    assert.strictEqual(account.signedIn(), false);
    const returned = await account.load("buyer", COHORT, device);
    assert.strictEqual(returned.source, "device");
    assert.strictEqual(returned.record.days["1"].reflection, "unattributed device reflection");
    assert.ok(!JSON.stringify(storage.data).includes("account reflection"));

    const down = A.create({
      config: { enabled: true, apiBase: api.url, localDemo: true, testSecret: TEST_SECRET },
      progress: P,
      fetch: function (url, opts) {
        if (opts && opts.method === "PUT") return Promise.reject(new Error("down"));
        return jar.fetch(url, opts);
      }
    });
    await down.signInLocal("member-a");
    await down.boot();
    const failedSave = await down.save("buyer", COHORT, P.setReflection(P.emptyRecord("buyer", COHORT), 2, "not stored"));
    assert.strictEqual(failedSave.ok, false);
    assert.strictEqual(failedSave.synced, false);
    const untouched = await call(api.url, "GET", "/progress?cohort=" + COHORT + "&lane=buyer", { cookie: await signIn(api.url, "member-a") });
    assert.ok(!untouched.text.includes("not stored"));
  } finally {
    await api.close();
  }

  const file = path.join(os.tmpdir(), "oneness-journey-" + crypto.randomBytes(6).toString("hex") + ".json");
  const first = await API.listen(testEnv({ dataFile: file }));
  let persisted;
  try {
    const cookie = await signIn(first.url, "member-a");
    persisted = await call(first.url, "PUT", "/progress", {
      cookie: cookie,
      json: { cohortStart: COHORT, lane: "buyer", ifRevision: 0, record: { days: { "4": { reflection: "kept on disk" } } } }
    });
    assert.strictEqual(persisted.status, 200);
  } finally {
    await first.close();
  }
  assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
  const second = await API.listen(testEnv({ dataFile: file }));
  try {
    const cookie = await signIn(second.url, "member-a");
    const other = await signIn(second.url, "member-b");
    const loaded = await call(second.url, "GET", "/progress?cohort=" + COHORT + "&lane=buyer", { cookie: cookie });
    assert.strictEqual(loaded.body.record.days["4"].reflection, "kept on disk");
    const hiddenFromB = await call(second.url, "GET", "/progress?cohort=" + COHORT + "&lane=buyer", { cookie: other });
    assert.ok(!hiddenFromB.text.includes("kept on disk"));
  } finally {
    await second.close();
    fs.unlinkSync(file);
  }
  const corrupt = file + ".bad";
  fs.writeFileSync(corrupt, "{");
  await assert.rejects(API.listen({ authMode: "disabled", host: "127.0.0.1", port: 0, dataFile: corrupt }), /not a valid member store/);
  fs.unlinkSync(corrupt);

  const issuer = await startIssuer();
  const successUrl = "http://127.0.0.1:9/journey/";
  const oidc = await API.listen({
    authMode: "oidc",
    host: "127.0.0.1",
    port: 0,
    cookieSecure: false,
    allowedOrigin: "http://127.0.0.1:9",
    successUrl: successUrl,
    oidc: {
      issuer: issuer.origin,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: "http://127.0.0.1:9/auth/callback"
    }
  });
  try {
    assert.strictEqual((await call(oidc.url, "POST", "/auth/test-session", {
      json: { account: "member-a" },
      headers: { "x-journey-test-secret": TEST_SECRET }
    })).status, 404);
    const good = await oidcLogin(oidc, issuer);
    assert.strictEqual(good.callback.status, 302, await good.callback.clone().text());
    assert.strictEqual(good.callback.headers.get("location"), successUrl);
    const session = cookiePair(good.callback, "oneness_journey_session");
    assert.ok(session);
    const me = await call(oidc.url, "GET", "/me", { cookie: session, origin: "http://127.0.0.1:9" });
    assert.strictEqual(me.body.email, "oidc-member@journey.test");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(me.body, "sub"), false);
    const replay = await fetch(oidc.url + "/auth/callback?code=good-code&state=" + encodeURIComponent(good.params.get("state")), {
      redirect: "manual",
      headers: { cookie: good.oauth }
    });
    assert.strictEqual(replay.status, 400);
    const unbound = await oidcLogin(oidc, issuer);
    const missingCookie = await fetch(oidc.url + "/auth/callback?code=good-code&state=" + encodeURIComponent(unbound.params.get("state")), {
      redirect: "manual"
    });
    assert.strictEqual(missingCookie.status, 400);
    assert.strictEqual(missingCookie.headers.get("set-cookie") && missingCookie.headers.get("set-cookie").includes("oneness_journey_session="), false);

    const badSign = await oidcLogin(oidc, issuer, function (seen) { seen.signKey = issuer.otherKey; });
    assert.strictEqual(badSign.callback.status, 401);
    const unverified = await oidcLogin(oidc, issuer, function (seen) { seen.claimsOverride = { email_verified: false }; });
    assert.strictEqual(unverified.callback.status, 401);
    const noneAlg = await oidcLogin(oidc, issuer, function (seen) { seen.alg = "none"; });
    assert.strictEqual(noneAlg.callback.status, 401);
    const wrongAud = await oidcLogin(oidc, issuer, function (seen) { seen.claimsOverride = { aud: "someone-else" }; });
    assert.strictEqual(wrongAud.callback.status, 401);
    const expired = await oidcLogin(oidc, issuer, function (seen) { seen.claimsOverride = { exp: Math.floor(Date.now() / 1000) - 180 }; });
    assert.strictEqual(expired.callback.status, 401);
    const evil = await fetch(oidc.url + "/auth/start?return=https://evil.example/phish", { redirect: "manual" });
    assert.ok(!String(evil.headers.get("location")).includes("evil.example"));
    assert.ok(issuer.seen.tokenBodies.length > 0);
    assert.ok(issuer.seen.tokenBodies.every(function (body) { return body.includes("code_verifier="); }));
  } finally {
    await oidc.close();
    await issuer.close();
  }

  const now = Math.floor(Date.now() / 1000);
  const jwks = { keys: [issuer.jwk] };
  const claims = {
    iss: issuer.origin,
    aud: CLIENT_ID,
    sub: "oidc-member-1",
    email_verified: true,
    nonce: "nonce-1",
    exp: now + 300
  };
  assert.throws(function () {
    API.verifyIdToken(signJwt(Object.assign({}, claims, { nonce: "other" }), issuer.privateKey), {
      jwks: jwks, issuer: issuer.origin, audience: CLIENT_ID, nonce: "nonce-1", now: function () { return Date.now(); }
    });
  });
  assert.throws(function () {
    API.verifyIdToken(signJwt(Object.assign({}, claims, { iss: "https://evil.example" }), issuer.privateKey), {
      jwks: jwks, issuer: issuer.origin, audience: CLIENT_ID, nonce: "nonce-1", now: function () { return Date.now(); }
    });
  });

  assert.ok(seenText.every(function (text) { return !String(text).includes(CLIENT_SECRET); }));
  assert.ok(!JSON.stringify(issuer.seen.tokenBodies).includes("BEGIN"));
  console.log("journey/member-api.test.js ok");
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
