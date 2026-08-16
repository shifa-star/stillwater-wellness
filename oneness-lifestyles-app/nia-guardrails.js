/* ===== U-14 NIA GUARDRAILS — pre-filter, before any AI =====
 *
 * The non-negotiable from Mz. Felicia's handoff brief. This module runs
 * BEFORE anything in Nia's ritual. Crisis and medical keyword checks fire
 * first, with FIXED caring replies. No generation, ever — no AI call, no
 * fetch, no randomness. A deterministic pre-filter.
 *
 * It is the door, not a wall: a care verdict routes the person to the care
 * screen; a clean verdict lets the ritual proceed. It never teaches the
 * shift method. It never promises an outcome.
 *
 * Usage (the ritual page loads this BEFORE its own script):
 *   <script src="nia-guardrails.js"></script>
 *   ...
 *   var verdict = window.NIA_GUARDRAILS.check(word, sessionState);
 *   if (verdict.route === 'care') { show the care screen; stop. }
 *
 * Verdict shape returned by check(text, state):
 *   {
 *     route: 'care' | 'ritual',          // where the person should go
 *     kind: 'crisis' | 'medical' | 'session' | 'clean',
 *     handledBy: 'keyword' | 'session' | null,
 *     matched: { crisis: [words], medical: [words] },
 *     reply: '',                          // the FIXED caring text when care
 *     nextState: { careHeld: true } | null  // feed back as the session state
 *   }
 *
 * The keyword lists below are the operator start-set. They are intentionally
 * conservative — a safe false positive (a calm care screen) is far better
 * than a missed one. Expand with Mz. Felicia's blessing only.
 */
