const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const redirect = require("./sitting-room-legacy-redirect");

function loc(pathname, search, hash) {
  return { pathname: pathname, search: search || "", hash: hash || "" };
}

const cases = [
  [loc("/advocate-sitting-room-test/", "?ref=Test&via=person", "#stage"), "/?ref=Test&via=person#stage"],
  [loc("/advocate-sitting-room-test", "?ref=Anton&via=person", ""), "/?ref=Anton&via=person"],
  [loc("/advocate-sitting-room-test/index.html", "?ref=Theresa&via=person", "#held"), "/?ref=Theresa&via=person#held"],
  [loc("/advocate-sitting-room-test/INDEX.HTML", "?ref=Rita&via=person", ""), "/?ref=Rita&via=person"],
  [loc("/advocate-sitting-room-test/The_Roadmap_to_Wholeness.pdf", "?ref=Test&via=person", ""), "/The_Roadmap_to_Wholeness.pdf?ref=Test&via=person"],
  [loc("/advocate-sitting-room-test/og.jpg", "", ""), "/og.jpg"],
  [loc("/advocate-sitting-room-test/styles.css", "?v=1", "#x"), "/styles.css?v=1#x"],
  [loc("/stillwater-wellness/advocate-sitting-room-test/", "?ref=Wanda&via=person", "#room"), "/stillwater-wellness/?ref=Wanda&via=person#room"],
  [loc("/stillwater-wellness/advocate-sitting-room-test/sitting.js", "", ""), "/stillwater-wellness/sitting.js"],
  [loc("/stillwater-wellness/advocate-sitting-room-test/index.html", "?via=person&ref=Floyd", ""), "/stillwater-wellness/?via=person&ref=Floyd"],
  [loc("/", "?ref=Test&via=person", ""), ""],
  [loc("/breathe.html", "", ""), ""],
  [loc("/advocate-sitting-room-test-extra/", "?ref=Test", ""), ""],
  [loc("/advocate-sitting-room-test//evil.example", "", ""), ""]
];

cases.forEach(function (entry) {
  const actual = redirect.targetFromLocation(entry[0]);
  assert.strictEqual(actual, entry[1], JSON.stringify(entry[0]) + " -> " + actual);
});

const rootIndex = fs.readFileSync("index.html", "utf8");
assert.ok(rootIndex.includes('<link rel="canonical" href="https://app.onenesswellnesslifestyles.com/">'));
assert.ok(rootIndex.includes('<meta property="og:url" content="https://app.onenesswellnesslifestyles.com/">'));
assert.ok(rootIndex.includes('<meta property="og:image" content="https://app.onenesswellnesslifestyles.com/og.jpg">'));
assert.ok(rootIndex.includes('<meta name="twitter:image" content="https://app.onenesswellnesslifestyles.com/og.jpg">'));
assert.ok(rootIndex.includes('src="instagram/cards/breathe_logo.png"'));
assert.ok(!rootIndex.includes("advocate-sitting-room-test"));
assert.ok(!rootIndex.includes("github.io"));
assert.ok(!rootIndex.includes("http-equiv"));
assert.ok(!rootIndex.includes("../instagram"));

const script = fs.readFileSync("sitting-room-legacy-redirect.js", "utf8").trim();
["404.html", "advocate-sitting-room-test/index.html"].forEach(function (file) {
  const html = fs.readFileSync(file, "utf8");
  assert.ok(html.includes(script), file + " is missing the redirect script");
});

const legacy = fs.readFileSync("advocate-sitting-room-test/index.html", "utf8");
assert.ok(legacy.includes('<meta property="og:url" content="https://app.onenesswellnesslifestyles.com/">'));
assert.ok(legacy.includes('<link rel="canonical" href="https://app.onenesswellnesslifestyles.com/">'));
assert.ok(legacy.includes("https://app.onenesswellnesslifestyles.com/og.jpg"));
assert.ok(!legacy.includes("url=advocate-sitting-room-test"));
assert.ok(!legacy.includes("github.io"));

["breathe.html", "move.html", "rest.html", "meditate.html", "visualize.html", "nourish.html"].forEach(function (file) {
  const html = fs.readFileSync(file, "utf8");
  assert.ok(html.includes('href="stillwater.css"'), file);
  assert.ok(!html.includes('href="styles.css"'), file);
});

assert.ok(fs.readFileSync("styles.css", "utf8").includes("--deep-blue"));
assert.ok(fs.readFileSync("stillwater.css", "utf8").includes("Stillwater Wellness"));

["styles.css", "sitting.js", "tracking.js", "favicon.svg", "icon.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest", "og.jpg"].forEach(function (file) {
  const rootHash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const oldHash = crypto.createHash("sha256").update(fs.readFileSync(path.join("advocate-sitting-room-test", file))).digest("hex");
  assert.strictEqual(oldHash, rootHash, file + " drifted from the root copy");
});

const pdf = fs.readFileSync("The_Roadmap_to_Wholeness.pdf");
assert.ok(pdf.slice(0, 5).toString() === "%PDF-");
assert.ok(!fs.existsSync("advocate-sitting-room-test/The_Roadmap_to_Wholeness.pdf"));

console.log("sitting room root checks ok");
