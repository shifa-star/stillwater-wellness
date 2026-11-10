const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const A = require("./account.js");
const P = require("./progress.js");

const root = path.join(__dirname, "..");
const COHORT = "2026-11-09";
const URL = "https://hwytpirbouqdssfncnrl.supabase.co";
const KEY = "sb_publishable_example_key_value_123456";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function ready(extra) {
  return Object.assign({
    enabled: true,
    supabaseUrl: URL,
    supabaseAnonKey: KEY
  }, extra || {});
}

function sessionFor(id, email) {
  return { user: { id: id, email: email } };
}

function fakeSupabase(state) {
  return {
    auth: {
      getSession: function () {
        return Promise.resolve({ data: { session: state.session }, error: state.sessionError || null });
      },
      signInWithOtp: function (args) {
        state.otp = args;
        return Promise.resolve({ data: {}, error: state.otpError || null });
      },
      signOut: function () {
        state.session = null;
        state.signedOut = true;
        return Promise.resolve({ error: null });
      },
      onAuthStateChange: function () {
        return { data: { subscription: { unsubscribe: function () {} } } };
      }
    },
    from: function (table) {
      if (table === "enrollments") {
        return {
          select: function () {
            return {
              eq: function () {
                return {
                  eq: function () {
                    var rows = state.enrolled ? [{ user_id: state.session.user.id, active: true }] : [];
                    return Promise.resolve({ data: rows, error: null });
                  }
                };
              }
            };
          }
        };
      }
      return {
        select: function () {
          return {
            eq: function (_col, id) {
              return {
                like: function (_key, pattern) {
                  var prefix = pattern.replace(/%$/, "");
                  var rows = state.rows.filter(function (row) {
                    return row.user_id === id && row.key.indexOf(prefix) === 0;
                  });
                  if (state.leak) rows = rows.concat(state.leak);
                  return Promise.resolve({ data: rows, error: null });
                }
              };
            }
          };
        },
        upsert: function (payload) {
          state.upserts.push(payload);
          if (state.failWrite) {
            return { select: function () { return Promise.resolve({ data: null, error: { status: 401, message: "denied" } }); } };
          }
          payload.forEach(function (row) {
            var existing = state.rows.find(function (item) { return item.user_id === row.user_id && item.key === row.key; });
            var stored = {
              user_id: row.user_id,
              key: row.key,
              completed: row.completed === true,
              notes: row.notes,
              updated_at: "2026-11-09T18:00:00.000Z"
            };
            if (existing) Object.assign(existing, stored);
            else state.rows.push(stored);
          });
          return { select: function () { return Promise.resolve({ data: state.rows.slice(), error: null }); } };
        }
      };
    }
  };
}

assert.strictEqual(A.ADOPT_DEVICE_REFLECTIONS, false);
assert.strictEqual(A.SUPABASE_JS_URL, "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm");
assert.strictEqual(A.authEnabled({ enabled: false, supabaseUrl: URL, supabaseAnonKey: KEY }), false);
assert.strictEqual(A.authEnabled({ enabled: true, supabaseUrl: URL, supabaseAnonKey: A.PLACEHOLDER_KEY }), false);
assert.strictEqual(A.authEnabled({ enabled: true, supabaseUrl: "javascript:alert(1)", supabaseAnonKey: KEY }), false);
assert.strictEqual(A.authEnabled({ enabled: true, supabaseUrl: "http://hwytpirbouqdssfncnrl.supabase.co", supabaseAnonKey: KEY }), false);
assert.strictEqual(A.authEnabled({ enabled: true, supabaseUrl: URL, supabaseAnonKey: "service_role_secret_should_not_pass" }), false);
assert.strictEqual(A.authEnabled(ready()), true);

const device = P.setReflection(P.emptyRecord("buyer", COHORT), 1, "  unattributed dawn note  ");
assert.strictEqual(A.deviceHasUnattributedText(device), true);
assert.strictEqual(A.deviceHasUnattributedText(P.emptyRecord("buyer", COHORT)), false);

const viewed = A.recordForViewer({
  mode: "account",
  serverRecord: P.emptyRecord("buyer", COHORT),
  deviceRecord: device,
  emptyRecord: P.emptyRecord("buyer", COHORT)
});
assert.strictEqual(viewed.showDevice, false);
assert.ok(!JSON.stringify(viewed.record).includes("unattributed"));
assert.strictEqual(A.recordForViewer({
  mode: "unreachable",
  deviceRecord: device,
  emptyRecord: P.emptyRecord("buyer", COHORT)
}).showDevice, false);
assert.strictEqual(A.recordForViewer({
  mode: "signedOut",
  deviceRecord: device,
  serverRecord: P.setReflection(P.emptyRecord("buyer", COHORT), 1, "account words"),
  emptyRecord: P.emptyRecord("buyer", COHORT)
}).record.days["1"].reflection, "  unattributed dawn note  ");

