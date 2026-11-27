/* Sanctuary client portal.
   The browser never decides who may read a row. Supabase Auth and row security do.
   There is no public registration and no preview switch. */
(function (root) {
  "use strict";

  var SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm";
  var BOOKING = "https://link.onenesswellnesslifestyles.com/widget/booking/GqDRwjfFbCG26t5FDfsy";
  var access = root.OnenessPortalAccess;
  var config = root.ONENESS_PORTAL_AUTH || {};
  var sb = null;
  var state = { session: null, profile: null, editions: [], edition: null, view: "timeline" };

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function projectUrl(value) {
    var url = value && typeof value.supabaseUrl === "string" ? value.supabaseUrl.trim().replace(/\/+$/, "") : "";
    return /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url) ? url : "";
  }

  function keyReady(key) {
    if (typeof key !== "string") return false;
    var trimmed = key.trim();
    if (!trimmed || trimmed === "YOUR_SUPABASE_ANON_KEY") return false;
    if (/service_role/i.test(trimmed) || /\s/.test(trimmed)) return false;
    return trimmed.length >= 20;
  }

  function authReady() {
    return config.enabled === true && !!projectUrl(config) && keyReady(config.supabaseAnonKey);
  }

  function viewerFrom(session, profile) {
    var email = session && session.user ? session.user.email : "";
    return {
      userId: session && session.user ? session.user.id : "",
      email: email,
      role: profile && profile.role ? profile.role : "client"
    };
  }

  function renderEdition(model) {
    model = model || {};
    var viewer = model.viewer || { userId: "", email: "", role: "client" };
    var edition = model.edition;
    var gate = $("gate");
    var host = $("edition");
    if (gate) gate.classList.add("hidden");
    if (!host) return;
    host.classList.remove("hidden");
    if (!edition) {
      host.innerHTML = '<section class="card"><h2>No edition yet</h2><p>This sign-in is not attached to a client edition. Ask Clan Mother to invite this email. There is no public registration.</p></section>';
      return;
    }
    var admin = access.isAdmin(viewer);
    var summaries = access.visibleSummaries(viewer, model.summaries || [], [edition]);
    var scans = model.scans || [];
    var readings = model.readings || [];
    var letters = model.letters || [];
    var sleepLogs = model.sleepLogs || [];
    var news = access.timeline(summaries, scans, sleepLogs);
    var view = model.view || "timeline";
    host.innerHTML = shellHtml(viewer, edition, admin, view)
      + viewHtml(view, { news: news, scans: scans, readings: readings, letters: letters, sleepLogs: sleepLogs, summaries: model.summaries || [], editions: model.editions || [], admin: admin, edition: edition })
      + bookAndHome();
    bindEdition(viewer, edition, admin);
  }

  function shellHtml(viewer, edition, admin, view) {
    var tabs = ["timeline", "scans", "readings", "progress", "letters", "sleep", "name"];
    var labels = {
      timeline: "What's new",
      scans: "Scans",
      readings: "Readings",
      progress: "Progress",
      letters: "Letters to the Body",
      sleep: "Sleep Cycle Log",
      name: "Your name"
    };
    var nav = tabs.map(function (tab) {
      return '<button type="button" class="pill quiet" data-view="' + tab + '" aria-current="' + (view === tab ? "true" : "false") + '">' + labels[tab] + "</button>";
    }).join("");
    if (admin) {
      nav += '<button type="button" class="pill quiet" data-view="admin" aria-current="' + (view === "admin" ? "true" : "false") + '">Review</button>';
    }
    return '<p class="note">Signed in as ' + esc(viewer.email) + ". Edition for " + esc(edition.display_name || edition.client_email) + ".</p>"
      + '<nav class="nav" aria-label="Edition sections">' + nav + "</nav>";
  }

  function viewHtml(view, data) {
    if (view === "scans") return scansHtml(data.scans);
    if (view === "readings") return readingsHtml(data.readings);
    if (view === "progress") return progressHtml(data.scans);
    if (view === "letters") return lettersHtml(data.letters);
    if (view === "sleep") return sleepHtml(data.sleepLogs);
    if (view === "name") return nameHtml(data.edition);
    if (view === "admin" && data.admin) return adminHtml(data);
    return timelineHtml(data.news);
  }

  function timelineHtml(items) {
    if (!items.length) return '<section class="panel"><h2>What\'s new</h2><p>Approved notes, scans, and retests will gather here.</p></section>';
    return '<section class="panel"><h2>What\'s new</h2>' + items.map(function (item) {
      return "<article><h3>" + esc(item.title) + "</h3><p>" + esc(item.text) + "</p></article>";
    }).join("") + "</section>";
  }

  function scansHtml(scans) {
    var body = (scans || []).map(function (scan) {
      var rows = (scan.categories || []).map(function (cat) {
        return "<tr><td>" + esc(cat.name) + "</td><td>" + esc(cat.raw) + "</td><td>" + esc(cat.optimized) + "</td></tr>";
      }).join("");
      return "<h3>" + esc(scan.title || "Scan") + "</h3><p>" + esc(scan.scanned_on) + "</p><table class=\"scan-table\"><thead><tr><th>Area</th><th>Raw</th><th>Optimized</th></tr></thead><tbody>" + rows + "</tbody></table>";
    }).join("");
    return '<section class="panel"><h2>Scans</h2><p>Readings from a Quantum Frequency Therapy sitting. Raw is what was recorded. Optimized is the direction of the work.</p>' + (body || "<p>No scans yet.</p>") + "</section>";
  }

  function readingsHtml(readings) {
    var body = (readings || []).map(function (row) {
      return "<article><h3>" + esc(row.title) + "</h3><p>" + esc(row.body) + "</p></article>";
    }).join("");
    return '<section class="panel"><h2>Readings</h2>' + (body || "<p>Plain language readings will appear here.</p>") + "</section>";
  }

  function progressHtml(scans) {
    var lines = access.progressLines(scans).map(function (line) { return "<li>" + esc(line) + "</li>"; }).join("");
    return '<section class="panel"><h2>Progress</h2><ul>' + lines + "</ul></section>";
  }

  function lettersHtml(letters) {
    var list = (letters || []).map(function (row) {
      return '<article class="letter"><p>' + esc(row.body) + "</p></article>";
    }).join("");
    return '<section class="panel"><h2>Letters to the Body</h2><p>A private journal, written by you.</p><form id="letter-form"><label for="letter">Letter</label><textarea id="letter" required></textarea><button class="pill" type="submit">Save letter</button></form>' + list + "</section>";
  }

  function sleepHtml(logs) {
    var list = (logs || []).map(function (row) {
      return "<article><h3>" + esc(row.item) + "</h3><p>" + esc(row.logged_on || "") + " " + esc(row.response) + "</p></article>";
    }).join("");
    return '<section class="panel"><h2>Sleep Cycle Log</h2><form id="sleep-form"><label for="sleep-item">Retest item</label><input id="sleep-item" required><label for="sleep-response">Response</label><textarea id="sleep-response" required></textarea><button class="pill" type="submit">Save log</button></form>' + list + "</section>";
  }

  function nameHtml(edition) {
    return '<section class="panel"><h2>Your name</h2><form id="name-form"><label for="display-name">Name on this edition</label><input id="display-name" value="' + esc(edition.display_name || "") + '" maxlength="80"><button class="pill" type="submit">Save name</button></form></section>';
  }

  function adminHtml(data) {
    var queue = (data.summaries || []).filter(function (row) { return row.status === "draft"; }).map(function (row) {
      return '<article class="letter" data-summary="' + esc(row.id) + '"><h3>' + esc(row.title) + '</h3><p>' + esc(row.body) + '</p><textarea data-edit></textarea><div class="row"><button type="button" class="pill" data-act="approve">Approve</button><button type="button" class="pill quiet" data-act="edit">Edit</button><button type="button" class="pill quiet" data-act="reject">Reject</button></div></article>';
    }).join("");
    return '<section class="panel"><h2>Review</h2><p>Only an approved note becomes visible to the client.</p>'
      + (queue || "<p>No drafts waiting.</p>")
      + '<h3>Invite a client</h3><form id="invite-form"><label for="invite-email">Email</label><input id="invite-email" type="email" required><label for="invite-name">Name</label><input id="invite-name" maxlength="80"><button class="pill" type="submit">Create edition</button></form><p class="note">Creating the edition does not send mail from this page. Invite that email from Authentication, Users, so they can sign in. There is no public registration.</p></section>';
  }

  function bookAndHome() {
    return '<section class="panel"><h2>Book a sitting</h2><p><a class="book" href="' + BOOKING + '" target="_blank" rel="noopener">Open the booking calendar</a></p></section>'
      + '<section class="panel"><h2>Add this portal to your home screen</h2><p>On iPhone, open Share, then Add to Home Screen. On Android, open the browser menu, then Install or Add to Home screen.</p><p class="note">Email reminders can be turned on later. This portal does not send text messages.</p></section>';
  }

  function bindEdition(viewer, edition, admin) {
    var host = $("edition");
    host.querySelectorAll("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.view = button.getAttribute("data-view");
        renderEdition(currentModel());
      });
    });
    var letter = $("letter-form");
    if (letter) letter.addEventListener("submit", function (event) {
      event.preventDefault();
      saveLetter(edition.id, $("letter").value);
    });
    var sleep = $("sleep-form");
    if (sleep) sleep.addEventListener("submit", function (event) {
      event.preventDefault();
      saveSleep(edition.id, $("sleep-item").value, $("sleep-response").value);
    });
    var name = $("name-form");
    if (name) name.addEventListener("submit", function (event) {
      event.preventDefault();
      saveName(edition.id, $("display-name").value);
    });
    if (!admin) return;
    var invite = $("invite-form");
    if (invite) invite.addEventListener("submit", function (event) {
      event.preventDefault();
      createEdition($("invite-email").value, $("invite-name").value);
    });
    host.querySelectorAll("[data-summary]").forEach(function (article) {
      article.querySelectorAll("[data-act]").forEach(function (button) {
        button.addEventListener("click", function () {
          var body = article.querySelector("[data-edit]").value;
          reviewSummary(article.getAttribute("data-summary"), button.getAttribute("data-act"), body);
        });
      });
    });
  }

  function currentModel() {
    return {
      viewer: viewerFrom(state.session, state.profile),
      edition: state.edition,
      editions: state.editions,
      summaries: state.summaries || [],
      scans: state.scans || [],
      readings: state.readings || [],
      letters: state.letters || [],
      sleepLogs: state.sleepLogs || [],
      view: state.view
    };
  }

  function setStatus(text) {
    var node = $("gate-status");
    if (node) node.textContent = text || "";
  }

  function loadLibrary() {
    if (root.supabase && typeof root.supabase.createClient === "function") {
      return Promise.resolve(root.supabase.createClient);
    }
    return import(SUPABASE_JS_URL).then(function (mod) {
      return mod.createClient;
    });
  }

  function boot() {
    var magic = $("magic-form");
    var password = $("password-form");
    if (!authReady()) {
      setStatus("Sign-in is not switched on yet. The setup notes say where to paste the publishable anon key.");
    }
    if (magic) magic.addEventListener("submit", function (event) {
      event.preventDefault();
      sendMagic($("email").value);
    });
    if (password) password.addEventListener("submit", function (event) {
      event.preventDefault();
      sendPassword($("email").value, $("password").value);
    });
    if (!authReady()) return;
    loadLibrary().then(function (factory) {
      sb = factory(projectUrl(config), String(config.supabaseAnonKey).trim(), {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return sb.auth.getSession();
    }).then(function (res) {
      var session = res && res.data ? res.data.session : null;
      if (session) return openSession(session);
    }).catch(function () {
      setStatus("Could not open sign-in. Nothing private was shown.");
    });
  }

  function sendMagic(email) {
    if (!authReady()) return;
    loadLibrary().then(function (factory) {
      sb = sb || factory(projectUrl(config), String(config.supabaseAnonKey).trim());
      return sb.auth.signInWithOtp({
        email: String(email || "").trim(),
        options: { shouldCreateUser: false, emailRedirectTo: location.origin + "/journey-portal/" }
      });
    }).then(function (res) {
      if (res && res.error) setStatus("This email is not on an edition. There is no public registration.");
      else setStatus("If this email is invited, a sign-in link is on its way.");
    }).catch(function () {
      setStatus("Could not send the sign-in link.");
    });
  }

  function sendPassword(email, password) {
    if (!authReady()) return;
    loadLibrary().then(function (factory) {
      sb = sb || factory(projectUrl(config), String(config.supabaseAnonKey).trim());
      return sb.auth.signInWithPassword({ email: String(email || "").trim(), password: String(password || "") });
    }).then(function (res) {
      if (!res || res.error || !res.data || !res.data.session) {
        setStatus("That sign-in was not accepted. There is no public registration.");
        return;
      }
      return openSession(res.data.session);
    }).catch(function () {
      setStatus("Could not sign in.");
    });
  }

  function openSession(session) {
    state.session = session;
    return sb.rpc("portal_claim_edition").then(function () {
      return sb.from("portal_profiles").select("user_id,email,display_name,role").eq("user_id", session.user.id).maybeSingle();
    }).then(function (res) {
      state.profile = res && res.data ? res.data : null;
      return sb.from("portal_editions").select("id,client_email,client_user_id,display_name").order("created_at");
    }).then(function (res) {
      var viewer = viewerFrom(session, state.profile);
      state.editions = access.visibleEditions(viewer, (res && res.data) || []);
      state.edition = state.editions[0] || null;
      if (!state.edition) {
        renderEdition(currentModel());
        return;
      }
      return loadEdition(state.edition.id).then(function () {
        renderEdition(currentModel());
      });
    });
  }

  function loadEdition(editionId) {
    return Promise.all([
      sb.from("portal_summaries").select("id,edition_id,title,body,status,created_at,reviewed_at").eq("edition_id", editionId),
      sb.from("portal_scans").select("id,edition_id,scanned_on,title,categories,created_at").eq("edition_id", editionId),
      sb.from("portal_readings").select("id,edition_id,title,body,created_at").eq("edition_id", editionId),
      sb.from("portal_letters").select("id,edition_id,body,created_at").eq("edition_id", editionId),
      sb.from("portal_sleep_logs").select("id,edition_id,logged_on,item,response,created_at").eq("edition_id", editionId)
    ]).then(function (parts) {
      state.summaries = (parts[0] && parts[0].data) || [];
      state.scans = (parts[1] && parts[1].data) || [];
      state.readings = (parts[2] && parts[2].data) || [];
      state.letters = (parts[3] && parts[3].data) || [];
      state.sleepLogs = (parts[4] && parts[4].data) || [];
    });
  }

  function saveLetter(editionId, body) {
    if (!sb) return;
    sb.from("portal_letters").insert({ edition_id: editionId, author_user_id: state.session.user.id, body: body }).then(function () {
      return loadEdition(editionId);
    }).then(function () { renderEdition(currentModel()); });
  }

  function saveSleep(editionId, item, response) {
    if (!sb) return;
    sb.from("portal_sleep_logs").insert({ edition_id: editionId, item: item, response: response }).then(function () {
      return loadEdition(editionId);
    }).then(function () { renderEdition(currentModel()); });
  }

  function saveName(editionId, name) {
    if (!sb) return;
    sb.from("portal_editions").update({ display_name: name }).eq("id", editionId).then(function () {
      state.edition.display_name = name;
      renderEdition(currentModel());
    });
  }

  function createEdition(email, name) {
    if (!sb) return;
    sb.rpc("portal_admin_create_edition", { p_email: email, p_display_name: name }).then(function () {
      return sb.from("portal_editions").select("id,client_email,client_user_id,display_name");
    }).then(function (res) {
      state.editions = access.visibleEditions(viewerFrom(state.session, state.profile), (res && res.data) || []);
      renderEdition(currentModel());
    });
  }

  function reviewSummary(id, action, body) {
    if (!sb) return;
    sb.rpc("portal_admin_set_summary", { p_id: id, p_action: action, p_body: body || null }).then(function () {
      return loadEdition(state.edition.id);
    }).then(function () { renderEdition(currentModel()); });
  }

  root.OnenessPortal = {
    renderEdition: renderEdition,
    authReady: authReady,
    BOOKING: BOOKING
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : globalThis);
