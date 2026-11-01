/* Oneness Journey day engine: Hawaii cohort calendar, lanes, local progress, reflection.
   No auth and no network. Magic-link sign-in stays a Coming soon stub in the page. */
(function () {
  "use strict";
  var cfg = window.ONENESS_JOURNEY_CONFIG;
  var P = window.OnenessJourneyProgress;
  if (!cfg || !P || !cfg.cohort || !cfg.days) return;

  var LANE_KEY = "onenessJourney.lane";
  var params = new URLSearchParams(window.location.search);
  var storage = P.safeStorage(window.localStorage);
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
  var drafts = {
    buyer: { days: {}, feel: null },
    advocate: { days: {}, feel: null }
  };

  function paintStatus() {
    statusEl.textContent = P.cohortStatusText(offset, total, cfg.cohort.morningTime, cfg.cohort.timeZoneLabel);
  }

  function laneDraft() {
    return drafts[lane];
  }

  function commit(next) {
    record = P.save(storage, next, window.OnenessJourneySync);
    return record;
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
    if (value !== stored) return "Not saved yet.";
    if (stored.trim().length > 0) return "Saved on this device.";
    return "";
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
    record = commit(P.toggleStep(record, current, stepKey));
    var focus = "#mark-" + stepKey;
    if (!wasVisible && P.feedbackVisible(record, total)) focus = "#feel-input";
    renderDay(current, { skipCapture: true, focus: focus });
  }

  function onSaveReflection(event) {
    event.preventDefault();
    var input = document.getElementById("reflection-input");
    var text = input ? input.value : "";
    var wasVisible = P.feedbackVisible(record, total);
    captureDrafts();
    if (laneDraft().days[current]) delete laneDraft().days[current].reflection;
    record = commit(P.setReflection(record, current, text));
    var focus = "#reflection-save";
    if (!wasVisible && P.feedbackVisible(record, total)) focus = "#feel-input";
    renderDay(current, { skipCapture: true, focus: focus });
  }

  function onSaveFeel(event) {
    event.preventDefault();
    var input = document.getElementById("feel-input");
    var text = input ? input.value : "";
    captureDrafts();
    laneDraft().feel = null;
    record = commit(P.setJourneyFeedback(record, text));
    renderDay(current, { skipCapture: true, focus: "#feel-save" });
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
    card.appendChild(el("p", "fine", "Your marks and words stay on this device."));
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
        record = commit(P.markSittingOpened(record));
        window.setTimeout(function () {
          renderDay(current, {
            skipCapture: true,
            focus: !wasVisible && P.feedbackVisible(record, total) ? "#feel-input" : ""
          });
        }, 0);
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

  function setLane(next) {
    captureDrafts();
    lane = next === "advocate" ? "advocate" : "buyer";
    try { localStorage.setItem(LANE_KEY, lane); } catch (e) {}
    document.querySelectorAll("[data-lane]").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-lane") === lane ? "true" : "false");
    });
    document.querySelectorAll("[data-lane-panel]").forEach(function (p) {
      p.hidden = p.getAttribute("data-lane-panel") !== lane;
    });
    record = P.load(storage, lane, cfg.cohort.startDate);
    renderDay(current, { skipCapture: true });
  }

  document.querySelectorAll("[data-lane]").forEach(function (b) {
    b.addEventListener("click", function () { setLane(b.getAttribute("data-lane")); });
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    var ymd = P.dateInZone(new Date(), cfg.cohort.timeZone);
    if (ymd === todayYmd) return;
    todayYmd = ymd;
    offset = P.cohortOffset(todayYmd, cfg.cohort.startDate);
    phase = P.cohortPhase(offset, total);
    todayIdx = P.todayIndex(offset, total);
    paintStatus();
    renderDay(current, { skipCapture: false });
  });

  window.OnenessJourney = {
    storageKey: function () { return P.storageKey(lane, cfg.cohort.startDate); },
    readProgress: function () { return JSON.parse(JSON.stringify(record)); }
  };

  setLane(lane);
})();
