/* Oneness Journey shell: lane toggle, Day 1-5 picker, cohort status. No auth, no tracking. */
(function () {
  "use strict";
  var cfg = window.ONENESS_JOURNEY_CONFIG;
  if (!cfg) return;
  var STORE = "onenessJourney.lane";
  var params = new URLSearchParams(window.location.search);

  function dateInZone(tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  function dayNumber(ymd) {
    var p = ymd.split("-").map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]) / 86400000;
  }

  // Which cohort day is it in Hawaii right now? 0 = before, 1-5 = live, 6 = after.
  var offset = dayNumber(dateInZone(cfg.cohort.timeZone)) - dayNumber(cfg.cohort.startDate) + 1;
  var total = cfg.days.length;
  var todayIdx = offset >= 1 && offset <= total ? offset : 0;

  var statusEl = document.getElementById("cohort-status");
  document.getElementById("cohort-name").textContent = cfg.cohort.name;
  document.getElementById("cohort-note").textContent = cfg.cohort.label + " \u00b7 " + cfg.cohort.timeZoneLabel;
  document.getElementById("course-link").href = cfg.courseUrl;
  if (offset < 1) {
    statusEl.textContent = "Begins in " + (1 - offset) + (1 - offset === 1 ? " day" : " days") + ", " + cfg.cohort.morningTime + " " + cfg.cohort.timeZoneLabel + ". Preview any day below.";
  } else if (todayIdx) {
    statusEl.textContent = "Today is Day " + todayIdx + " of " + total + ".";
  } else {
    statusEl.textContent = "This cohort has completed. Every day stays open for you.";
  }

  // Lane
  var lane = params.get("lane");
  if (lane !== "buyer" && lane !== "advocate") {
    try { lane = localStorage.getItem(STORE); } catch (e) { lane = null; }
  }
  if (lane !== "advocate") lane = "buyer";

  function setLane(next) {
    lane = next;
    try { localStorage.setItem(STORE, lane); } catch (e) {}
    document.querySelectorAll("[data-lane]").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-lane") === lane ? "true" : "false");
    });
    document.querySelectorAll("[data-lane-panel]").forEach(function (p) {
      p.hidden = p.getAttribute("data-lane-panel") !== lane;
    });
    syncUrl();
  }

  // Day
  var requested = parseInt(params.get("day"), 10);
  var current = requested >= 1 && requested <= total ? requested : (todayIdx || (offset > total ? total : 1));

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function link(href, label, cls) {
    var a = el("a", "btn " + (cls || "btn-primary"), label);
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    return a;
  }
  function step(icon, title, copy, href, label, primary) {
    var li = el("li", "step");
    li.appendChild(el("span", "step-icon", icon)).setAttribute("aria-hidden", "true");
    var body = el("div", "step-body");
    body.appendChild(el("h3", null, title));
    body.appendChild(el("p", null, copy));
    body.appendChild(link(href, label, primary ? "btn-primary" : "btn-ghost"));
    li.appendChild(body);
    return li;
  }

  var picker = document.getElementById("day-picker");
  cfg.days.forEach(function (d) {
    var li = el("li");
    var b = el("button", "day-btn" + (d.day === todayIdx ? " is-today" : ""));
    b.type = "button";
    b.setAttribute("data-day", d.day);
    b.setAttribute("aria-label", "Day " + d.day + ": " + d.theme + (d.day === todayIdx ? " (today)" : ""));
    b.appendChild(el("span", "lbl", "Day"));
    b.appendChild(el("span", "num", String(d.day)));
    b.addEventListener("click", function () { renderDay(d.day, true); });
    li.appendChild(b);
    picker.appendChild(li);
  });

  function renderDay(n, focus) {
    current = n;
    var d = cfg.days[n - 1];
    picker.querySelectorAll(".day-btn").forEach(function (b) {
      b.setAttribute("aria-current", Number(b.getAttribute("data-day")) === n ? "true" : "false");
    });
    var card = document.getElementById("today");
    card.textContent = "";
    card.appendChild(el("p", "kicker", "Day " + d.day + " of " + total + (d.day === todayIdx ? " \u00b7 Today" : "")));
    card.appendChild(el("h2", null, d.theme));
    var spoke = el("p", "spoke");
    spoke.appendChild(el("strong", null, "Moon spoke: " + d.spoke + ". "));
    spoke.appendChild(document.createTextNode(d.question));
    card.appendChild(spoke);
    var steps = el("ol", "steps");
    steps.appendChild(step("\u25B6", "Morning video", "Watch Video Day " + d.day + " in your VIP Membership.", d.video, "Watch Day " + d.day, true));
    steps.appendChild(step("\u270E", "Workbook page", d.practice, d.workbook, "Open workbook", false));
    steps.appendChild(step("\u263E", "Evening session", cfg.cohort.eveningTime + " " + cfg.cohort.timeZoneLabel + ". Come as you are and watch with us.", d.evening, "Join the evening", false));
    card.appendChild(steps);
    card.appendChild(el("p", "reflection", "Evening reflection: " + d.reflection));
    if (d.day === total && cfg.privateSittingUrl) {
      var next = el("div", "next-door");
      next.appendChild(el("p", "muted", "Ready to walk deeper? Your next door is a Private Sitting."));
      next.appendChild(link(cfg.privateSittingUrl, "Book a Private Sitting", "btn-ghost"));
      card.appendChild(next);
    }
    syncUrl();
    if (focus) card.focus({ preventScroll: false });
  }

  function syncUrl() {
    if (!window.history || !history.replaceState) return;
    var q = new URLSearchParams(window.location.search);
    q.set("day", String(current));
    if (lane === "advocate") q.set("lane", "advocate"); else q.delete("lane");
    history.replaceState(null, "", window.location.pathname + "?" + q.toString() + window.location.hash);
  }

  document.querySelectorAll("[data-lane]").forEach(function (b) {
    b.addEventListener("click", function () { setLane(b.getAttribute("data-lane")); });
  });
  renderDay(current, false);
  setLane(lane);
})();