assert.strictEqual(A.fieldStatus("hello", "hello", "device"), A.DEVICE_SAVED);
assert.strictEqual(A.fieldStatus("hello", "hello", "saved"), A.ACCOUNT_SAVED);
assert.strictEqual(A.fieldStatus("hello", "hello", "saving"), A.ACCOUNT_SAVING);
assert.strictEqual(A.persistenceLine({ enabled: false, mode: "account" }), A.DEVICE_LINE);
assert.strictEqual(A.persistenceLine({ enabled: true, mode: "account" }), A.ACCOUNT_LINE);
assert.strictEqual(A.persistenceLine({ enabled: true, mode: "enrollment" }), A.ENROLLMENT_LINE);
assert.strictEqual(A.panelModel({ enabled: false, supabaseUrl: URL, supabaseAnonKey: KEY }).kind, "device-only");
assert.strictEqual(A.panelModel(ready({ mode: "signedOut" })).kind, "signed-out");
assert.ok(!JSON.stringify(A.panelModel(ready({ mode: "signedOut" }))).toLowerCase().includes("magic link"));
assert.strictEqual(A.panelModel(ready({ mode: "linkSent" })).kind, "link-sent");
const signedPanel = A.panelModel(ready({ mode: "account", email: "member@journey.test", deviceNote: true }));
assert.strictEqual(signedPanel.kind, "signed-in");
assert.ok(signedPanel.note.includes(A.DEVICE_NOTE));
assert.strictEqual(A.draftScope(false, USER_A), "device");
assert.notStrictEqual(A.draftScope(true, USER_A), A.draftScope(true, USER_B));

const rows = A.rowsFromRecord(USER_A, P.setReflection(P.setJourneyFeedback(P.emptyRecord("buyer", COHORT), "felt like home"), 1, "account reflection A"));
assert.ok(rows.every(function (row) { return row.user_id === USER_A; }));
assert.ok(rows.some(function (row) { return row.key === "2026-11-09/buyer/day/1/reflection" && row.notes === "account reflection A"; }));
assert.ok(!JSON.stringify(rows).includes("unattributed"));
assert.ok(!rows.some(function (row) { return row.key.indexOf("/advocate/") !== -1; }));

const rebuilt = A.recordFromRows(P, "buyer", COHORT, USER_A, [
  { user_id: USER_A, key: "2026-11-09/buyer/day/1/reflection", completed: true, notes: "account reflection A", updated_at: "2026-11-09T18:00:00.000Z" },
  { user_id: USER_B, key: "2026-11-09/buyer/day/1/reflection", completed: true, notes: "member B private", updated_at: "2026-11-09T18:00:00.000Z" },
  { user_id: USER_A, key: "2026-11-09/advocate/day/1/reflection", completed: true, notes: "advocate note", updated_at: "2026-11-09T18:00:00.000Z" }
]);
assert.strictEqual(rebuilt.days["1"].reflection, "account reflection A");
assert.ok(!JSON.stringify(rebuilt).includes("member B private"));
assert.ok(!JSON.stringify(rebuilt).includes("advocate note"));

let imports = 0;
const disabled = A.create({
  config: { enabled: false, supabaseUrl: URL, supabaseAnonKey: KEY },
  progress: P,
  importSupabase: function () { imports += 1; return Promise.reject(new Error("cdn")); }
});

