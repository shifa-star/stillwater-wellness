/* Visibility rules for the Sanctuary client portal.
   These mirror the row policies. The database still enforces them.
   A signed-out person and a client never receive another client's rows. */
(function (root) {
  "use strict";

  var ADMIN_EMAIL = "shifa@shifaali-scott.com";

  function isAdmin(viewer) {
    if (!viewer || !viewer.userId) return false;
    if (String(viewer.email || "").trim().toLowerCase() === ADMIN_EMAIL) return true;
    return viewer.role === "admin";
  }

  function screenFor(viewer, edition) {
    if (isAdmin(viewer)) return "admin";
    if (!edition) return "missing";
    return "client";
  }

  function ownsEdition(viewer, edition) {
    if (!viewer || !viewer.userId || !edition) return false;
    return edition.client_user_id === viewer.userId;
  }

  function canReadEdition(viewer, edition) {
    if (!viewer || !viewer.userId || !edition) return false;
    return isAdmin(viewer) || ownsEdition(viewer, edition);
  }

  function canReadSummary(viewer, summary, edition) {
    if (!canReadEdition(viewer, edition) || !summary) return false;
    if (isAdmin(viewer)) return true;
    return summary.status === "approved";
  }

  function visibleEditions(viewer, editions) {
    return (editions || []).filter(function (edition) {
      return canReadEdition(viewer, edition);
    });
  }

  function visibleSummaries(viewer, summaries, editions) {
    var byId = {};
    (editions || []).forEach(function (edition) { byId[edition.id] = edition; });
    return (summaries || []).filter(function (summary) {
      return canReadSummary(viewer, summary, byId[summary.edition_id]);
    });
  }

  function progressLines(scans) {
    var ordered = (scans || []).slice().sort(function (a, b) {
      return String(a.scanned_on).localeCompare(String(b.scanned_on));
    });
    if (ordered.length < 2) {
      return ["When a second scan arrives, this page will say what moved, in plain words."];
    }
    var older = categoriesOf(ordered[ordered.length - 2]);
    var newer = categoriesOf(ordered[ordered.length - 1]);
    var names = Object.keys(newer);
    Object.keys(older).forEach(function (name) {
      if (names.indexOf(name) < 0) names.push(name);
    });
    if (!names.length) return ["These scans do not list areas yet."];
    return names.map(function (name) {
      var prev = older[name];
      var next = newer[name];
      if (!prev || !next || typeof prev.raw !== "number" || typeof next.raw !== "number") {
        return name + " is present, and the next scan will make the change easier to see.";
      }
      if (next.raw === prev.raw) return name + " held steady.";
      var toward = typeof next.optimized === "number"
        ? Math.abs(next.optimized - next.raw) < Math.abs(next.optimized - prev.raw)
        : next.raw > prev.raw;
      if (toward) return name + " moved in the direction of the optimized reading.";
      return name + " asks for another look.";
    });
  }

  function categoriesOf(scan) {
    var map = {};
    var list = scan && Array.isArray(scan.categories) ? scan.categories : [];
    list.forEach(function (item) {
      if (item && item.name) map[String(item.name)] = item;
    });
    return map;
  }

  function timeline(summaries, scans, sleepLogs) {
    var items = [];
    (summaries || []).forEach(function (row) {
      if (row.status !== "approved") return;
      items.push({ at: row.reviewed_at || row.created_at, kind: "summary", title: row.title, text: row.body });
    });
    (scans || []).forEach(function (row) {
      items.push({ at: row.scanned_on, kind: "scan", title: row.title || "Scan", text: "A scan was added for " + row.scanned_on + "." });
    });
    (sleepLogs || []).forEach(function (row) {
      items.push({ at: row.logged_on || row.created_at, kind: "retest", title: row.item, text: row.response });
    });
    items.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    return items;
  }

  var api = {
    ADMIN_EMAIL: ADMIN_EMAIL,
    isAdmin: isAdmin,
    screenFor: screenFor,
    canReadEdition: canReadEdition,
    canReadSummary: canReadSummary,
    visibleEditions: visibleEditions,
    visibleSummaries: visibleSummaries,
    progressLines: progressLines,
    timeline: timeline
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  root.OnenessPortalAccess = api;
})(typeof window !== "undefined" ? window : globalThis);
