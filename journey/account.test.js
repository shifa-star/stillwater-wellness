const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const A = require("./account.js");
const P = require("./progress.js");

const root = path.join(__dirname, "..");
const COHORT = "2026-11-09";

assert.strictEqual(A.ADOPT_DEVICE_REFLECTIONS, false);
assert.strictEqual(A.authEnabled({ enabled: false, apiBase: "https://journey-api.example.test" }), false);
assert.strictEqual(A.authEnabled({ enabled: true, apiBase: "" }), false);
assert.strictEqual(A.authEnabled({ enabled: true, apiBase: "javascript:alert(1)" }), false);
assert.strictEqual(A.authEnabled({ enabled: true, apiBase: "http://journey-api.example.test" }), false);
assert.strictEqual(A.authEnabled({ enabled: true, apiBase: "https://journey-api.example.test" }), true);
assert.strictEqual(A.authEnabled({ enabled: true, apiBase: "http://127.0.0.1:8787/" }), true);
assert.strictEqual(A.apiBase({ enabled: true, apiBase: "http://127.0.0.1:8787/" }), "http://127.0.0.1:8787");
assert.strictEqual(A.localDemoAllowed({ enabled: true, apiBase: "https://journey-api.example.test", localDemo: true, testSecret: "x" }), false);
assert.strictEqual(A.localDemoAllowed({ enabled: true, apiBase: "http://127.0.0.1:8787", localDemo: true }), true);
assert.strictEqual(A.authStartUrl({ enabled: false, apiBase: "https://journey-api.example.test" }), "");

const device = P.setReflection(P.emptyRecord("buyer", COHORT), 1, "  unattributed dawn note  ");
device.journeyFeedback = "";
assert.strictEqual(A.deviceHasUnattributedText(device), true);
assert.strictEqual(A.deviceHasUnattributedText(P.emptyRecord("buyer", COHORT)), false);
assert.strictEqual(A.deviceHasUnattributedText(P.setReflection(P.emptyRecord("advocate", COHORT), 2, "   ")), false);

const serverEmpty = P.emptyRecord("buyer", COHORT);
const viewed = A.recordForViewer({
  mode: "account",
  serverRecord: serverEmpty,
  deviceRecord: device,
  emptyRecord: serverEmpty
});
assert.strictEqual(viewed.showDevice, false);
assert.strictEqual(viewed.source, "account");
assert.deepStrictEqual(viewed.record.days, {});
assert.ok(!JSON.stringify(viewed.record).includes("unattributed"));

const hidden = A.recordForViewer({
  mode: "unreachable",
  serverRecord: null,
  deviceRecord: device,
  emptyRecord: serverEmpty
});
assert.strictEqual(hidden.showDevice, false);
assert.strictEqual(hidden.record, serverEmpty);

const signedOut = A.recordForViewer({
  mode: "signedOut",
  serverRecord: P.setReflection(P.emptyRecord("buyer", COHORT), 1, "account words"),
  deviceRecord: device,
  emptyRecord: serverEmpty
});
assert.strictEqual(signedOut.showDevice, true);
assert.strictEqual(signedOut.record.days["1"].reflection, "  unattributed dawn note  ");

const switched = A.recordForViewer({
  mode: "changed",
  serverRecord: P.emptyRecord("buyer", COHORT),
  deviceRecord: device,
  previousRecord: P.setReflection(P.emptyRecord("buyer", COHORT), 1, "member A private"),
  emptyRecord: serverEmpty
});
assert.strictEqual(switched.source, "account");
assert.ok(!JSON.stringify(switched.record).includes("member A private"));
assert.ok(!JSON.stringify(switched.record).includes("unattributed"));

assert.strictEqual(A.fieldStatus("hello", "hello", "device"), A.DEVICE_SAVED);
assert.strictEqual(A.fieldStatus("hello", "hello", "saved"), A.ACCOUNT_SAVED);
assert.strictEqual(A.fieldStatus("hello", "hello", "saving"), A.ACCOUNT_SAVING);
assert.strictEqual(A.fieldStatus("hello", "", "saved"), A.NOT_SAVED);
assert.strictEqual(A.fieldStatus("   ", "   ", "saved"), "");
assert.strictEqual(A.fieldStatus("hello", "hello", "error"), A.DEVICE_SAVED);
assert.strictEqual(A.persistenceLine({ enabled: false, mode: "account" }), A.DEVICE_LINE);
assert.strictEqual(A.persistenceLine({ enabled: true, mode: "account" }), A.ACCOUNT_LINE);
assert.strictEqual(A.persistenceLine({ enabled: true, mode: "signedOut" }), A.SIGNED_OUT_LINE);
assert.strictEqual(A.persistenceLine({ enabled: true, mode: "unreachable" }), A.UNREACHABLE_LINE);
assert.ok(!A.DEVICE_SAVED.includes("account"));
assert.ok(!A.ACCOUNT_SAVED.toLowerCase().includes("sync"));

