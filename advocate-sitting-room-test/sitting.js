/* Sanctuary Sitting Room request flow. Words stay on this device until the calendar opens. */
(function () {
  if (typeof document === "undefined" || typeof SittingTracking === "undefined") return;

  var track = SittingTracking;

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function field(id, label, options) {
    var opts = options || {};
    var classes = opts.multiline ? "field-input field-area" : "field-input";
    var control = opts.multiline
      ? "<textarea id=\"" + esc(id) + "\" class=\"" + classes + "\" data-field=\"" + esc(id) + "\" data-focus-key=\"" + esc(id) + "\"" +
        (opts.placeholder ? " placeholder=\"" + esc(opts.placeholder) + "\"" : "") +
        (opts.invalid ? " aria-invalid=\"true\"" : "") +
        (opts.describedBy ? " aria-describedby=\"" + esc(opts.describedBy) + "\"" : "") +
        ">" + esc(opts.value || "") + "</textarea>"
      : "<input id=\"" + esc(id) + "\" class=\"" + classes + "\" data-field=\"" + esc(id) + "\" data-focus-key=\"" + esc(id) + "\"" +
        (opts.name ? " name=\"" + esc(opts.name) + "\"" : "") +
        (opts.type ? " type=\"" + esc(opts.type) + "\"" : " type=\"text\"") +
        (opts.maxLength ? " maxlength=\"" + esc(opts.maxLength) + "\"" : "") +
        (opts.autoComplete ? " autocomplete=\"" + esc(opts.autoComplete) + "\"" : "") +
        (opts.placeholder ? " placeholder=\"" + esc(opts.placeholder) + "\"" : "") +
        (opts.invalid ? " aria-invalid=\"true\"" : "") +
        (opts.describedBy ? " aria-describedby=\"" + esc(opts.describedBy) + "\"" : "") +
        " value=\"" + esc(opts.value || "") + "\">";
    var labelClass = opts.hiddenLabel ? "visually-hidden" : "field-label";
    return "<div class=\"field\">" +
      "<label class=\"" + labelClass + "\" for=\"" + esc(id) + "\">" + esc(label) + "</label>" +
      control +
      "</div>";
  }

  function choice(action, value, label, pressed) {
    return "<button type=\"button\" class=\"choice\" data-action=\"" + esc(action) + "\" data-value=\"" + esc(value) + "\" data-focus-key=\"" + esc(action + ":" + value) + "\" aria-pressed=\"" + (pressed ? "true" : "false") + "\">" + esc(label) + "</button>";
  }

  function errorBlock(error) {
    if (!error) return "";
    return "<p id=\"room-error\" class=\"form-error\" role=\"alert\">" + esc(error) + "</p>";
  }

  function releaseBlock(releasing) {
    if (!releasing) {
      return "<button type=\"button\" class=\"btn btn-ghost\" data-action=\"ask-release\" data-focus-key=\"ask-release\">Release these words</button>";
    }
    return "<p class=\"quiet-note\">Release removes these words from this device.</p>" +
      "<button type=\"button\" class=\"btn btn-quiet\" data-action=\"release\" data-focus-key=\"release\">Release these words</button>" +
      "<button type=\"button\" class=\"btn btn-ghost\" data-action=\"keep\" data-focus-key=\"keep\">Keep them</button>";
  }

  function questionShell(index, title, lede, body, error, nextLabel) {
    return "<form class=\"step\" data-step-form=\"true\">" +
      "<button type=\"button\" class=\"back\" data-action=\"back\" data-focus-key=\"back\">Back</button>" +
      "<p class=\"kicker\">Question " + index + " of 5</p>" +
      "<h1 tabindex=\"-1\">" + esc(title) + "</h1>" +
      "<p class=\"lede\">" + esc(lede) + "</p>" +
      "<div class=\"step-body\">" + body + "</div>" +
      errorBlock(error) +
      "<div class=\"actions\">" +
      "<button type=\"submit\" class=\"btn btn-primary\" data-focus-key=\"next\">" + esc(nextLabel || "Continue") + "</button>" +
      "</div></form>";
  }

  function render(state, error, releasing) {
    var request = state.request;
    if (state.step === "stone") {
      var sent = track.sentByName(request.referrer);
      var progress = track.hasProgress(request);
      return "<div class=\"step\">" +
        "<p class=\"kicker\">Oneness Wellness Circle Sanctuary</p>" +
        "<h1 tabindex=\"-1\">Sanctuary Sitting Room</h1>" +
        (sent ? "<p class=\"sent-by\">" + esc(sent) + " sent you.</p>" : "") +
        "<figure class=\"figure\">" +
        "<p class=\"figure-title\">Wholeness Remembered</p>" +
        "<p class=\"figure-line\">Aloha, beloved.</p>" +
        "</figure>" +
        "<div class=\"copy\">" +
        "<p class=\"copy-strong\">The Sanctuary is open. The Circle is not.</p>" +
        "<p class=\"muted\">A public sitting is one hour, in the room or across the water. You come as you are. We sit with what the body already knows.</p>" +
        "<p>First sitting, one hundred dollars. Follow-up, seventy-five. Live or virtual.</p>" +
        "<p class=\"fine\">The Circle stays by invitation, after you have sat. It is not offered here.</p>" +
        "</div>" +
        "<div class=\"actions\">" +
        "<button type=\"button\" class=\"btn btn-primary\" data-action=\"begin\" data-focus-key=\"begin\">" +
        (progress ? "Continue your request" : "Request a sitting") +
        "</button>" +
        (progress
          ? releaseBlock(releasing)
          : "<p class=\"quiet-note\">Nothing is sent from this page until you send the request.</p>") +
        "</div></div>";
    }

    if (state.step === "body") {
      var senses = track.SENSES.map(function (word) {
        return choice("sense", word, word, request.sense === word);
      }).join("");
      var bodyInvalid = !!error && !request.sense && !request.body.trim();
      var bodyFields = "<div class=\"choice-row\" role=\"group\" aria-label=\"A word for the body\">" + senses + "</div>" +
        field("body", "How the body feels, in your own words", {
          multiline: true,
          hiddenLabel: true,
          placeholder: "In your own words",
          value: request.body,
          describedBy: bodyInvalid ? "room-error" : "",
          invalid: bodyInvalid
        });
      return questionShell(
        1,
        "How does the body feel, right now?",
        "Not a diagnosis. The felt sense. A word is enough. A paragraph is welcome.",
        bodyFields,
        error
      );
    }

    if (state.step === "tried") {
      return questionShell(
        2,
        "What have you already tried?",
        "Remedies, practices, people, or nothing. All of it counts.",
        field("tried", "What have you already tried?", {
          multiline: true,
          hiddenLabel: true,
          placeholder: "What you have already given this",
          value: request.tried,
          invalid: !!error,
          describedBy: error ? "room-error" : ""
        }),
        error
      );
    }

    if (state.step === "shift") {
      return questionShell(
        3,
        "If something shifted, what would that mean?",
        "Not a list of goals. What would be different in a day, a breath, a relationship with yourself.",
        field("shift", "If something shifted, what would that mean?", {
          multiline: true,
          hiddenLabel: true,
          placeholder: "What would be different",
          value: request.shift,
          invalid: !!error,
          describedBy: error ? "room-error" : ""
        }),
        error
      );
    }

    if (state.step === "source") {
      var foundButtons = track.FOUND_OPTIONS.map(function (label) {
        return choice("found", label, label, request.found === label);
      }).join("");
      var sourceBody = "<div class=\"stack\">" +
        field("referrer", "Their name", {
          name: "referrer",
          maxLength: "80",
          placeholder: "A name, or No one",
          value: request.referrer,
          invalid: !!error && !request.referrer.trim(),
          describedBy: error && !request.referrer.trim() ? "room-error" : ""
        }) +
        "<fieldset class=\"choice-set\"" + (error && request.referrer.trim() && !request.found ? " aria-invalid=\"true\" aria-describedby=\"room-error\"" : "") + ">" +
        "<legend>How you found this room</legend>" +
        "<div class=\"choice-row\" role=\"group\" aria-label=\"How you found this room\">" + foundButtons + "</div>" +
        "</fieldset></div>";
      return questionShell(
        4,
        "Who sent you?",
        "The name of the person who referred you. If no one did, write No one. Then how you found this room.",
        sourceBody,
        error
      );
    }

    if (state.step === "reach") {
      var reachBody = "<div class=\"stack\">" +
        field("name", "Name", {
          name: "name",
          autoComplete: "name",
          value: request.name,
          invalid: !!error && !request.name.trim(),
          describedBy: error && !request.name.trim() ? "room-error" : ""
        }) +
        field("reach", "A way to reach you", {
          name: "reach",
          autoComplete: "on",
          placeholder: "A number, or the way you already write",
          value: request.reach,
          invalid: !!error && !!request.name.trim() && !request.reach.trim(),
          describedBy: error && request.name.trim() && !request.reach.trim() ? "room-error" : ""
        }) +
        "<fieldset class=\"choice-set\"" + (error && request.name.trim() && request.reach.trim() && !request.mode ? " aria-invalid=\"true\" aria-describedby=\"room-error\"" : "") + ">" +
        "<legend>The sitting</legend>" +
        "<div class=\"choice-row choice-row-pair\" role=\"group\" aria-label=\"The sitting\">" +
        choice("mode", "live", "Live", request.mode === "live") +
        choice("mode", "virtual", "Virtual", request.mode === "virtual") +
        "</div></fieldset>" +
        field("note", "Before we sit", {
          multiline: true,
          placeholder: "Optional. Anything the Sanctuary should know.",
          value: request.note
        }) +
        "</div>";
      return questionShell(
        5,
        "How may we reach you?",
        "The practical part, last. First sitting, one hundred dollars. Follow-up, seventy-five. The hour is chosen on the calendar.",
        reachBody,
        error,
        "Hold this request"
      );
    }

    var heldLetter = track.letter(request);
    return "<div class=\"step\">" +
      "<p class=\"kicker\">Held on this device</p>" +
      "<h1 tabindex=\"-1\">Your request</h1>" +
      "<p class=\"lede\">Send request opens the calendar, so the hour can be booked. Who referred you stays in this request.</p>" +
      "<div class=\"letter\" data-letter>" + esc(heldLetter) + "</div>" +
      "<div class=\"actions\">" +
      "<a class=\"btn btn-primary\" href=\"" + esc(track.BOOKING_URL) + "\">Send request</a>" +
      "<button type=\"button\" class=\"btn btn-quiet\" data-action=\"edit\" data-focus-key=\"edit\">Edit</button>" +
      releaseBlock(releasing) +
      "</div></div>";
  }

  function boot() {
    var stage = document.getElementById("stage");
    if (!stage) return;

    var state = track.initialState(window.location.search, window.localStorage);
    var error = "";
    var releasing = false;
    track.writeState(window.localStorage, state);

    function focusByKey(key) {
      var nodes = stage.querySelectorAll("[data-focus-key]");
      for (var i = 0; i < nodes.length; i += 1) {
        if (nodes[i].getAttribute("data-focus-key") === key) return nodes[i];
      }
      return null;
    }

    function paint(mode) {
      var previous = document.activeElement;
      var key = previous && previous.getAttribute ? previous.getAttribute("data-focus-key") : "";
      var selection = previous && typeof previous.selectionStart === "number" ? previous.selectionStart : null;
      var selectionEnd = previous && typeof previous.selectionEnd === "number" ? previous.selectionEnd : null;
      stage.innerHTML = render(state, error, releasing);
      if (mode === "heading") {
        window.scrollTo(0, 0);
        var heading = stage.querySelector("h1");
        if (heading) heading.focus();
        return;
      }
      if (mode === "key" && key) {
        var target = focusByKey(key);
        if (target) {
          target.focus();
          if (selection != null && target.setSelectionRange) {
            try {
              target.setSelectionRange(selection, selectionEnd == null ? selection : selectionEnd);
            } catch (ignored) {
              /* Some controls do not accept a selection range. */
            }
          }
        }
      }
    }

    function go(step) {
      error = "";
      releasing = false;
      state = { step: step, request: state.request };
      track.writeState(window.localStorage, state);
      paint("heading");
    }

    function updateRequest(partial) {
      error = "";
      state = {
        step: state.step,
        request: track.normalizeRequest(Object.assign({}, state.request, partial))
      };
      track.writeState(window.localStorage, state);
    }

    function onNext() {
      var request = state.request;
      if (state.step === "body") {
        if (!request.sense && !request.body.trim()) {
          error = "A few words about the body are enough.";
          paint("key");
          return;
        }
        go("tried");
        return;
      }
      if (state.step === "tried") {
        if (!request.tried.trim()) {
          error = "Name what you have tried, even if it is nothing.";
          paint("key");
          return;
        }
        go("shift");
        return;
      }
      if (state.step === "shift") {
        if (!request.shift.trim()) {
          error = "Say what a shift would mean, even in one sentence.";
          paint("key");
          return;
        }
        go("source");
        return;
      }
      if (state.step === "source") {
        if (!request.referrer.trim()) {
          error = "A name, or No one.";
          paint("key");
          return;
        }
        if (!request.found) {
          error = "How you found this room.";
          paint("key");
          return;
        }
        go("reach");
        return;
      }
      if (state.step === "reach") {
        if (!request.name.trim()) {
          error = "Your name, so we know who is asking.";
          paint("key");
          return;
        }
        if (!request.reach.trim()) {
          error = "A way to reach you.";
          paint("key");
          return;
        }
        if (!request.mode) {
          error = "Live, or across the water.";
          paint("key");
          return;
        }
        go("held");
      }
    }

    function onBack() {
      var previous = {
        body: "stone",
        tried: "body",
        shift: "tried",
        source: "shift",
        reach: "source"
      };
      if (previous[state.step]) go(previous[state.step]);
    }

    stage.addEventListener("click", function (event) {
      var button = event.target.closest("[data-action]");
      if (!button || !stage.contains(button)) return;
      var action = button.getAttribute("data-action");
      var value = button.getAttribute("data-value") || "";
      if (action === "begin") {
        go(track.hasProgress(state.request) ? track.resumeStep(state.request) : "body");
        return;
      }
      if (action === "back") {
        onBack();
        return;
      }
      if (action === "sense") {
        updateRequest({ sense: state.request.sense === value ? "" : value });
        paint("key");
        return;
      }
      if (action === "found") {
        updateRequest({ found: value });
        paint("key");
        return;
      }
      if (action === "mode") {
        updateRequest({ mode: value });
        paint("key");
        return;
      }
      if (action === "ask-release") {
        releasing = true;
        paint("key");
        var releaseButton = focusByKey("release");
        if (releaseButton) releaseButton.focus();
        return;
      }
      if (action === "keep") {
        releasing = false;
        paint("key");
        return;
      }
      if (action === "release") {
        var params = track.parseTracking(window.location.search);
        state = { step: "stone", request: track.normalizeRequest(params) };
        error = "";
        releasing = false;
        track.writeState(window.localStorage, state);
        paint("heading");
        return;
      }
      if (action === "edit") {
        go("body");
      }
    });

    stage.addEventListener("input", function (event) {
      var input = event.target;
      var name = input.getAttribute("data-field");
      if (!name) return;
      var partial = {};
      partial[name] = input.value;
      updateRequest(partial);
      var alert = stage.querySelector("#room-error");
      if (alert) alert.remove();
      if (input.getAttribute("aria-invalid") === "true") input.removeAttribute("aria-invalid");
    });

    stage.addEventListener("submit", function (event) {
      if (!event.target.closest("[data-step-form]")) return;
      event.preventDefault();
      onNext();
    });

    paint("heading");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
