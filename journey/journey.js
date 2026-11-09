/* Oneness Journey day engine: Hawaii cohort calendar, lanes, reflections.
   Account sign-in stays off until auth-config.js enables a configured API.
   While it is off, marks stay on this device. Signed-in marks go to the
   member API and are not written into the device progress key. */
(function () {
  "use strict";
  var cfg = window.ONENESS_JOURNEY_CONFIG;
  var P = window.OnenessJourneyProgress;
  if (!cfg || !P || !cfg.cohort || !cfg.days) return;

  var LANE_KEY = "onenessJourney.lane";
  var params = new URLSearchParams(window.location.search);
  var storage = P.safeStorage(window.localStorage);
  var Account = window.OnenessJourneyAccount;
  var authConfig = window.ONENESS_JOURNEY_AUTH || { enabled: false, apiBase: "" };
  var account = (Account && Account.create) ? Account.create({
    config: authConfig,
    progress: P,
    fetch: typeof window.fetch === "function" ? function (url, opts) { return window.fetch(url, opts); } : null
  }) : { enabled: false, signedIn: function () { return false; }, email: function () { return ""; } };
  var accountPhase = "device";
  var saveSeq = 0;
  var suppressDevice = false;
  var deviceNote = false;
  var confirmError = false;
  var signOutFailed = false;
  var localError = false;
  var lastAcked = null;
  var total = cfg.days.length;
  var todayYmd = P.dateInZone(new Date(), cfg.cohort.timeZone);
  var offset = P.cohortOffset(todayYmd, cfg.cohort.startDate);
  var phase = P.cohortPhase(offset, total);
  var todayIdx = P.todayIndex(offset, total);

  var statusEl = document.getElementById("cohort-status");
  document.getElementById("cohort-name").textContent = cfg.cohort.name;
  document.getElementById("cohort-note").textContent = cfg.cohort.label + " \u00b7 " + cfg.cohort.timeZoneLabel;
  document.getElementById("course-link").href = cfg.courseUrl;
  paintStatus();

  var lane = params.get("lane");
  if (lane !== "buyer" && lane !== "advocate") {
    try { lane = localStorage.getItem(LANE_KEY); } catch (e) { lane = null; }
  }
  if (lane !== "advocate") lane = "buyer";

  var requested = parseInt(params.get("day"), 10);
  var current = P.initialDay(requested, offset, total);
  var record = P.load(storage, lane, cfg.cohort.startDate);
  var draftsByScope = {};

  function currentScope() {
    var signedIn = !!(account.signedIn && account.signedIn());
    var tag = signedIn && account.sessionTag ? account.sessionTag() : "";
    return Account && Account.draftScope ? Account.draftScope(signedIn, tag) : (signedIn && tag ? "account:" + tag : "device");
  }

  function laneDraft() {
    var scope = currentScope();
    if (!draftsByScope[scope]) {
      draftsByScope[scope] = {
        buyer: { days: {}, feel: null },
        advocate: { days: {}, feel: null }
      };
    }
    return draftsByScope[scope][lane];
  }

  function dropAccountDrafts() {
    Object.keys(draftsByScope).forEach(function (key) {
      if (key.indexOf("account:") === 0) delete draftsByScope[key];
    });
  }

  function paintStatus() {
    statusEl.textContent = P.cohortStatusText(offset, total, cfg.cohort.morningTime, cfg.cohort.timeZoneLabel);
  }

  function applyChange(next, opts) {
    opts = opts || {};
    if (!account.signedIn || !account.signedIn()) {
      record = P.save(storage, next, window.OnenessJourneySync);
      accountPhase = "device";
      if (opts.clearDraft) clearDraft(opts.clearDraft);
      renderDay(current, { skipCapture: true, focus: opts.focus });
      return;
    }
    var seq = ++saveSeq;
    var previous = JSON.parse(JSON.stringify(lastAcked || P.emptyRecord(lane, cfg.cohort.startDate)));
    record = next;
    accountPhase = "saving";
    renderDay(current, { skipCapture: true, focus: opts.focus });
    account.save(lane, cfg.cohort.startDate, next).then(function (result) {
      if (seq !== saveSeq || !account.signedIn()) return;
      if (result.ok && result.synced) {
        record = result.record;
        lastAcked = result.record;
        accountPhase = "saved";
        if (opts.clearDraft) clearDraft(opts.clearDraft);
      } else if (result.conflict && result.record) {
        record = result.record;
        lastAcked = result.record;
        accountPhase = "conflict";
        clearDraft("reflection");
        clearDraft("feel");
      } else {
        record = previous;
        accountPhase = "error";
      }
      renderDay(current, { skipCapture: true, focus: opts.focus });
    });
  }

  function captureDrafts() {
    var box = laneDraft();
    var ref = document.getElementById("reflection-input");
    var feel = document.getElementById("feel-input");
    if (ref) {
      if (!box.days[current]) box.days[current] = {};
      box.days[current].reflection = ref.value;
    }
    if (feel) box.feel = feel.value;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function link(href, label, cls) {
    var a = el("a", "btn " + (cls || "btn-primary"), label);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  function fieldStatus(value, stored) {
    var phase = account.signedIn && account.signedIn() ? accountPhase : "device";
    if (Account && Account.fieldStatus) return Account.fieldStatus(value, stored, phase);
    if (value !== stored) return "Not saved yet.";
    if (stored.trim().length > 0) return "Saved on this device.";
    return "";
  }

  function persistenceLine() {
    if (!Account || !Account.persistenceLine) return "Your marks and words stay on this device.";
    var mode = "signedOut";
    if (!account.enabled) mode = "off";
    else if (suppressDevice && !(account.signedIn && account.signedIn())) mode = "unreachable";
    else if (account.signedIn && account.signedIn()) mode = "account";
    return Account.persistenceLine({ enabled: account.enabled === true, mode: mode });
  }

  function clearDraft(kind) {
    var box = laneDraft();
    if (kind === "reflection" && box.days[current]) delete box.days[current].reflection;
    if (kind === "feel") box.feel = null;
  }

  function syncUrl() {
    if (!window.history || !history.replaceState) return;
    try {
      var q = new URLSearchParams(window.location.search);
      q.set("day", String(current));
      if (lane === "advocate") q.set("lane", "advocate");
      else q.delete("lane");
      history.replaceState(null, "", window.location.pathname + "?" + q.toString() + window.location.hash);
    } catch (e) {}
  }

  var picker = document.getElementById("day-picker");
  cfg.days.forEach(function (d) {
    var li = el("li");
    var b = el("button", "day-btn");
    b.type = "button";
    b.setAttribute("data-day", String(d.day));
    b.appendChild(el("span", "lbl", "Day"));
    b.appendChild(el("span", "num", String(d.day)));
    b.addEventListener("click", function () {
      renderDay(d.day, { focusCard: true });
    });
    li.appendChild(b);
    picker.appendChild(li);
  });

  function paintPicker() {
    picker.querySelectorAll(".day-btn").forEach(function (b) {
      var n = Number(b.getAttribute("data-day"));
      var d = cfg.days[n - 1];
      var day = P.dayOf(record, n);
      var done = P.dayComplete(day);
      var count = P.stepCount(day);
      var ahead = P.dayIsAhead(phase, n, todayIdx);
      b.classList.toggle("is-today", n === todayIdx);
      b.classList.toggle("is-complete", done);
      b.classList.toggle("is-ahead", ahead);
      b.setAttribute("aria-current", n === current ? "true" : "false");
      var bits = ["Day " + n + ": " + d.theme];
      if (n === todayIdx) bits.push("today");
      if (ahead) bits.push("ahead, preview");
      if (done) bits.push("complete");
      else if (count) bits.push(count + " of 4 complete");
      b.setAttribute("aria-label", bits.join(", "));
    });
  }

  function stepBlock(meta, d, on) {
    var li = el("li", "step" + (on ? " is-done" : ""));
    li.appendChild(el("span", "step-icon", meta.icon)).setAttribute("aria-hidden", "true");
    var body = el("div", "step-body");
    body.appendChild(el("h3", null, meta.title));
    body.appendChild(el("p", null, meta.copy(d)));
    body.appendChild(link(meta.href(d), meta.label(d), meta.primary ? "btn-primary" : "btn-ghost"));
    var mark = el("label", "mark");
    var input = document.createElement("input");
    input.type = "checkbox";
    input.id = "mark-" + meta.key;
    input.checked = on;
    input.setAttribute("aria-label", on ? meta.title + " complete" : "Mark " + meta.title.toLowerCase() + " complete");
    var box = el("span", "box");
    box.setAttribute("aria-hidden", "true");
    mark.appendChild(input);
    mark.appendChild(box);
    mark.appendChild(el("span", "mark-label", on ? "Done" : "Mark done"));
    input.addEventListener("change", function () { onStepToggle(meta.key); });
    body.appendChild(mark);
    li.appendChild(body);
    return li;
  }

  var STEPS = [
    {
      key: "video",
      icon: "\u25B6",
      title: "Morning video",
      copy: function (d) { return "Watch Video Day " + d.day + " in your VIP Membership."; },
      href: function (d) { return d.video; },
      label: function (d) { return "Watch Day " + d.day; },
      primary: true
    },
    {
      key: "workbook",
      icon: "\u270E",
      title: "Workbook page",
      copy: function (d) { return d.practice; },
      href: function (d) { return d.workbook; },
      label: function () { return "Open workbook"; },
      primary: false
    },
    {
      key: "evening",
      icon: "\u263E",
      title: "Evening session",
      copy: function () { return cfg.cohort.eveningTime + " " + cfg.cohort.timeZoneLabel + ". Come as you are and watch with us."; },
      href: function (d) { return d.evening; },
      label: function () { return "Join the evening"; },
      primary: false
    }
  ];

  function onStepToggle(stepKey) {
    var wasVisible = P.feedbackVisible(record, total);
    captureDrafts();
    var next = P.toggleStep(record, current, stepKey);
    var focus = "#mark-" + stepKey;
    if (!wasVisible && P.feedbackVisible(next, total)) focus = "#feel-input";
    applyChange(next, { focus: focus });
  }

  function onSaveReflection(event) {
    event.preventDefault();
    var input = document.getElementById("reflection-input");
    var text = input ? input.value : "";
    var wasVisible = P.feedbackVisible(record, total);
    captureDrafts();
    var next = P.setReflection(record, current, text);
    var focus = "#reflection-save";
    if (!wasVisible && P.feedbackVisible(next, total)) focus = "#feel-input";
    applyChange(next, { focus: focus, clearDraft: "reflection" });
  }

  function onSaveFeel(event) {
    event.preventDefault();
    var input = document.getElementById("feel-input");
    var text = input ? input.value : "";
    captureDrafts();
    var next = P.setJourneyFeedback(record, text);
    applyChange(next, { focus: "#feel-save", clearDraft: "feel" });
  }

  function renderDay(n, opts) {
    opts = opts || {};
    if (!opts.skipCapture) captureDrafts();
    current = n;
    var d = cfg.days[n - 1];
    var day = P.dayOf(record, n);
    var reflectionValue = day.reflection;
    var box = laneDraft();
    if (box.days[n] && box.days[n].reflection != null) reflectionValue = box.days[n].reflection;
    paintPicker();

    var card = document.getElementById("today");
    card.textContent = "";
    card.appendChild(el("p", "kicker", "Day " + d.day + " of " + total + (d.day === todayIdx ? " \u00b7 Today" : "")));
    card.appendChild(el("h2", null, d.theme));
    var spoke = el("p", "spoke");
    spoke.appendChild(el("strong", null, "Moon spoke: " + d.spoke + ". "));
    spoke.appendChild(document.createTextNode(d.question));
    card.appendChild(spoke);

    var count = P.stepCount(day);
    var progress = el("p", "progress-line", count + " of 4 complete");
    progress.id = "progress-line";
    card.appendChild(progress);
    var line = el("p", "fine", persistenceLine());
    line.id = "persistence-line";
    card.appendChild(line);
    if (account.signedIn && account.signedIn() && (accountPhase === "error" || accountPhase === "conflict") && Account) {
      var banner = el("p", "fine account-error", accountPhase === "conflict" ? Account.CONFLICT_MESSAGE : Account.ACCOUNT_ERROR);
      banner.id = "account-save-error";
      banner.setAttribute("aria-live", "polite");
      card.appendChild(banner);
    }
    if (P.dayIsAhead(phase, d.day, todayIdx)) {
      card.appendChild(el("p", "ahead-note", "Ahead of today. Open to preview \u2014 nothing here is locked."));
    }

    var steps = el("ol", "steps");
    STEPS.forEach(function (meta) {
      steps.appendChild(stepBlock(meta, d, day[meta.key] === true));
    });
    var reflectSaved = P.reflectionDone(day);
    var reflectStep = el("li", "step reflect-step" + (reflectSaved ? " is-done" : ""));
    reflectStep.appendChild(el("span", "step-icon", "\u201C")).setAttribute("aria-hidden", "true");
    var reflectBody = el("div", "step-body");
    reflectBody.appendChild(el("h3", null, "Evening reflection"));
    var form = el("form", "reflect");
    form.addEventListener("submit", onSaveReflection);
    var prompt = el("p", "reflection", d.reflection);
    prompt.id = "reflection-prompt";
    form.appendChild(prompt);
    var area = document.createElement("textarea");
    area.id = "reflection-input";
    area.className = "field";
    area.rows = 4;
    area.value = reflectionValue;
    area.setAttribute("aria-labelledby", "reflection-prompt");
    area.autocomplete = "off";
    form.appendChild(area);
    var actions = el("div", "reflect-actions");
    var save = el("button", "btn btn-primary", "Save reflection");
    save.type = "submit";
    save.id = "reflection-save";
    actions.appendChild(save);
    var state = el("p", "fine save-state", fieldStatus(reflectionValue, day.reflection));
    state.id = "reflection-status";
    state.setAttribute("aria-live", "polite");
    actions.appendChild(state);
    form.appendChild(actions);
    area.addEventListener("input", function () {
      state.textContent = fieldStatus(area.value, day.reflection);
    });
    if (reflectSaved) {
      var done = el("p", "mark static");
      var doneBox = el("span", "box on");
      doneBox.setAttribute("aria-hidden", "true");
      done.appendChild(doneBox);
      done.appendChild(el("span", "mark-label", "Done"));
      form.appendChild(done);
    }
    reflectBody.appendChild(form);
    reflectStep.appendChild(reflectBody);
    steps.appendChild(reflectStep);
    card.appendChild(steps);

    if (d.day === total && cfg.privateSittingUrl) {
      var next = el("div", "next-door");
      next.appendChild(el("p", "muted", "Ready to walk deeper? Your next door is a Private Sitting."));
      var sitting = link(cfg.privateSittingUrl, "Book a Private Sitting", "btn-ghost");
      sitting.addEventListener("click", function () {
        if (record.sittingOpened) return;
        var wasVisible = P.feedbackVisible(record, total);
        captureDrafts();
        var next = P.markSittingOpened(record);
        applyChange(next, { focus: !wasVisible && P.feedbackVisible(next, total) ? "#feel-input" : "" });
      });
      next.appendChild(sitting);
      card.appendChild(next);
    }

    if (d.day === total && P.feedbackVisible(record, total)) {
      var feelStored = record.journeyFeedback || "";
      var feelValue = box.feel != null ? box.feel : feelStored;
      var feel = el("section", "feel");
      feel.setAttribute("aria-labelledby", "feel-title");
      var title = el("h3", null, P.FEEDBACK_PROMPT);
      title.id = "feel-title";
      feel.appendChild(title);
      var feelForm = el("form", "feel-form");
      feelForm.addEventListener("submit", onSaveFeel);
      var feelArea = document.createElement("textarea");
      feelArea.id = "feel-input";
      feelArea.className = "field";
      feelArea.rows = 4;
      feelArea.value = feelValue;
      feelArea.setAttribute("aria-labelledby", "feel-title");
      feelArea.autocomplete = "off";
      feelForm.appendChild(feelArea);
      var feelActions = el("div", "reflect-actions");
      var feelSave = el("button", "btn btn-primary", "Save");
      feelSave.type = "submit";
      feelSave.id = "feel-save";
      feelActions.appendChild(feelSave);
      var feelState = el("p", "fine save-state", fieldStatus(feelValue, feelStored));
      feelState.id = "feel-status";
      feelState.setAttribute("aria-live", "polite");
      feelActions.appendChild(feelState);
      feelForm.appendChild(feelActions);
      feelArea.addEventListener("input", function () {
        feelState.textContent = fieldStatus(feelArea.value, feelStored);
      });
      feel.appendChild(feelForm);
      card.appendChild(feel);
    }

    syncUrl();
    if (opts.focus) {
      var node = card.querySelector(opts.focus);
      if (node) node.focus();
    } else if (opts.focusCard) {
      card.focus();
    }
  }

  function panelMode() {
    if (!account.enabled) return "off";
    if (account.signedIn && account.signedIn()) return "account";
    if (suppressDevice) return "unreachable";
    return "signedOut";
  }

  function paintAccount() {
    if (!Account || !Account.panelModel) return;
    var model = Account.panelModel(Object.assign({}, authConfig, {
      mode: panelMode(),
      email: account.email ? account.email() : "",
      deviceNote: deviceNote,
      confirmError: confirmError,
      signOutFailed: signOutFailed,
      localError: localError
    }));
    if (model.kind === "device-only") return;
    var panel = document.getElementById("account-panel");
    if (!panel) return;
    panel.textContent = "";
    panel.appendChild(el("p", "kicker", model.kicker));
    var title = el("h2", null, model.title);
    title.id = "signin-title";
    panel.appendChild(title);
    panel.appendChild(el("p", "muted", model.copy));
    if (model.note) panel.appendChild(el("p", "fine", model.note));
    if (model.kind === "signed-out" && model.signInUrl) {
      var link = el("a", "btn btn-primary", "Sign in");
      link.id = "account-signin";
      link.href = model.signInUrl;
      panel.appendChild(link);
    }
    if (model.kind === "local-demo" && model.buttonLabel) {
      ["member-a", "member-b"].forEach(function (name) {
        var button = el("button", "btn btn-primary", model.buttonLabel(name));
        button.type = "button";
        button.setAttribute("data-test-member", name);
        button.addEventListener("click", function () { signInLocal(name, button); });
        panel.appendChild(button);
      });
    }
    if (model.kind === "signed-in") {
      var out = el("button", "btn btn-ghost", "Sign out");
      out.type = "button";
      out.id = "account-signout";
      out.addEventListener("click", onSignOut);
      panel.appendChild(out);
    }
  }

  function showCurrentRecord() {
    if (!Account || !Account.recordForViewer) {
      record = suppressDevice ? P.emptyRecord(lane, cfg.cohort.startDate) : P.load(storage, lane, cfg.cohort.startDate);
      accountPhase = suppressDevice ? "error" : "device";
      renderDay(current, { skipCapture: true });
      return;
    }
    var device = P.load(storage, lane, cfg.cohort.startDate);
    var empty = P.emptyRecord(lane, cfg.cohort.startDate);
    var mode = "signedOut";
    if (account.signedIn && account.signedIn()) mode = "account";
    else if (suppressDevice) mode = "unreachable";
    var view = Account.recordForViewer({
      mode: mode,
      serverRecord: lastAcked || empty,
      deviceRecord: device,
      emptyRecord: empty,
      suppressDevice: suppressDevice
    });
    record = view.record;
    accountPhase = mode === "account" ? "saved" : (suppressDevice ? "error" : "device");
    renderDay(current, { skipCapture: true });
  }

  function loadAccountPartition() {
    var seq = ++saveSeq;
    var device = P.load(storage, lane, cfg.cohort.startDate);
    var empty = P.emptyRecord(lane, cfg.cohort.startDate);
    record = empty;
    lastAcked = empty;
    accountPhase = "loading";
    deviceNote = false;
    renderDay(current, { skipCapture: true });
    account.load(lane, cfg.cohort.startDate, device).then(function (loaded) {
      if (seq !== saveSeq || !account.signedIn()) return;
      var view = Account.recordForViewer({
        mode: loaded.error ? "unreachable" : "account",
        serverRecord: loaded.record,
        deviceRecord: device,
        emptyRecord: empty
      });
      record = view.record;
      lastAcked = view.record;
      deviceNote = loaded.deviceNote === true && view.source === "account";
      accountPhase = loaded.error ? "error" : "saved";
      confirmError = false;
      paintAccount();
      renderDay(current, { skipCapture: true });
    });
  }

  function setLane(next, opts) {
    opts = opts || {};
    if (!opts.skipCapture) captureDrafts();
    lane = next === "advocate" ? "advocate" : "buyer";
    try { localStorage.setItem(LANE_KEY, lane); } catch (e) {}
    document.querySelectorAll("[data-lane]").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-lane") === lane ? "true" : "false");
    });
    document.querySelectorAll("[data-lane-panel]").forEach(function (p) {
      p.hidden = p.getAttribute("data-lane-panel") !== lane;
    });
    if (account.signedIn && account.signedIn()) {
      loadAccountPartition();
      return;
    }
    showCurrentRecord();
  }

  function signInLocal(name, button) {
    if (!account.signInLocal) return;
    captureDrafts();
    button.disabled = true;
    localError = false;
    account.signInLocal(name).then(function (res) {
      button.disabled = false;
      if (!res.ok) {
        localError = true;
        paintAccount();
        return;
      }
      return account.boot().then(function (result) {
        localError = false;
        suppressDevice = result.mode === "unreachable";
        confirmError = false;
        signOutFailed = false;
        paintAccount();
        setLane(lane, { skipCapture: true });
      });
    });
  }

  function onSignOut() {
    if (!account.logout) return;
    var seq = ++saveSeq;
    account.logout().then(function (res) {
      if (!res.ok) {
        signOutFailed = true;
        paintAccount();
        return;
      }
      if (seq !== saveSeq && account.signedIn()) return;
      signOutFailed = false;
      confirmError = false;
      deviceNote = false;
      suppressDevice = false;
      localError = false;
      lastAcked = null;
      dropAccountDrafts();
      paintAccount();
      setLane(lane, { skipCapture: true });
    });
  }

  document.querySelectorAll("[data-lane]").forEach(function (b) {
    b.addEventListener("click", function () { setLane(b.getAttribute("data-lane")); });
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    var ymd = P.dateInZone(new Date(), cfg.cohort.timeZone);
    var dateChanged = ymd !== todayYmd;
    if (dateChanged) {
      todayYmd = ymd;
      offset = P.cohortOffset(todayYmd, cfg.cohort.startDate);
      phase = P.cohortPhase(offset, total);
      todayIdx = P.todayIndex(offset, total);
      paintStatus();
    }
    if (account.enabled && account.signedIn && account.signedIn() && account.refreshIdentity) {
      account.refreshIdentity().then(function (ident) {
        if (!ident) return;
        if (ident.unreachable) {
          confirmError = true;
          paintAccount();
          if (dateChanged) renderDay(current, { skipCapture: false });
          return;
        }
        confirmError = false;
        if (ident.signedOut) {
          suppressDevice = false;
          deviceNote = false;
          lastAcked = null;
          saveSeq += 1;
          paintAccount();
          setLane(lane, { skipCapture: true });
          return;
        }
        if (ident.changed) {
          deviceNote = false;
          dropAccountDrafts();
          saveSeq += 1;
          paintAccount();
          loadAccountPartition();
          return;
        }
        if (dateChanged) renderDay(current, { skipCapture: false });
      });
      return;
    }
    if (dateChanged) renderDay(current, { skipCapture: false });
  });

  window.OnenessJourney = {
    storageKey: function () { return P.storageKey(lane, cfg.cohort.startDate); },
    readProgress: function () { return JSON.parse(JSON.stringify(record)); },
    accountState: function () {
      return {
        enabled: account.enabled === true,
        signedIn: !!(account.signedIn && account.signedIn()),
        synced: accountPhase === "saved"
      };
    }
  };

  if (!account.enabled) {
    setLane(lane);
  } else {
    paintAccount();
    account.boot().then(function (result) {
      suppressDevice = result.mode === "unreachable";
      paintAccount();
      setLane(lane, { skipCapture: true });
    });
  }
})();
