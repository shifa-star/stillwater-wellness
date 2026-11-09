/* Oneness Journey progress store (Phase 2).
   Device store only. The key is lane and cohort, never a member.
   Signed-in progress is stored by the member API and must not be written
   with save() or window.OnenessJourneySync. That hook is only for this
   device record. Device notes are not copied into an account.

   localStorage key: onenessJourney.progress.<buyer|advocate>.<YYYY-MM-DD>
   The date is config.cohort.startDate, so the next cohort gets a fresh record.

   Record shape:
   {
     v: 1,
     lane: "buyer" | "advocate",
     cohortStart: "YYYY-MM-DD",
     updatedAt: ISO string | null,
     sittingOpened: boolean,          // Day 5 Private Sitting link was used
     journeyFeedback: string,         // verbatim reply to "How did this feel?"
     days: {
       "1": { video, workbook, evening, reflection }
     }
   }
   video / workbook / evening are booleans. reflection is the saved text.
   A reflection counts as complete when it contains a non-space character.
   Unknown fields are kept so a future sync payload can round-trip. */
(function (root) {
  "use strict";

  var FEEDBACK_PROMPT = "How did this feel?";
  var STEP_KEYS = ["video", "workbook", "evening"];

  function storageKey(lane, startDate) {
    var safeLane = lane === "advocate" ? "advocate" : "buyer";
    var safeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(startDate || "")) ? String(startDate) : "undated";
    return "onenessJourney.progress." + safeLane + "." + safeDate;
  }

  function emptyDay() {
    return { video: false, workbook: false, evening: false, reflection: "" };
  }

  function emptyRecord(lane, startDate) {
    return {
      v: 1,
      lane: lane === "advocate" ? "advocate" : "buyer",
      cohortStart: /^\d{4}-\d{2}-\d{2}$/.test(String(startDate || "")) ? String(startDate) : "undated",
      updatedAt: null,
      sittingOpened: false,
      journeyFeedback: "",
      days: {}
    };
  }

  function normalizeDay(raw) {
    var day = emptyDay();
    if (!raw || typeof raw !== "object") return day;
    STEP_KEYS.forEach(function (key) {
      day[key] = raw[key] === true;
    });
    day.reflection = typeof raw.reflection === "string" ? raw.reflection : "";
    return day;
  }

  function parseRecord(raw, lane, startDate) {
    var rec = emptyRecord(lane, startDate);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return rec;
    Object.keys(raw).forEach(function (key) {
      if (key === "days" || key === "v" || key === "lane" || key === "cohortStart") return;
      rec[key] = raw[key];
    });
    rec.v = 1;
    rec.sittingOpened = raw.sittingOpened === true;
    rec.journeyFeedback = typeof raw.journeyFeedback === "string" ? raw.journeyFeedback : "";
    rec.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : null;
    rec.days = {};
    var days = raw.days && typeof raw.days === "object" ? raw.days : {};
    Object.keys(days).forEach(function (key) {
      if (!/^[1-9]\d*$/.test(key)) return;
      rec.days[key] = normalizeDay(days[key]);
    });
    return rec;
  }

  function dayOf(rec, n) {
    if (!rec || !rec.days) return emptyDay();
    return rec.days[String(n)] || emptyDay();
  }

  function reflectionDone(day) {
    return !!day && typeof day.reflection === "string" && day.reflection.trim().length > 0;
  }

  function stepCount(day) {
    var count = 0;
    STEP_KEYS.forEach(function (key) {
      if (day && day[key] === true) count += 1;
    });
    if (reflectionDone(day)) count += 1;
    return count;
  }

  function dayComplete(day) {
    return stepCount(day) === 4;
  }

  function cloneRecord(rec) {
    return parseRecord(rec, rec && rec.lane, rec && rec.cohortStart);
  }

  function withDay(rec, n, mutate) {
    var next = cloneRecord(rec);
    var day = normalizeDay(next.days[String(n)] || emptyDay());
    mutate(day);
    next.days[String(n)] = day;
    return next;
  }

  function toggleStep(rec, n, step) {
    if (STEP_KEYS.indexOf(step) === -1) return cloneRecord(rec);
    return withDay(rec, n, function (day) {
      day[step] = !day[step];
    });
  }

  function setReflection(rec, n, text) {
    return withDay(rec, n, function (day) {
      day.reflection = typeof text === "string" ? text : "";
    });
  }

  function setJourneyFeedback(rec, text) {
    var next = cloneRecord(rec);
    next.journeyFeedback = typeof text === "string" ? text : "";
    return next;
  }

  function markSittingOpened(rec) {
    var next = cloneRecord(rec);
    next.sittingOpened = true;
    return next;
  }

  function feedbackUnlocked(rec, totalDays) {
    return dayComplete(dayOf(rec, totalDays)) || !!(rec && rec.sittingOpened);
  }

  function feedbackVisible(rec, totalDays) {
    var words = rec && typeof rec.journeyFeedback === "string" && rec.journeyFeedback.trim().length > 0;
    return feedbackUnlocked(rec, totalDays) || !!words;
  }

  function dateInZone(date, tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(date);
    } catch (e) {
      return date.toISOString().slice(0, 10);
    }
  }

  function dayNumber(ymd) {
    var p = String(ymd).split("-").map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]) / 86400000;
  }

  function cohortOffset(todayYmd, startYmd) {
    return dayNumber(todayYmd) - dayNumber(startYmd) + 1;
  }

  function cohortPhase(offset, total) {
    if (offset < 1) return "before";
    if (offset > total) return "after";
    return "during";
  }

  function todayIndex(offset, total) {
    return offset >= 1 && offset <= total ? offset : 0;
  }

  function dayIsAhead(phase, day, todayIdx) {
    return phase === "during" && day > todayIdx;
  }

  function cohortStatusText(offset, total, morningTime, timeZoneLabel) {
    if (offset < 1) {
      var n = 1 - offset;
      return "Begins in " + n + (n === 1 ? " day" : " days") + ", " + morningTime + " " + timeZoneLabel + ". Preview any day below.";
    }
    if (offset <= total) return "Today is Day " + offset + " of " + total + ".";
    return "This cohort has completed. Every day stays open for you.";
  }

  function initialDay(requested, offset, total) {
    if (requested >= 1 && requested <= total) return requested;
    var today = todayIndex(offset, total);
    return today || (offset > total ? total : 1);
  }

  function safeStorage(backend) {
    var memory = {};
    var seen = {};
    return {
      getItem: function (key) {
        if (seen[key]) return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
        try {
          if (backend && backend.getItem) return backend.getItem(key);
        } catch (e) {}
        return null;
      },
      setItem: function (key, value) {
        memory[key] = String(value);
        seen[key] = true;
        try {
          if (backend && backend.setItem) backend.setItem(key, memory[key]);
        } catch (e) {}
      }
    };
  }

  function load(storage, lane, startDate) {
    var key = storageKey(lane, startDate);
    try {
      var raw = storage.getItem(key);
      if (!raw) return emptyRecord(lane, startDate);
      return parseRecord(JSON.parse(raw), lane, startDate);
    } catch (e) {
      return emptyRecord(lane, startDate);
    }
  }

  function save(storage, rec, sync) {
    var stamped = parseRecord(rec, rec && rec.lane, rec && rec.cohortStart);
    stamped.updatedAt = new Date().toISOString();
    var key = storageKey(stamped.lane, stamped.cohortStart);
    storage.setItem(key, JSON.stringify(stamped));
    if (typeof sync === "function") {
      try { sync(JSON.parse(JSON.stringify(stamped))); } catch (e) {}
    }
    return stamped;
  }

  var api = {
    FEEDBACK_PROMPT: FEEDBACK_PROMPT,
    STEP_KEYS: STEP_KEYS,
    storageKey: storageKey,
    emptyRecord: emptyRecord,
    parseRecord: parseRecord,
    dayOf: dayOf,
    reflectionDone: reflectionDone,
    stepCount: stepCount,
    dayComplete: dayComplete,
    toggleStep: toggleStep,
    setReflection: setReflection,
    setJourneyFeedback: setJourneyFeedback,
    markSittingOpened: markSittingOpened,
    feedbackUnlocked: feedbackUnlocked,
    feedbackVisible: feedbackVisible,
    dateInZone: dateInZone,
    cohortOffset: cohortOffset,
    cohortPhase: cohortPhase,
    todayIndex: todayIndex,
    dayIsAhead: dayIsAhead,
    cohortStatusText: cohortStatusText,
    initialDay: initialDay,
    safeStorage: safeStorage,
    load: load,
    save: save
  };

  root.OnenessJourneyProgress = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
