/* January 13 invitation href.
   Carries ref and via from the current page when they have a value.
   The path stays relative so a local file and the live site both open the gathering. */
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.gatheringHref = api.gatheringHref;
  }
})(function () {
  function gatheringHref(pageHref) {
    var current = new URL(pageHref);
    var incoming = current.searchParams;
    var forward = new URLSearchParams();
    ["ref", "via"].forEach(function (key) {
      if (!incoming.has(key)) return;
      var value = incoming.get(key);
      if (value == null || String(value).trim() === "") return;
      forward.append(key, value);
    });
    var query = forward.toString();
    var path = current.protocol === "file:" ? "../jan13/index.html" : "../jan13/";
    return path + (query ? "?" + query : "");
  }

  return { gatheringHref: gatheringHref };
});
