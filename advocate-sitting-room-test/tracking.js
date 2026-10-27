/* Affiliate parsing and Sitting Room draft shape for Oneness Wellness. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.SittingTracking = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var STORAGE_KEY = "oneness-sitting-request";
  var STEPS = ["stone", "body", "tried", "shift", "source", "reach", "held"];
  var SENSES = ["Heavy", "Restless", "Tender", "Clear", "Unnamed"];
  var FOUND_OPTIONS = ["A person", "A message", "The calendar", "I looked", "Not sure"];
  var VIA_MAP = {
    person: "A person",
    message: "A message",
    calendar: "The calendar",
    search: "I looked",
    looked: "I looked",
    unsure: "Not sure"
  };
  var REQUEST_KEYS = ["sense", "body", "tried", "shift", "name", "reach", "mode", "note", "referrer", "found"];
  var BOOKING_URL = "https://link.onenesswellnesslifestyles.com/widget/bookings/owlhcentersos";

  function emptyRequest() {
    return {
      sense: "",
      body: "",
      tried: "",
      shift: "",
      name: "",
      reach: "",
      mode: "",
      note: "",
      referrer: "",
      found: ""
    };
  }

  function asText(value) {
    return typeof value === "string" ? value : "";
  }

  function normalizeRequest(partial) {
    var source = partial && typeof partial === "object" ? partial : {};
    var request = emptyRequest();
    for (var i = 0; i < REQUEST_KEYS.length; i += 1) {
      var key = REQUEST_KEYS[i];
      request[key] = asText(source[key]);
    }
    return request;
  }

  function isEmptyRequest(request) {
    var normalized = normalizeRequest(request);
    for (var i = 0; i < REQUEST_KEYS.length; i += 1) {
      if (normalized[REQUEST_KEYS[i]] !== "") return false;
    }
    return true;
  }

  function parseTracking(search) {
    var raw = typeof search === "string" ? search : "";
    var params = new URLSearchParams(raw.charAt(0) === "?" ? raw.slice(1) : raw);
    var referrer = params.get("ref") || params.get("referrer") || params.get("from") || "";
    referrer = referrer.replace(/\s+/g, " ").trim().slice(0, 80);
    var via = (params.get("via") || params.get("how") || "").trim().toLowerCase();
    var found = Object.prototype.hasOwnProperty.call(VIA_MAP, via) ? VIA_MAP[via] : "";
    return { referrer: referrer, found: found };
  }

  function sentByName(referrer) {
    var name = asText(referrer).trim();
    if (!name || name.toLowerCase() === "no one") return "";
    return name;
  }

  function hasProgress(request) {
    var item = normalizeRequest(request);
    return !!(
      item.sense ||
      item.body.trim() ||
      item.tried.trim() ||
      item.shift.trim() ||
      item.name.trim() ||
      item.reach.trim() ||
      item.mode ||
      item.note.trim()
    );
  }

  function resumeStep(request) {
    var item = normalizeRequest(request);
    if (!item.sense && !item.body.trim()) return "body";
    if (!item.tried.trim()) return "tried";
    if (!item.shift.trim()) return "shift";
    if (!item.referrer.trim() || !item.found) return "source";
    if (!item.name.trim() || !item.reach.trim() || !item.mode) return "reach";
    return "held";
  }

  function feltSense(request) {
    var sense = asText(request.sense).trim();
    var body = asText(request.body).trim();
    if (sense && body) return sense + "\n" + body;
    return sense || body;
  }

  function letter(request) {
    var item = normalizeRequest(request);
    var sitting = item.mode === "live" ? "Live" : item.mode === "virtual" ? "Virtual" : "";
    var lines = [
      "Sanctuary Sitting Room",
      "Oneness Wellness Circle Sanctuary",
      "",
      "Name: " + item.name.trim(),
      "Reach: " + item.reach.trim(),
      "Referred by: " + item.referrer.trim(),
      "Found the room: " + item.found.trim(),
      "Sitting: " + sitting
    ];
    var note = item.note.trim();
    if (note) lines.push("Before we sit: " + note);
    lines.push(
      "",
      "How the body feels",
      feltSense(item),
      "",
      "What I have tried",
      item.tried.trim(),
      "",
      "If something shifted, it would mean",
      item.shift.trim()
    );
    return lines.join("\n");
  }

  function readDraft(storage) {
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (typeof parsed.step !== "string" || STEPS.indexOf(parsed.step) === -1) return null;
      if (!parsed.request || typeof parsed.request !== "object") return null;
      return {
        step: parsed.step,
        request: normalizeRequest(parsed.request)
      };
    } catch (error) {
      return null;
    }
  }

  function writeState(storage, state) {
    try {
      var step = state && typeof state.step === "string" ? state.step : "stone";
      var request = normalizeRequest(state && state.request);
      if (step === "stone" && isEmptyRequest(request)) {
        storage.removeItem(STORAGE_KEY);
        return;
      }
      storage.setItem(STORAGE_KEY, JSON.stringify({ step: step, request: request }));
    } catch (error) {
      /* This device may block storage. The room still works for this visit. */
    }
  }

  function initialState(search, storage) {
    var params = parseTracking(search);
    var draft = readDraft(storage);
    if (draft) {
      return {
        step: draft.step,
        request: normalizeRequest({
          sense: draft.request.sense,
          body: draft.request.body,
          tried: draft.request.tried,
          shift: draft.request.shift,
          name: draft.request.name,
          reach: draft.request.reach,
          mode: draft.request.mode,
          note: draft.request.note,
          referrer: params.referrer || draft.request.referrer,
          found: params.found || draft.request.found
        })
      };
    }
    if (params.referrer || params.found) {
      return { step: "stone", request: normalizeRequest(params) };
    }
    return { step: "stone", request: emptyRequest() };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    STEPS: STEPS,
    SENSES: SENSES,
    FOUND_OPTIONS: FOUND_OPTIONS,
    BOOKING_URL: BOOKING_URL,
    emptyRequest: emptyRequest,
    normalizeRequest: normalizeRequest,
    isEmptyRequest: isEmptyRequest,
    parseTracking: parseTracking,
    sentByName: sentByName,
    hasProgress: hasProgress,
    resumeStep: resumeStep,
    letter: letter,
    readDraft: readDraft,
    writeState: writeState,
    initialState: initialState
  };
});
