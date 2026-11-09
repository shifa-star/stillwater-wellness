/* Oneness Journey account policy and Supabase client.
   The browser does not decide who owns a row. Supabase Auth and row security do.
   Device notes are never copied into an account.
   supabase-js is loaded from a pinned CDN build only after sign-in is enabled
   and the publishable key is filled in. */
(function (root) {
  "use strict";

  var SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm";
  var PLACEHOLDER_KEY = "YOUR_SUPABASE_ANON_KEY";
  var DEVICE_SAVED = "Saved on this device.";
  var ACCOUNT_SAVED = "Saved to your account.";
  var ACCOUNT_SAVING = "Saving to your account\u2026";
  var NOT_SAVED = "Not saved yet.";
  var DEVICE_LINE = "Your marks and words stay on this device.";
  var ACCOUNT_LINE = "Saved with your account for this cohort and lane. Notes left on this device earlier are not part of your account.";
  var SIGNED_OUT_LINE = "You are not signed in. Marks stay on this device and are not saved to an account.";
  var UNREACHABLE_LINE = "Could not reach your account. Notes on this device stay hidden so they are not mixed in.";
  var ENROLLMENT_LINE = "This sign-in is not on the active enrollment list. Progress stays closed, and device notes are not copied in.";
  var DEVICE_NOTE = "Notes already on this device were not copied into your account.";
  var ACCOUNT_ERROR = "Not saved to your account.";
  var CONFLICT_MESSAGE = "This account was updated somewhere else. Showing the saved copy.";
  var ADOPT_DEVICE_REFLECTIONS = false;
  var STEP_MARKS = ["video", "workbook", "evening"];

  function projectUrl(config) {
    var url = config && typeof config.supabaseUrl === "string" ? config.supabaseUrl.trim().replace(/\/+$/, "") : "";
    return /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url) ? url : "";
  }

  function keyReady(key) {
    if (typeof key !== "string") return false;
    var trimmed = key.trim();
    if (!trimmed || trimmed === PLACEHOLDER_KEY) return false;
    if (/service_role/i.test(trimmed) || /\s/.test(trimmed)) return false;
    return trimmed.length >= 20;
  }

  function authEnabled(config) {
    if (!config || config.enabled !== true) return false;
    return !!(projectUrl(config) && keyReady(config.supabaseAnonKey));
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
    if (input.mode === "account" || input.mode === "changed" || input.mode === "enrollment") {
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
    if (state.mode === "enrollment") return ENROLLMENT_LINE;
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
    if (state.mode === "account" || state.mode === "changed" || state.mode === "enrollment") {
      var email = displayEmail(state.email);
      var note = state.mode === "enrollment" ? ENROLLMENT_LINE : (state.deviceNote === true ? DEVICE_NOTE : "");
      if (state.confirmError === true) {
        note = (note ? note + " " : "") + "Could not confirm your account just now. This page is still showing the last progress loaded for this sign-in.";
      }
      if (state.signOutFailed === true) {
        note = (note ? note + " " : "") + "Sign-out did not finish. This browser is still signed in.";
      }
      return {
        kind: "signed-in",
        kicker: "Your account",
        title: email ? email : "Signed in",
        copy: state.mode === "enrollment"
          ? "Progress stays closed until this email has an active enrollment."
          : "Progress for this cohort and lane is stored with your account.",
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
    if (state.mode === "linkSent") {
      return {
        kind: "link-sent",
        kicker: "Account",
        title: "Check your email",
        copy: "A sign-in link is on its way. It opens this journey for a member who is already enrolled. It does not create a new account.",
        note: "Notes already on this device stay here and are not copied into the account."
      };
    }
    return {
      kind: "signed-out",
      kicker: "Account",
      title: "Sign in to your journey",
      copy: "Use the email for your enrollment. Notes already on this device are not copied into the account.",
      note: state.signInError === true
        ? "That sign-in did not complete. Only an enrolled member email can receive a link."
        : "VIP Membership links stay open either way."
    };
  }

  function draftScope(signedIn, sessionTag) {
    if (signedIn === true && typeof sessionTag === "string" && sessionTag) return "account:" + sessionTag;
    return "device";
  }

  function partitionPrefix(cohort, lane) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cohort || ""))) return "";
    if (lane !== "buyer" && lane !== "advocate") return "";
    return cohort + "/" + lane + "/";
  }

  function stampOf(rows) {
    var latest = 0;
    var iso = null;
    (rows || []).forEach(function (row) {
      var time = Date.parse(row && row.updated_at);
      if (time && time >= latest) {
        latest = time;
        iso = row.updated_at;
      }
    });
    return iso;
  }

  function rowsForUser(rows, userId) {
    return (rows || []).filter(function (row) {
      return row && row.user_id === userId;
    });
  }

  function recordFromRows(progress, lane, cohort, userId, rows) {
    var rec = progress.emptyRecord(lane, cohort);
    var prefix = partitionPrefix(cohort, lane);
    rowsForUser(rows, userId).forEach(function (row) {
      if (row.key.indexOf(prefix) !== 0) return;
      var rest = row.key.slice(prefix.length);
      var dayMatch = /^day\/([1-9]\d*)\/(video|workbook|evening|reflection)$/.exec(rest);
      if (dayMatch) {
        var day = rec.days[dayMatch[1]] || { video: false, workbook: false, evening: false, reflection: "" };
        if (dayMatch[2] === "reflection") day.reflection = typeof row.notes === "string" ? row.notes : "";
        else day[dayMatch[2]] = row.completed === true;
        rec.days[dayMatch[1]] = day;
        return;
      }
      if (rest === "feedback") rec.journeyFeedback = typeof row.notes === "string" ? row.notes : "";
      if (rest === "sitting") rec.sittingOpened = row.completed === true;
    });
    rec.progressUpdatedAt = stampOf(rowsForUser(rows, userId).filter(function (row) {
      return row.key.indexOf(prefix) === 0;
    }));
    return progress.parseRecord(rec, lane, cohort);
  }

  function rowsFromRecord(userId, rec) {
    var prefix = partitionPrefix(rec && rec.cohortStart, rec && rec.lane);
    if (!prefix || !userId) return [];
    var rows = [];
    var days = rec.days && typeof rec.days === "object" ? rec.days : {};
    Object.keys(days).forEach(function (n) {
      if (!/^[1-9]\d*$/.test(n)) return;
      var day = days[n] || {};
      STEP_MARKS.forEach(function (step) {
        rows.push({
          user_id: userId,
          key: prefix + "day/" + n + "/" + step,
          completed: day[step] === true,
          notes: null
        });
      });
      rows.push({
        user_id: userId,
        key: prefix + "day/" + n + "/reflection",
        completed: typeof day.reflection === "string" && day.reflection.trim().length > 0,
        notes: typeof day.reflection === "string" ? day.reflection : ""
      });
    });
    var feedback = typeof rec.journeyFeedback === "string" ? rec.journeyFeedback : "";
    rows.push({
      user_id: userId,
      key: prefix + "feedback",
      completed: feedback.trim().length > 0,
      notes: feedback
    });
    rows.push({
      user_id: userId,
      key: prefix + "sitting",
      completed: rec.sittingOpened === true,
      notes: null
    });
    return rows;
  }

  function newerThan(rows, watermark) {
    if (!watermark) return false;
    var mark = Date.parse(watermark);
    if (!mark) return false;
    return (rows || []).some(function (row) {
      var time = Date.parse(row && row.updated_at);
      return !!time && time > mark;
    });
  }

  function create(opts) {
    opts = opts || {};
    var config = opts.config || {};
    var progress = opts.progress;
    var enabled = authEnabled(config);
    var session = null;
    var client = opts.supabase || null;
    var redirectTo = typeof opts.redirectTo === "string" && opts.redirectTo
      ? opts.redirectTo
      : "https://app.onenesswellnesslifestyles.com/journey/";

    function userId() {
      return session && session.userId ? session.userId : "";
    }

    function applySession(next) {
      if (!next || !next.user || typeof next.user.id !== "string" || !next.user.id) return null;
      return {
        tag: next.user.id,
        email: displayEmail(next.user.email),
        userId: next.user.id
      };
    }

    function ensureClient() {
      if (!enabled) return Promise.resolve(null);
      if (client) return Promise.resolve(client);
      var loader = opts.importSupabase || function (url) { return import(url); };
      return Promise.resolve(loader(SUPABASE_JS_URL)).then(function (mod) {
        var factory = mod && (mod.createClient || (mod.default && mod.default.createClient));
        if (typeof factory !== "function") throw new Error("supabase");
        client = factory(projectUrl(config), String(config.supabaseAnonKey).trim(), {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        return client;
      }, function () { return null; });
    }

    function readSession(sb) {
      return Promise.resolve(sb.auth.getSession()).then(function (res) {
        if (!res || res.error) return { error: true };
        return { session: res.data && res.data.session ? res.data.session : null };
      }, function () { return { error: true }; });
    }

    function selectPartition(sb, id, prefix) {
      return Promise.resolve(
        sb.from("journey_progress").select("user_id,key,completed,notes,updated_at").eq("user_id", id).like("key", prefix + "%")
      ).then(function (res) {
        if (!res || res.error) return { error: true, rows: [] };
        return { error: false, rows: rowsForUser(res.data, id) };
      }, function () { return { error: true, rows: [] }; });
    }

    function enrollmentActive(sb, id) {
      return Promise.resolve(
        sb.from("enrollments").select("user_id,active").eq("user_id", id).eq("active", true)
      ).then(function (res) {
        if (!res || res.error) return { error: true, active: false };
        var rows = rowsForUser(res.data, id);
        return { error: false, active: rows.some(function (row) { return row.active === true; }) };
      }, function () { return { error: true, active: false }; });
    }

    return {
      enabled: enabled,
      signedIn: function () { return !!userId(); },
      email: function () { return session ? session.email : ""; },
      sessionTag: function () { return session ? session.tag : ""; },
      boot: function () {
        if (!enabled) return Promise.resolve({ mode: "off", signedIn: false });
        return ensureClient().then(function (sb) {
          if (!sb) return { mode: "unreachable", signedIn: false };
          return readSession(sb).then(function (found) {
            if (found.error) {
              session = null;
              return { mode: "unreachable", signedIn: false };
            }
            var next = applySession(found.session);
            session = next;
            if (!next) return { mode: "signedOut", signedIn: false };
            return { mode: "account", signedIn: true };
          });
        });
      },
      refreshIdentity: function () {
        if (!enabled || !session) return Promise.resolve({ mode: session ? "account" : "signedOut", changed: false });
        var previous = session.tag;
        return ensureClient().then(function (sb) {
          if (!sb) return { mode: "unreachable", unreachable: true, changed: false };
          return readSession(sb).then(function (found) {
            if (found.error) return { mode: "unreachable", unreachable: true, changed: false };
            var next = applySession(found.session);
            if (!next) {
              session = null;
              return { mode: "signedOut", signedOut: true, changed: true };
            }
            session = next;
            if (next.tag !== previous) return { mode: "changed", changed: true, email: next.email };
            return { mode: "same", changed: false, email: next.email };
          });
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
        var prefix = partitionPrefix(cohort, lane);
        var id = userId();
        if (!prefix) {
          return Promise.resolve({
            record: progress.emptyRecord(lane, cohort),
            source: "account-unavailable",
            deviceNote: false,
            imported: false,
            error: true
          });
        }
        return ensureClient().then(function (sb) {
          if (!sb) {
            return {
              record: progress.emptyRecord(lane, cohort),
              source: "account-unavailable",
              deviceNote: false,
              imported: false,
              error: true
            };
          }
          return enrollmentActive(sb, id).then(function (gate) {
            if (gate.error || !gate.active) {
              return {
                record: progress.emptyRecord(lane, cohort),
                source: "account",
                deviceNote: false,
                imported: false,
                error: true,
                reason: gate.error ? "unreachable" : "enrollment"
              };
            }
            return selectPartition(sb, id, prefix).then(function (selected) {
              if (selected.error) {
                return {
                  record: progress.emptyRecord(lane, cohort),
                  source: "account-unavailable",
                  deviceNote: false,
                  imported: false,
                  error: true
                };
              }
              return {
                record: recordFromRows(progress, lane, cohort, id, selected.rows),
                source: "account",
                deviceNote: deviceHasUnattributedText(deviceRecord),
                imported: false,
                error: false
              };
            });
          });
        });
      },
      save: function (lane, cohort, next) {
        if (!session) return Promise.resolve({ ok: false, synced: false, status: 401, conflict: false, record: null });
        var prefix = partitionPrefix(cohort, lane);
        var id = userId();
        if (!prefix || !next || next.lane !== lane || next.cohortStart !== cohort) {
          return Promise.resolve({ ok: false, synced: false, status: 400, conflict: false, record: null });
        }
        return ensureClient().then(function (sb) {
          if (!sb) return { ok: false, synced: false, status: 0, conflict: false, record: null };
          return selectPartition(sb, id, prefix).then(function (selected) {
            if (selected.error) return { ok: false, synced: false, status: 0, conflict: false, record: null };
            if (newerThan(selected.rows, next.progressUpdatedAt)) {
              return {
                ok: false,
                synced: false,
                status: 409,
                conflict: true,
                record: recordFromRows(progress, lane, cohort, id, selected.rows)
              };
            }
            var payload = rowsFromRecord(id, next);
            return Promise.resolve(
              sb.from("journey_progress").upsert(payload, { onConflict: "user_id,key" }).select("user_id,key,completed,notes,updated_at")
            ).then(function (res) {
              if (!res || res.error) return { ok: false, synced: false, status: (res && res.error && res.error.status) || 400, conflict: false, record: null };
              var savedRows = rowsForUser(res.data, id).filter(function (row) { return row.key.indexOf(prefix) === 0; });
              return {
                ok: true,
                synced: true,
                status: 200,
                conflict: false,
                record: recordFromRows(progress, lane, cohort, id, savedRows.length ? savedRows : payload)
              };
            }, function () {
              return { ok: false, synced: false, status: 0, conflict: false, record: null };
            });
          });
        });
      },
      signInWithEmail: function (email) {
        var clean = displayEmail(email);
        if (clean) clean = clean.toLowerCase();
        if (!enabled || !clean) return Promise.resolve({ ok: false, status: 400, sent: false });
        return ensureClient().then(function (sb) {
          if (!sb) return { ok: false, status: 0, sent: false };
          return Promise.resolve(sb.auth.signInWithOtp({
            email: clean,
            options: {
              emailRedirectTo: redirectTo,
              shouldCreateUser: false
            }
          })).then(function (res) {
            if (!res || res.error) return { ok: false, status: (res && res.error && res.error.status) || 400, sent: false };
            return { ok: true, status: 200, sent: true };
          }, function () {
            return { ok: false, status: 0, sent: false };
          });
        });
      },
      logout: function () {
        if (!enabled) {
          session = null;
          return Promise.resolve({ ok: true });
        }
        return ensureClient().then(function (sb) {
          if (!sb) {
            session = null;
            return { ok: false };
          }
          return Promise.resolve(sb.auth.signOut()).then(function (res) {
            if (res && res.error) return { ok: false, status: res.error.status || 500 };
            session = null;
            return { ok: true };
          }, function () {
            return { ok: false, status: 0 };
          });
        });
      }
    };
  }

  var api = {
    ADOPT_DEVICE_REFLECTIONS: ADOPT_DEVICE_REFLECTIONS,
    SUPABASE_JS_URL: SUPABASE_JS_URL,
    PLACEHOLDER_KEY: PLACEHOLDER_KEY,
    DEVICE_SAVED: DEVICE_SAVED,
    ACCOUNT_SAVED: ACCOUNT_SAVED,
    ACCOUNT_SAVING: ACCOUNT_SAVING,
    NOT_SAVED: NOT_SAVED,
    DEVICE_LINE: DEVICE_LINE,
    ACCOUNT_LINE: ACCOUNT_LINE,
    SIGNED_OUT_LINE: SIGNED_OUT_LINE,
    UNREACHABLE_LINE: UNREACHABLE_LINE,
    ENROLLMENT_LINE: ENROLLMENT_LINE,
    DEVICE_NOTE: DEVICE_NOTE,
    ACCOUNT_ERROR: ACCOUNT_ERROR,
    CONFLICT_MESSAGE: CONFLICT_MESSAGE,
    authEnabled: authEnabled,
    deviceHasUnattributedText: deviceHasUnattributedText,
    recordForViewer: recordForViewer,
    fieldStatus: fieldStatus,
    persistenceLine: persistenceLine,
    displayEmail: displayEmail,
    panelModel: panelModel,
    draftScope: draftScope,
    partitionPrefix: partitionPrefix,
    rowsFromRecord: rowsFromRecord,
    recordFromRows: recordFromRows,
    create: create
  };

  root.OnenessJourneyAccount = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
