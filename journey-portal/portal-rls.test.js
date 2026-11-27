const assert = require("assert");
const fs = require("fs");
const path = require("path");
const access = require("./portal-access");

const root = path.join(__dirname, "..");
const sql = fs.readFileSync(path.join(root, "supabase/migrations/20261127010000_journey_portal.sql"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "portal.js"), "utf8");
const config = fs.readFileSync(path.join(__dirname, "auth-config.js"), "utf8");

const tables = [
  "portal_profiles",
  "portal_editions",
  "portal_scans",
  "portal_readings",
  "portal_summaries",
  "portal_letters",
  "portal_sleep_logs",
  "portal_reminder_prefs",
  "portal_intake_events"
];

tables.forEach(function (table) {
  assert.ok(sql.includes("alter table public." + table + " enable row level security"), table);
  assert.ok(sql.includes("revoke all on table public." + table + " from public, anon, authenticated"), table);
});

assert.ok(sql.includes("status = 'approved'"));
assert.ok(sql.includes("shifa@shifaali-scott.com"));
assert.ok(sql.includes("revoke all on function public.portal_record_intake(text, jsonb) from public, anon, authenticated"));
assert.ok(!/grant execute on function public\.portal_record_intake/i.test(sql));
assert.ok(!/service_role/i.test(sql + page + config));
assert.ok(client.includes("/service_role/i.test"));
assert.ok(page.includes("shouldCreateUser: false") || client.includes("shouldCreateUser: false"));
assert.ok(!page.includes("signUp(") && !client.includes("signUp("));
assert.ok(page.includes("For education and awareness only, never medical advice or diagnosis."));
assert.ok(page.includes("We Are Healing Together, Wholeness Remembered"));
assert.ok(page.includes("Highest Love, Clan Mother Shifa Ali"));
assert.ok((page + client).includes("https://link.onenesswellnesslifestyles.com/widget/booking/GqDRwjfFbCG26t5FDfsy"));
assert.ok(!page.includes("\u2014") && !client.includes("\u2014"));
assert.ok(!/\bapp\b/i.test(page.replace(/<[^>]+>/g, " ")));

const clientA = { userId: "aaaa", email: "a@example.com", role: "client" };
const clientB = { userId: "bbbb", email: "b@example.com", role: "client" };
const shifa = { userId: "shifa", email: "shifa@shifaali-scott.com", role: "client" };
const editionA = { id: "ed-a", client_user_id: "aaaa", client_email: "a@example.com" };
const editionB = { id: "ed-b", client_user_id: "bbbb", client_email: "b@example.com" };
const editions = [editionA, editionB];
const summaries = [
  { id: "s1", edition_id: "ed-a", status: "draft", title: "Draft notes", body: "Not yet." },
  { id: "s2", edition_id: "ed-a", status: "approved", title: "Approved notes", body: "Visible." },
  { id: "s3", edition_id: "ed-b", status: "approved", title: "Other client", body: "Private." }
];

assert.deepStrictEqual(access.visibleEditions(clientA, editions).map(function (e) { return e.id; }), ["ed-a"]);
assert.deepStrictEqual(access.visibleEditions(clientB, editions).map(function (e) { return e.id; }), ["ed-b"]);
assert.deepStrictEqual(access.visibleEditions(null, editions), []);
assert.strictEqual(access.screenFor(shifa, null), "admin");
assert.strictEqual(access.screenFor({ userId: "admin-2", email: "other@example.com", role: "admin" }, null), "admin");
assert.strictEqual(access.screenFor(clientA, null), "missing");
assert.strictEqual(access.screenFor(clientA, editionA), "client");
assert.ok(client.indexOf("access.isAdmin") < client.indexOf("No edition yet"));
assert.ok(client.includes('if (!edition && !admin)'));
assert.deepStrictEqual(
  access.visibleSummaries(clientA, summaries, editions).map(function (s) { return s.id; }),
  ["s2"]
);
assert.deepStrictEqual(
  access.visibleSummaries(shifa, summaries, editions).map(function (s) { return s.id; }).sort(),
  ["s1", "s2", "s3"]
);
assert.strictEqual(access.canReadSummary(clientA, summaries[0], editionA), false);
assert.strictEqual(access.canReadSummary(clientB, summaries[1], editionA), false);

const scans = [
  { scanned_on: "2026-01-01", categories: [{ name: "Rest", raw: 30, optimized: 70 }] },
  { scanned_on: "2026-02-01", categories: [{ name: "Rest", raw: 50, optimized: 70 }] }
];
assert.ok(access.progressLines(scans)[0].indexOf("moved in the direction") >= 0);
assert.strictEqual(access.timeline(summaries, [], []).length, 2);

console.log("journey portal access checks ok");