(function (global) {
  'use strict';

  if (global.NIA_GUARDRAILS) {
    return;
  }

  // ---- Keyword lists (operator-adjustable, labeled) ----
  // Crisis words: carried feelings that deserve a caring hand, not a check-in.
  var CRISIS_WORDS = [
    'suicide',
    'suicidal',
    'kill myself',
    'killing myself',
    'hurt myself',
    'hurting myself',
    'self harm',
    'selfharm',
    'end my life',
    'ending my life',
    'end it all',
    'no reason to live',
    'nothing to live for',
    'not worth living',
    'want to die',
    'wish i was dead',
    'better off dead',
    'want to disappear',
    'dont want to be here',
    'cant go on',
    'cant take it',
    'give up',
    'giving up',
    'hopeless'
  ];

  // Medical words: physical concerns that must never be spiritualized. They
  // route out kindly, to a health professional and a trusted person.
  var MEDICAL_WORDS = [
    'chest pain',
    'cant breathe',
    'short of breath',
    'bleeding',
    'wont stop bleeding',
    'overdose',
    'seizure',
    'seizing',
    'stroke',
    'heart attack',
    'passing out',
    'passed out',
    'fainted',
    'unconscious',
    'choking',
    'suffocating',
    'poisoned',
    'abdominal pain',
    'high fever',
    'severe pain',
    'cancer',
    'tumor'
  ];

  var KEYWORDS = {
    CRISIS: CRISIS_WORDS,
    MEDICAL: MEDICAL_WORDS
  };

  // ---- Fixed caring replies (never generated, never diagnostic) ----
  // Each is an array of short lines, in the calm wave-like rhythm. No ALL
  // CAPS, no emojis, no exclamation points, no outcome promises.
  var REPLIES = {
    CRISIS: [
      'What you are carrying matters,',
      'and you are not alone.',
      'This moment asks for more than a check-in can hold.',
      'Please reach out to someone you trust,',
      'or a crisis line near you.',
      'You are worth that care.'
    ],
    MEDICAL: [
      'Thank you for telling me what you feel.',
      'This asks for a caring hand, not a check-in.',
      'Please reach out to a health professional',
      'or someone you trust, soon.',
      'You are worth that gentle care.'
    ],
    SESSION: [
      'You are already held with care in this moment.',
      'The check-in will wait until you feel ready.',
      'Please keep reaching out to someone you trust.',
      'You are not alone.'
    ]
  };

  // ---- Words of the ritual (defines terms, never the method) ----
  // PUD and the sway are taught live by Mz. Felicia. Nia holds the ritual;
  // the shift method stays with her. No teaching of it, ever.
  var TERMS = {
    'Zip up': 'Gathering the self. Settled feet, a soft spine, a quiet breath.',
    'Calibrate': 'Finding how your body answers today, fresh each session.',
    'Retest': 'Asking the settled statements, and reading the body\'s quiet reply.',
    'Close': 'The gentle end, carrying the day\'s thread with you.',
    'PUD': 'Taught live by Mz. Felicia. Nia holds the ritual; the method stays with her.',
    'The sway': 'Taught live by Mz. Felicia. Nia holds the ritual; the method stays with her.'
  };

  // ---- Matching helpers ----
  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[‘’ʼ]/g, "'")   // curly apostrophes to straight
      .replace(/'/g, '')                         // drop apostrophes (cant, dont)
      .replace(/["“”]/g, '')           // drop double quotes
      .replace(/[‐―−-]/g, ' ')    // dashes and hyphens to spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeRegExp(term) {
    return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Phrases match as substrings; single words match whole-word only, so a
  // word like "die" never fires inside "diesel". Conservative either way.
  function termIn(term, clean) {
    if (term.indexOf(' ') !== -1) {
      return clean.indexOf(term) !== -1;
    }
    var re = new RegExp('(^|[^a-z])' + escapeRegExp(term) + '([^a-z]|$)');
    return re.test(clean);
  }

  function findMatches(clean, list) {
    var found = [];
    for (var i = 0; i < list.length; i++) {
      if (termIn(list[i], clean)) {
        found.push(list[i]);
      }
    }
    return found;
  }

  // ---- The check: the pre-filter ----
  // Deterministic. Runs on the typed word and the session state, before any
  // generation could happen.
  function check(text, state) {
    // 1. Session state first: once a care verdict is held, the ritual does
    //    not quietly continue. The fixed session reply holds the space.
    if (state && state.careHeld === true) {
      return {
        route: 'care',
        kind: 'session',
        handledBy: 'session',
        matched: { crisis: [], medical: [] },
        reply: REPLIES.SESSION.join('\n'),
        nextState: { careHeld: true }
      };
    }

    var clean = normalize(text);

    if (clean === '') {
      return {
        route: 'ritual',
        kind: 'clean',
        handledBy: null,
        matched: { crisis: [], medical: [] },
        reply: '',
        nextState: null
      };
    }

    var crisis = findMatches(clean, CRISIS_WORDS);
    var medical = findMatches(clean, MEDICAL_WORDS);

    if (crisis.length || medical.length) {
      // Crisis words outrank medical words when both appear — the most
      // urgent care need comes first. Both match lists are still returned.
      var kind = crisis.length ? 'crisis' : 'medical';
      return {
        route: 'care',
        kind: kind,
        handledBy: 'keyword',
        matched: { crisis: crisis, medical: medical },
        reply: (kind === 'crisis' ? REPLIES.CRISIS : REPLIES.MEDICAL).join('\n'),
        nextState: { careHeld: true }
      };
    }

    return {
      route: 'ritual',
      kind: 'clean',
      handledBy: null,
      matched: { crisis: [], medical: [] },
      reply: '',
      nextState: null
    };
  }

  // ---- Public API ----
  global.NIA_GUARDRAILS = {
    VERSION: '1.0.0',

    // keyword lists (the guardrail words)
    CRISIS_WORDS: CRISIS_WORDS,
    MEDICAL_WORDS: MEDICAL_WORDS,
    KEYWORDS: KEYWORDS,

    // fixed caring reply strings (arrays of lines; join to display)
    REPLIES: REPLIES,

    // words of the ritual — definitions only, never the method
    TERMS: TERMS,

    // check(input, sessionState) -> verdict. The single gate the ritual calls.
    check: check,

    // helpers, for operators and tests
    containsCrisis: function (text) {
      return findMatches(normalize(text), CRISIS_WORDS).length > 0;
    },
    containsMedical: function (text) {
      return findMatches(normalize(text), MEDICAL_WORDS).length > 0;
    },
    matches: function (text) {
      var clean = normalize(text);
      return {
        crisis: findMatches(clean, CRISIS_WORDS),
        medical: findMatches(clean, MEDICAL_WORDS)
      };
    }
  };
})(typeof window !== 'undefined' ? window : this);