const offPanel = A.panelModel({ enabled: false, apiBase: "", mode: "signedOut" });
assert.strictEqual(offPanel.kind, "device-only");
const publicPanel = A.panelModel({
  enabled: true,
  apiBase: "https://journey-api.example.test",
  localDemo: true,
  testSecret: "not-a-real-secret",
  mode: "signedOut"
});
assert.strictEqual(publicPanel.kind, "signed-out");
assert.strictEqual(publicPanel.signInUrl, "https://journey-api.example.test/auth/start");
assert.ok(!JSON.stringify(publicPanel).toLowerCase().includes("magic"));
assert.ok(!JSON.stringify(publicPanel).includes("not-a-real-secret"));
const localPanel = A.panelModel({
  enabled: true,
  apiBase: "http://127.0.0.1:8787",
  localDemo: true,
  mode: "signedOut"
});
assert.strictEqual(localPanel.kind, "local-demo");
assert.ok(localPanel.copy.includes("No email is sent"));
const signedPanel = A.panelModel({
  enabled: true,
  apiBase: "https://journey-api.example.test",
  mode: "account",
  email: "member@journey.test",
  deviceNote: true
});
assert.strictEqual(signedPanel.kind, "signed-in");
assert.strictEqual(signedPanel.title, "member@journey.test");
assert.ok(signedPanel.note.includes(A.DEVICE_NOTE));
assert.strictEqual(A.draftScope(false, "tag-a"), "device");
assert.strictEqual(A.draftScope(true, ""), "device");
assert.strictEqual(A.draftScope(true, "tag-a"), "account:tag-a");
assert.notStrictEqual(A.draftScope(true, "tag-a"), A.draftScope(true, "tag-b"));
assert.notStrictEqual(A.draftScope(true, "tag-a"), A.draftScope(false, "tag-a"));
assert.strictEqual(A.displayEmail("not an email"), "");
assert.strictEqual(A.panelModel({
  enabled: true,
  apiBase: "https://journey-api.example.test",
  mode: "unreachable"
}).kind, "unreachable");

let fetches = 0;
const disabled = A.create({
  config: { enabled: false, apiBase: "https://journey-api.example.test" },
  progress: P,
  fetch: function () { fetches += 1; return Promise.reject(new Error("should not run")); }
});
disabled.boot().then(function (result) {
  assert.strictEqual(result.mode, "off");
  assert.strictEqual(fetches, 0);
  return disabled.signInLocal("member-a");
}).then(function (local) {
  assert.strictEqual(local.status, 404);
  assert.strictEqual(fetches, 0);
  const memory = [];
  const storage = {
    getItem: function () { return null; },
    setItem: function (key, value) { memory.push([key, value]); }
  };
  const anonymous = P.save(storage, P.setReflection(P.emptyRecord("buyer", COHORT), 1, "device only"));
  assert.strictEqual(anonymous.days["1"].reflection, "device only");
  assert.ok(memory[0][0].indexOf("onenessJourney.progress.buyer.2026-11-09") === 0);
  return A.create({
    config: { enabled: true, apiBase: "https://journey-api.example.test", localDemo: true, testSecret: "secret-secret-secret" },
    progress: P,
    fetch: function () { fetches += 1; return Promise.reject(new Error("no")); }
  }).signInLocal("member-a");
}).then(function (blocked) {
  assert.strictEqual(blocked.status, 404);
  assert.strictEqual(fetches, 0);
  return A.create({
    config: { enabled: true, apiBase: "http://127.0.0.1:9", localDemo: true, testSecret: "secret-secret-secret" },
    progress: P,
    fetch: function () { return Promise.reject(new Error("down")); }
  }).save("buyer", COHORT, P.emptyRecord("buyer", COHORT));
}).then(function (failed) {
  assert.strictEqual(failed.ok, false);
  assert.strictEqual(failed.synced, false);
  assert.notStrictEqual(A.fieldStatus("kept", "kept", "saved"), failed.synced ? A.ACCOUNT_SAVED : A.DEVICE_SAVED);
  assert.strictEqual(failed.synced ? A.ACCOUNT_SAVED : A.ACCOUNT_ERROR, A.ACCOUNT_ERROR);

  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, "journey/auth-config.js"), "utf8"), context);
  const shipped = context.window.ONENESS_JOURNEY_AUTH;
  assert.strictEqual(shipped.enabled, false);
  assert.strictEqual(shipped.apiBase, "");
  assert.strictEqual(shipped.localDemo, undefined);
  assert.strictEqual(shipped.testSecret, undefined);
  assert.strictEqual(A.authEnabled(shipped), false);

  const page = fs.readFileSync(path.join(root, "journey/index.html"), "utf8");
  const config = fs.readFileSync(path.join(root, "journey/config.js"), "utf8");
  const journey = fs.readFileSync(path.join(root, "journey/journey.js"), "utf8");
  const account = fs.readFileSync(path.join(root, "journey/account.js"), "utf8");
  const api = fs.readFileSync(path.join(root, "journey/member-api.js"), "utf8");
  const vip = "https://membership.onenesswellnesslifestyles.com/courses/products/429f9e94-85fa-407a-bfc0-92ad92bc3bf0";
  assert.ok(page.includes(vip));
  assert.ok(page.includes('id="course-link"'));
  assert.ok(page.includes("auth-config.js"));
  assert.ok(page.includes("account.js"));
  assert.ok(!page.includes("member-api.js"));
  assert.ok(!page.includes("signin-email"));
  assert.ok(!page.toLowerCase().includes("magic link"));
  assert.ok(page.includes("not saved to an account"));
  assert.ok(config.includes(vip));
  assert.ok(config.includes('startDate: "2026-11-09"'));
  assert.ok(journey.includes("window.OnenessJourneySync"));
  assert.ok(journey.includes("recordForViewer"));
  assert.ok(!journey.includes("testSecret"));
  assert.ok(!account.includes("service_role"));
  assert.ok(!api.includes("service_role"));
  assert.ok(!page.includes("JOURNEY_OIDC_CLIENT_SECRET"));
  assert.ok(!fs.readFileSync(path.join(root, "journey/auth-config.js"), "utf8").includes("http"));
  console.log("journey/account.test.js ok");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
