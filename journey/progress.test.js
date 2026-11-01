const assert = require("assert");
const P = require("./progress.js");

function memory() {
  return P.safeStorage({
    getItem: function () { return null; },
    setItem: function () {}
  });
}

assert.strictEqual(P.FEEDBACK_PROMPT, "How did this feel?");
assert.strictEqual(P.storageKey("buyer", "2026-11-09"), "onenessJourney.progress.buyer.2026-11-09");
assert.strictEqual(P.storageKey("advocate", "2026-11-09"), "onenessJourney.progress.advocate.2026-11-09");
assert.strictEqual(P.storageKey("nope", "2026-11-09"), "onenessJourney.progress.buyer.2026-11-09");
assert.strictEqual(P.storageKey("buyer", "next-week"), "onenessJourney.progress.buyer.undated");

assert.strictEqual(P.dateInZone(new Date("2026-11-09T09:59:00Z"), "Pacific/Honolulu"), "2026-11-08");
assert.strictEqual(P.dateInZone(new Date("2026-11-09T10:00:00Z"), "Pacific/Honolulu"), "2026-11-09");
assert.strictEqual(P.dateInZone(new Date("2026-11-14T09:59:00Z"), "Pacific/Honolulu"), "2026-11-13");
assert.strictEqual(P.dateInZone(new Date("2026-11-14T10:00:00Z"), "Pacific/Honolulu"), "2026-11-14");

assert.strictEqual(P.cohortOffset("2026-11-01", "2026-11-09"), -7);
assert.strictEqual(P.cohortOffset("2026-11-08", "2026-11-09"), 0);
assert.strictEqual(P.cohortOffset("2026-11-09", "2026-11-09"), 1);
assert.strictEqual(P.cohortOffset("2026-11-13", "2026-11-09"), 5);
assert.strictEqual(P.cohortOffset("2026-11-14", "2026-11-09"), 6);

assert.strictEqual(P.cohortPhase(-7, 5), "before");
assert.strictEqual(P.cohortPhase(1, 5), "during");
assert.strictEqual(P.cohortPhase(5, 5), "during");
assert.strictEqual(P.cohortPhase(6, 5), "after");
assert.strictEqual(P.todayIndex(-7, 5), 0);
assert.strictEqual(P.todayIndex(3, 5), 3);
assert.strictEqual(P.todayIndex(6, 5), 0);

assert.strictEqual(P.dayIsAhead("before", 4, 0), false);
assert.strictEqual(P.dayIsAhead("during", 3, 3), false);
assert.strictEqual(P.dayIsAhead("during", 2, 3), false);
assert.strictEqual(P.dayIsAhead("during", 4, 3), true);
assert.strictEqual(P.dayIsAhead("after", 2, 0), false);

assert.strictEqual(
  P.cohortStatusText(-7, 5, "7:00 AM", "Hawaii time"),
  "Begins in 8 days, 7:00 AM Hawaii time. Preview any day below."
);
assert.strictEqual(
  P.cohortStatusText(0, 5, "7:00 AM", "Hawaii time"),
  "Begins in 1 day, 7:00 AM Hawaii time. Preview any day below."
);
assert.strictEqual(P.cohortStatusText(3, 5, "7:00 AM", "Hawaii time"), "Today is Day 3 of 5.");
assert.strictEqual(
  P.cohortStatusText(6, 5, "7:00 AM", "Hawaii time"),
  "This cohort has completed. Every day stays open for you."
);

assert.strictEqual(P.initialDay(4, -7, 5), 4);
assert.strictEqual(P.initialDay(0, -7, 5), 1);
assert.strictEqual(P.initialDay(NaN, 3, 5), 3);
assert.strictEqual(P.initialDay(9, 3, 5), 3);
assert.strictEqual(P.initialDay(NaN, 6, 5), 5);

