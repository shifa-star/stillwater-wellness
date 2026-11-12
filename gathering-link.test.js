const assert = require("assert");
const fs = require("fs");
const { gatheringHref } = require("./oneness-lifestyles-app/gathering-link");

function resolved(pageHref) {
  return new URL(gatheringHref(pageHref), pageHref);
}

function paramsOf(pageHref) {
  return resolved(pageHref).searchParams;
}

const live = "https://app.onenesswellnesslifestyles.com/oneness-lifestyles-app/?ref=Miniimah&via=person";
const liveUrl = resolved(live);
assert.strictEqual(liveUrl.origin, "https://app.onenesswellnesslifestyles.com");
assert.strictEqual(liveUrl.pathname, "/jan13/");
assert.strictEqual(liveUrl.search, "?ref=Miniimah&via=person");
assert.strictEqual(liveUrl.hash, "");

const indexPage = "https://app.onenesswellnesslifestyles.com/oneness-lifestyles-app/index.html?ref=Miniimah&via=person";
assert.strictEqual(resolved(indexPage).pathname, "/jan13/");
assert.strictEqual(resolved(indexPage).search, "?ref=Miniimah&via=person");

const refOnly = "https://app.onenesswellnesslifestyles.com/oneness-lifestyles-app/?ref=Miniimah";
assert.strictEqual(resolved(refOnly).pathname, "/jan13/");
assert.strictEqual(resolved(refOnly).search, "?ref=Miniimah");
assert.strictEqual(paramsOf(refOnly).has("via"), false);

const viaOnly = "https://app.onenesswellnesslifestyles.com/oneness-lifestyles-app/?via=person";
assert.strictEqual(resolved(viaOnly).search, "?via=person");
assert.strictEqual(paramsOf(viaOnly).has("ref"), false);

const bare = "https://app.onenesswellnesslifestyles.com/oneness-lifestyles-app/";
assert.strictEqual(resolved(bare).href, "https://app.onenesswellnesslifestyles.com/jan13/");
assert.strictEqual(gatheringHref(bare), "../jan13/");

const extra = "https://app.onenesswellnesslifestyles.com/oneness-lifestyles-app/?ref=Miniimah&via=person&room=circle&from=elsewhere";
const extraParams = paramsOf(extra);
assert.strictEqual(extraParams.get("ref"), "Miniimah");
assert.strictEqual(extraParams.get("via"), "person");
assert.strictEqual(extraParams.has("room"), false);
assert.strictEqual(extraParams.has("from"), false);
assert.strictEqual([...extraParams.keys()].join(","), "ref,via");

const blankRef = "https://app.onenesswellnesslifestyles.com/oneness-lifestyles-app/?ref=%20%20&via=person";
assert.strictEqual(resolved(blankRef).search, "?via=person");

const spaced = "https://app.onenesswellnesslifestyles.com/oneness-lifestyles-app/?ref=A%20B&via=person";
assert.strictEqual(paramsOf(spaced).get("ref"), "A B");
assert.strictEqual(paramsOf(spaced).get("via"), "person");

const nested = "https://shifa-star.github.io/stillwater-wellness/oneness-lifestyles-app/?ref=Rita&via=person";
assert.strictEqual(resolved(nested).pathname, "/stillwater-wellness/jan13/");
assert.strictEqual(resolved(nested).search, "?ref=Rita&via=person");

const filePage = "file:///tmp/stillwater-wellness/oneness-lifestyles-app/index.html?ref=Miniimah&via=person&room=circle#top";
const fileUrl = resolved(filePage);
assert.strictEqual(fileUrl.protocol, "file:");
assert.strictEqual(fileUrl.pathname, "/tmp/stillwater-wellness/jan13/index.html");
assert.strictEqual(fileUrl.search, "?ref=Miniimah&via=person");
assert.strictEqual(fileUrl.hash, "");

[live, indexPage, refOnly, viaOnly, bare, extra, blankRef, spaced, nested, filePage].forEach(function (pageHref) {
  const href = resolved(pageHref).href;
  assert.ok(!/test/i.test(href), href);
  assert.ok(!href.includes("Miniimah") || pageHref.includes("Miniimah"), href);
});

assert.strictEqual(gatheringHref("https://app.onenesswellnesslifestyles.com/oneness-lifestyles-app/"), "../jan13/");
assert.ok(!gatheringHref(bare).includes("Miniimah"));

const guest = fs.readFileSync("oneness-lifestyles-app/index.html", "utf8");
assert.ok(guest.includes("Quantum Frequency Therapy + The Magic of Five Minutes"));
assert.ok(guest.includes("Wednesday, January 13, 2027. Virtual."));
assert.ok(guest.includes("Hosts: Clan Mother Shifa Ali Scott and Miniimah Saafir."));
assert.ok(guest.includes("We Are Healing Together, Wholeness Remembered"));
assert.ok(guest.includes('id="jan13-invite" href="../jan13/"'));
assert.ok(guest.includes(">I'll Be There</a>"));
assert.ok(guest.includes('src="gathering-link.js"'));
assert.ok(guest.includes('params.get("ref") || params.get("referrer") || params.get("from")'));
assert.ok(guest.includes('name + " sent you."'));
assert.ok(!/test/i.test(guest));
assert.ok(!/w-9|commission|warm-up|practitioner council|affiliate|summit/i.test(guest));

const builder = fs.readFileSync("oneness-lifestyles-app/gathering-link.js", "utf8");
assert.ok(!/test/i.test(builder));

const root = fs.readFileSync("index.html", "utf8");
assert.ok(!root.includes("jan13"));
assert.ok(!root.includes("I'll Be There"));

const jan13 = fs.readFileSync("jan13/index.html", "utf8");
assert.ok(jan13.includes('var REGISTRATION_ENDPOINT = "https://onenesswellnesslifestyles.app.n8n.cloud/webhook/jan13-registration";'));
assert.ok(jan13.includes('id="draft-note" hidden'));
assert.ok(!jan13.includes("This preview shows the page. Registrations will be collected once it is live."));
assert.ok(!/webhook\/[^"']*test/i.test(jan13));

console.log("gathering link checks ok");
