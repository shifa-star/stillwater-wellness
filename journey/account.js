/* Oneness Journey account policy.
   Decides what a browser may show and save. It does not decide who owns a row;
   the member API does that. Device notes are never copied into an account. */
(function (root) {
  "use strict";

  var DEVICE_SAVED = "Saved on this device.";
  var ACCOUNT_SAVED = "Saved to your account.";
  var ACCOUNT_SAVING = "Saving to your account\u2026";
  var NOT_SAVED = "Not saved yet.";
  var DEVICE_LINE = "Your marks and words stay on this device.";
  var ACCOUNT_LINE = "Saved with your account for this cohort and lane. Notes left on this device earlier are not part of your account.";
  var SIGNED_OUT_LINE = "You are not signed in. Marks stay on this device and are not saved to an account.";
  var UNREACHABLE_LINE = "Could not reach your account. Notes on this device stay hidden so they are not mixed in.";
  var DEVICE_NOTE = "Notes already on this device were not copied into your account.";
  var ACCOUNT_ERROR = "Not saved to your account.";
  var CONFLICT_MESSAGE = "This account was updated somewhere else. Showing the saved copy.";
  var ADOPT_DEVICE_REFLECTIONS = false;

  function authEnabled(config) {
    if (!config || config.enabled !== true) return false;
    var base = typeof config.apiBase === "string" ? config.apiBase.trim().replace(/\/+$/, "") : "";
    if (!base || /\s/.test(base)) return false;
    if (/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)) return true;
    if (/^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/i.test(base)) return true;
    return false;
  }

  function apiBase(config) {
    if (!authEnabled(config)) return "";
    return String(config.apiBase).trim().replace(/\/+$/, "");
  }

  function localDemoAllowed(config) {
    if (!config || config.localDemo !== true) return false;
    if (!authEnabled(config)) return false;
    return /^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/i.test(apiBase(config));
  }

  function authStartUrl(config) {
    var base = apiBase(config);
    return base ? base + "/auth/start" : "";
  }

  function deviceHasUnattributedText(rec) {
    if (!rec || typeof rec !== "object") return false;
    if (typeof rec.journeyFeedback === "string" && rec.journeyFeedback.trim().length > 0) return true;
    var days = rec.days && typeof rec.days === "object" ? rec.days : {};
    var keys = Object.keys(days);
    for (var i = 0; i < keys.length; i += 1) {
      var day = days[keys[i]];
      if (day && typeof day.reflection === "string" && day.reflection.trim().length > 0) return true;
    }
    return false;
  }

  function recordForViewer(input) {
    input = input || {};
    if (input.mode === "account" || input.mode === "changed") {
      return { record: input.serverRecord, source: "account", showDevice: false };
    }
    if (input.mode === "unreachable" || input.suppressDevice === true) {
      return { record: input.emptyRecord, source: "hidden", showDevice: false };
    }
    return { record: input.deviceRecord, source: "device", showDevice: true };
  }

  function fieldStatus(value, stored, phase) {
    var text = typeof value === "string" ? value : "";
    var kept = typeof stored === "string" ? stored : "";
    if (phase === "loading") return "Opening your account\u2026";
    if (phase === "saving") return ACCOUNT_SAVING;
    if (text !== kept) return NOT_SAVED;
    if (kept.trim().length === 0) return "";
    if (phase === "saved") return ACCOUNT_SAVED;
    return DEVICE_SAVED;
  }

  function persistenceLine(state) {
    state = state || {};
    if (state.enabled !== true) return DEVICE_LINE;
    if (state.mode === "unreachable" || state.mode === "account-unavailable") return UNREACHABLE_LINE;
    if (state.mode === "account" || state.mode === "changed") return ACCOUNT_LINE;
    return SIGNED_OUT_LINE;
  }

  function displayEmail(email) {
    if (typeof email !== "string") return "";
    var trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.length > 254) return "";
    return trimmed;
  }

  function panelModel(state) {
    state = state || {};
    if (state.enabled !== true || !authEnabled(state)) {
      return { kind: "device-only" };
    }
    if (state.mode === "account" || state.mode === "changed") {
      var email = displayEmail(state.email);
      var note = state.deviceNote === true ? DEVICE_NOTE : "";
      if (localDemoAllowed(state)) {
        note = note ? "Local test only. This is not the live site. " + note : "Local test only. This is not the live site.";
      }
      if (state.confirmError === true) {
        note = (note ? note + " " : "") + "Could not confirm your account just now. This page is still showing the last progress loaded for this sign-in.";
      }
      if (state.signOutFailed === true) {
        note = (note ? note + " " : "") + "Sign-out did not finish. This browser is still signed in.";
      }
      return {
        kind: "signed-in",
        kicker: localDemoAllowed(state) ? "Local test" : "Your account",
        title: email ? email : "Signed in",
        copy: "Progress for this cohort and lane is stored with your account.",
        note: note
      };
    }
    if (state.mode === "unreachable") {
      return {
        kind: "unreachable",
        kicker: "Account",
        title: "Could not open your account",
        copy: UNREACHABLE_LINE,
        note: ""
      };
    }
    if (localDemoAllowed(state)) {
      return {
        kind: "local-demo",
        kicker: "Local test",
        title: "Local test members",
        copy: "Local test only. No email is sent. Notes already on this device are not copied into a test account.",
        note: state.localError === true ? "Local sign-in did not complete." : "This is not the live site.",
        buttonLabel: function (name) {
          return name === "member-b" ? "Local test member B" : "Local test member A";
        }
      };
    }
    var start = authStartUrl(state);
    return {
      kind: "signed-out",
      kicker: "Account",
      title: "Sign in to your journey",
      copy: "Sign in to keep this cohort's progress with your account. Notes already on this device are not copied into the account.",
      note: start ? "VIP Membership links stay open either way." : "Sign-in is not available from this page yet.",
      signInUrl: start
    };
  }

  function draftScope(signedIn, sessionTag) {
    if (signedIn === true && typeof sessionTag === "string" && sessionTag) return "account:" + sessionTag;
    return "device";
  }

  function revisionOf(rec) {
    var n = rec && rec.serverRevision;
    if (typeof n !== "number" || n < 0 || n !== Math.floor(n) || n === Infinity) return 0;
    return n;
  }

  function create(opts) {
    opts = opts || {};
    var config = opts.config || {};
    var progress = opts.progress;
    var fetchImpl = opts.fetch;
    var enabled = authEnabled(config);
    var session = null;

    function request(method, path, body, extraHeaders) {
      if (!enabled || typeof fetchImpl !== "function") {
        return Promise.resolve({ ok: false, status: 0, body: {} });
      }
      var headers = { accept: "application/json" };
      if (extraHeaders) {
        Object.keys(extraHeaders).forEach(function (key) { headers[key] = extraHeaders[key]; });
      }
      var init = { method: method, credentials: "include", headers: headers };
      if (body != null) {
        headers["content-type"] = "application/json";
        headers["x-journey-request"] = "1";
        init.body = JSON.stringify(body);
      } else if (method !== "GET" && method !== "HEAD") {
        headers["content-type"] = "application/json";
        headers["x-journey-request"] = "1";
        init.body = "{}";
      }
      var pending;
      try {
        pending = fetchImpl(apiBase(config) + path, init);
      } catch (e) {
        return Promise.resolve({ ok: false, status: 0, body: {} });
      }
      return Promise.resolve(pending).then(function (res) {
        if (!res) return { ok: false, status: 0, body: {} };
        return Promise.resolve(res.text()).then(function (text) {
          var parsed = {};
          if (text) {
            try { parsed = JSON.parse(text); } catch (e) { parsed = {}; }
          }
          return { ok: res.ok === true, status: res.status, body: parsed && typeof parsed === "object" ? parsed : {} };
        });
      }, function () {
        return { ok: false, status: 0, body: {} };
      });
    }

    function applyMe(me) {
      if (!me || !me.ok || !me.body || typeof me.body.sessionTag !== "string" || !me.body.sessionTag) {
        return null;
      }
      return { tag: me.body.sessionTag, email: displayEmail(me.body.email) };
    }

    return {
      enabled: enabled,
      signedIn: function () { return !!(session && session.tag); },
      email: function () { return session ? session.email : ""; },
      sessionTag: function () { return session ? session.tag : ""; },
      boot: function () {
        if (!enabled) return Promise.resolve({ mode: "off", signedIn: false });
        return request("GET", "/me").then(function (me) {
          if (me.status === 401 || (me.body && me.body.signedIn === false)) {
            session = null;
            return { mode: "signedOut", signedIn: false };
          }
          var next = applyMe(me);
          if (!next) {
            session = null;
            return { mode: "unreachable", signedIn: false };
          }
          session = next;
          return { mode: "account", signedIn: true };
        });
      },
      refreshIdentity: function () {
        if (!enabled || !session) return Promise.resolve({ mode: session ? "account" : "signedOut", changed: false });
        var previous = session.tag;
        return request("GET", "/me").then(function (me) {
          if (me.status === 401 || (me.body && me.body.signedIn === false)) {
            session = null;
            return { mode: "signedOut", signedOut: true, changed: true };
          }
          var next = applyMe(me);
          if (!next) return { mode: "unreachable", unreachable: true, changed: false };
          session = next;
          if (next.tag !== previous) return { mode: "changed", changed: true, email: next.email };
          return { mode: "same", changed: false, email: next.email };
        });
      },
      load: function (lane, cohort, deviceRecord) {
        if (!session) {
          return Promise.resolve({
            record: deviceRecord,
            source: "device",
            deviceNote: false,
            imported: ADOPT_DEVICE_REFLECTIONS,
            error: false
          });
        }
        var note = deviceHasUnattributedText(deviceRecord);
        var query = "/progress?cohort=" + encodeURIComponent(cohort) + "&lane=" + encodeURIComponent(lane);
        return request("GET", query).then(function (res) {
          if (!res.ok || !res.body) {
            var empty = progress.emptyRecord(lane, cohort);
            return { record: empty, source: "account-unavailable", deviceNote: false, imported: false, error: true };
          }
          var record = progress.parseRecord(res.body.record, lane, cohort);
          if (typeof res.body.revision === "number") record.serverRevision = res.body.revision;
          return { record: record, source: "account", deviceNote: note, imported: false, error: false };
        });
      },
      save: function (lane, cohort, next) {
        if (!session) {
          return Promise.resolve({ ok: false, synced: false, status: 401, conflict: false, record: null });
        }
        return request("PUT", "/progress", {
          cohortStart: cohort,
          lane: lane,
          ifRevision: revisionOf(next),
          record: next
        }).then(function (res) {
          if (res.status === 409 && res.body && res.body.record) {
            var current = progress.parseRecord(res.body.record, lane, cohort);
            if (typeof res.body.revision === "number") current.serverRevision = res.body.revision;
            return { ok: false, synced: false, status: 409, conflict: true, record: current };
          }
          if (!res.ok || !res.body || !res.body.record) {
            return { ok: false, synced: false, status: res.status || 0, conflict: false, record: null };
          }
          var saved = progress.parseRecord(res.body.record, lane, cohort);
          if (typeof res.body.revision === "number") saved.serverRevision = res.body.revision;
          return { ok: true, synced: true, status: res.status, conflict: false, record: saved };
        });
      },
      signInLocal: function (name) {
        if (!localDemoAllowed(config)) return Promise.resolve({ ok: false, status: 404 });
        if (name !== "member-a" && name !== "member-b") return Promise.resolve({ ok: false, status: 400 });
        return request("POST", "/auth/test-session", { account: name }, {
          "x-journey-test-secret": String(config.testSecret || "")
        }).then(function (res) {
          return { ok: res.ok, status: res.status };
        });
      },
      logout: function () {
        if (!enabled) {
          session = null;
          return Promise.resolve({ ok: true });
        }
        return request("POST", "/auth/logout").then(function (res) {
          if (res.ok || res.status === 401) {
            session = null;
            return { ok: true };
          }
          return { ok: false, status: res.status };
        });
      }
    };
  }

  var api = {
    ADOPT_DEVICE_REFLECTIONS: ADOPT_DEVICE_REFLECTIONS,
    DEVICE_SAVED: DEVICE_SAVED,
    ACCOUNT_SAVED: ACCOUNT_SAVED,
    ACCOUNT_SAVING: ACCOUNT_SAVING,
    NOT_SAVED: NOT_SAVED,
    DEVICE_LINE: DEVICE_LINE,
    ACCOUNT_LINE: ACCOUNT_LINE,
    SIGNED_OUT_LINE: SIGNED_OUT_LINE,
    UNREACHABLE_LINE: UNREACHABLE_LINE,
    DEVICE_NOTE: DEVICE_NOTE,
    ACCOUNT_ERROR: ACCOUNT_ERROR,
    CONFLICT_MESSAGE: CONFLICT_MESSAGE,
    authEnabled: authEnabled,
    apiBase: apiBase,
    localDemoAllowed: localDemoAllowed,
    authStartUrl: authStartUrl,
    deviceHasUnattributedText: deviceHasUnattributedText,
    recordForViewer: recordForViewer,
    fieldStatus: fieldStatus,
    persistenceLine: persistenceLine,
    displayEmail: displayEmail,
    panelModel: panelModel,
    draftScope: draftScope,
    revisionOf: revisionOf,
    create: create
  };

  root.OnenessJourneyAccount = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