var store = memory();
var buyer = P.emptyRecord("buyer", "2026-11-09");
buyer = P.toggleStep(buyer, 1, "video");
buyer = P.setReflection(buyer, 1, "  Most myself at dawn.  ");
var seen = null;
buyer = P.save(store, buyer, function (rec) { seen = rec; });
assert.strictEqual(seen.days["1"].video, true);
assert.strictEqual(seen.days["1"].reflection, "  Most myself at dawn.  ");
assert.strictEqual(P.reflectionDone(seen.days["1"]), true);
assert.strictEqual(P.dayComplete(P.dayOf(seen, 1)), false);

var again = P.load(store, "buyer", "2026-11-09");
assert.strictEqual(again.days["1"].reflection, "  Most myself at dawn.  ");
assert.strictEqual(again.lane, "buyer");
assert.strictEqual(again.cohortStart, "2026-11-09");

var advocate = P.setReflection(P.emptyRecord("advocate", "2026-11-09"), 1, "Advocate note");
P.save(store, advocate);
assert.strictEqual(P.load(store, "advocate", "2026-11-09").days["1"].reflection, "Advocate note");
assert.strictEqual(P.load(store, "buyer", "2026-11-09").days["1"].reflection, "  Most myself at dawn.  ");

var otherCohort = P.load(store, "buyer", "2027-01-04");
assert.deepStrictEqual(otherCohort.days, {});

var day = P.emptyRecord("buyer", "2026-11-09");
day = P.toggleStep(day, 5, "video");
day = P.toggleStep(day, 5, "workbook");
day = P.toggleStep(day, 5, "evening");
assert.strictEqual(P.feedbackUnlocked(day, 5), false);
day = P.setReflection(day, 5, "First step is a walk, tomorrow morning.");
assert.strictEqual(P.dayComplete(P.dayOf(day, 5)), true);
assert.strictEqual(P.stepCount(P.dayOf(day, 5)), 4);
assert.strictEqual(P.feedbackUnlocked(day, 5), true);

var partial = P.markSittingOpened(P.emptyRecord("buyer", "2026-11-09"));
assert.strictEqual(partial.sittingOpened, true);
assert.strictEqual(P.feedbackUnlocked(partial, 5), true);
assert.strictEqual(P.dayComplete(P.dayOf(partial, 5)), false);

var voice = 'It felt like "home".\nTruly.';
var saved = P.save(store, P.setJourneyFeedback(day, voice));
assert.strictEqual(P.load(store, "buyer", "2026-11-09").journeyFeedback, voice);
assert.strictEqual(saved.journeyFeedback, voice);
assert.strictEqual(P.feedbackVisible(P.setJourneyFeedback(P.emptyRecord("buyer", "2026-11-09"), voice), 5), true);
assert.strictEqual(P.feedbackVisible(P.emptyRecord("buyer", "2026-11-09"), 5), false);

var blank = P.setReflection(P.toggleStep(P.emptyRecord("buyer", "2026-11-09"), 2, "workbook"), 2, "   ");
assert.strictEqual(P.reflectionDone(P.dayOf(blank, 2)), false);
assert.strictEqual(P.stepCount(P.dayOf(blank, 2)), 1);
blank = P.toggleStep(blank, 2, "workbook");
assert.strictEqual(P.dayOf(blank, 2).workbook, false);

var broken = P.safeStorage({
  getItem: function () { return "{"; },
  setItem: function () {}
});
var recovered = P.load(broken, "buyer", "2026-11-09");
assert.strictEqual(recovered.journeyFeedback, "");
assert.deepStrictEqual(recovered.days, {});

var extra = P.parseRecord({
  serverRevision: 7,
  journeyFeedback: "kept",
  sittingOpened: true,
  days: { "1": { video: true, reflection: "yes" }, "0": { video: true } }
}, "advocate", "2026-11-09");
assert.strictEqual(extra.serverRevision, 7);
assert.strictEqual(extra.days["1"].video, true);
assert.strictEqual(extra.days["0"], undefined);
var round = P.save(store, extra);
assert.strictEqual(round.serverRevision, 7);
assert.strictEqual(round.lane, "advocate");

console.log("journey/progress.test.js ok");