disabled.boot().then(function (result) {
  assert.strictEqual(result.mode, "off");
  assert.strictEqual(imports, 0);
  const state = {
    session: sessionFor(USER_A, "member-a@journey.test"),
    enrolled: true,
    rows: [],
    upserts: [],
    leak: [{ user_id: USER_B, key: "2026-11-09/buyer/day/1/reflection", completed: true, notes: "member B private", updated_at: "2026-11-09T19:00:00.000Z" }]
  };
  const account = A.create({
    config: ready(),
    progress: P,
    supabase: fakeSupabase(state),
    redirectTo: "https://app.onenesswellnesslifestyles.com/journey/"
  });
  return account.signInWithEmail(" Member-A@Journey.Test ").then(function (sent) {
    assert.strictEqual(sent.sent, true);
    assert.strictEqual(state.otp.options.shouldCreateUser, false);
    assert.strictEqual(state.otp.options.emailRedirectTo, "https://app.onenesswellnesslifestyles.com/journey/");
    assert.strictEqual(state.otp.email, "member-a@journey.test");
    return account.boot();
  }).then(function (boot) {
    assert.strictEqual(boot.mode, "account");
    const deviceRecord = P.setReflection(P.emptyRecord("buyer", COHORT), 1, "unattributed device reflection");
    return account.load("buyer", COHORT, deviceRecord).then(function (loaded) {
      assert.strictEqual(loaded.imported, false);
      assert.strictEqual(loaded.deviceNote, true);
      assert.strictEqual(loaded.record.days["1"], undefined);
      assert.ok(!JSON.stringify(loaded.record).includes("member B private"));
      const next = P.setReflection(loaded.record, 1, "account reflection A");
      next.journeyFeedback = "felt like home";
      return account.save("buyer", COHORT, next).then(function (saved) {
        assert.strictEqual(saved.synced, true);
        assert.strictEqual(saved.record.days["1"].reflection, "account reflection A");
        assert.strictEqual(saved.record.journeyFeedback, "felt like home");
        assert.ok(state.upserts.length === 1);
        assert.ok(state.upserts[0].every(function (row) { return row.user_id === USER_A; }));
        assert.ok(!JSON.stringify(state.upserts).includes("unattributed"));
        assert.ok(!JSON.stringify(state.upserts).includes("member B private"));
        return account.load("advocate", COHORT, P.emptyRecord("advocate", COHORT));
      });
    });
  }).then(function (advocate) {
    assert.deepStrictEqual(advocate.record.days, {});
    state.rows.push({
      user_id: USER_A,
      key: "2026-11-09/buyer/day/1/reflection",
      completed: true,
      notes: "newer from another tab",
      updated_at: "2026-11-09T20:00:00.000Z"
    });
    const stale = P.setReflection(P.emptyRecord("buyer", COHORT), 1, "stale edit");
    stale.progressUpdatedAt = "2026-11-09T18:00:00.000Z";
    const before = state.upserts.length;
    return account.save("buyer", COHORT, stale).then(function (conflict) {
      assert.strictEqual(conflict.conflict, true);
      assert.strictEqual(conflict.synced, false);
      assert.strictEqual(conflict.record.days["1"].reflection, "newer from another tab");
      assert.strictEqual(state.upserts.length, before);
      state.enrolled = false;
      return account.load("buyer", COHORT, device);
    });
  }).then(function (blocked) {
    assert.strictEqual(blocked.reason, "enrollment");
    assert.strictEqual(blocked.error, true);
    assert.ok(!JSON.stringify(blocked.record).includes("unattributed"));
    state.enrolled = true;
    return account.logout();
  }).then(function (out) {
    assert.strictEqual(out.ok, true);
    assert.strictEqual(account.signedIn(), false);
    const deviceRecord = P.setReflection(P.emptyRecord("buyer", COHORT), 1, "unattributed device reflection");
    return account.load("buyer", COHORT, deviceRecord);
  }).then(function (returned) {
    assert.strictEqual(returned.source, "device");
    assert.strictEqual(returned.record.days["1"].reflection, "unattributed device reflection");
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, "journey/auth-config.js"), "utf8"), context);
    const shipped = context.window.ONENESS_JOURNEY_AUTH;
    assert.strictEqual(shipped.enabled, true);
    assert.strictEqual(shipped.supabaseUrl, URL);
    assert.notStrictEqual(shipped.supabaseAnonKey, A.PLACEHOLDER_KEY);
    assert.ok(shipped.supabaseAnonKey.length >= 20);
    assert.ok(!/service_role/i.test(shipped.supabaseAnonKey));
    assert.strictEqual(A.authEnabled(shipped), true);

    const page = fs.readFileSync(path.join(root, "journey/index.html"), "utf8");
    const config = fs.readFileSync(path.join(root, "journey/config.js"), "utf8");
    const journey = fs.readFileSync(path.join(root, "journey/journey.js"), "utf8");
    const account = fs.readFileSync(path.join(root, "journey/account.js"), "utf8");
    const sql = fs.readFileSync(path.join(root, "supabase/migrations/20261109032500_journey_member_progress.sql"), "utf8");
    const vip = "https://membership.onenesswellnesslifestyles.com/courses/products/429f9e94-85fa-407a-bfc0-92ad92bc3bf0";
    assert.ok(page.includes(vip));
    assert.ok(page.includes("auth-config.js"));
    assert.ok(!page.includes("member-api.js"));
    assert.ok(!page.toLowerCase().includes("magic link"));
    assert.ok(page.includes("not saved to an account"));
    assert.ok(config.includes(vip));
    assert.ok(journey.includes("redirectTo: window.location.origin"));
    assert.ok(journey.includes("recordForViewer"));
    assert.ok(journey.includes("signInWithEmail"));
    assert.ok(!journey.includes("testSecret"));
    assert.ok(account.includes("shouldCreateUser: false"));
    assert.ok(account.includes(A.SUPABASE_JS_URL));
    assert.ok(account.includes("/service_role/i"));
    assert.ok(!/sb_secret_[A-Za-z0-9]/.test(account));
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(account));
    assert.ok(!fs.existsSync(path.join(root, "journey/member-api.js")));
    assert.ok(!fs.existsSync(path.join(root, "journey/local-member-demo.js")));
    assert.ok(sql.includes("is_enrolled"));
    assert.ok(sql.includes("security definer"));
    assert.ok(sql.includes("set search_path = public"));
    assert.ok(sql.includes("revoke all on table public.journey_progress from public, anon, authenticated"));
    assert.ok(sql.includes("primary key (user_id, key)"));
    assert.ok(!/service_role|postgres:\/\//i.test(sql));
    assert.ok(!/service_role/i.test(shipped.supabaseAnonKey));
    console.log("journey/account.test.js ok");
  });
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
