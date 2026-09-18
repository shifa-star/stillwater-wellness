/* galactic-signature.js — the daily five-line Galactic Signature reading.
   Data source: "8-Moon-Year Pocket Calendar" (13 Moon Almanac), pages 18-19.
   Every value below is verified against the almanac's own worked examples
   (Kin 229 on p3, Kin 114 and Kin 11 in the p20 prose) and the p18/p20
   printed tables — nothing is invented.
   Formula (Shifa's words, from the almanac pages 18-19):
     I [A] in order to [B]
     [C] [D]
     I seal the [E] of [F]
     With the [G] tone of [H]
     I am guided by [guide]  — see guideFor() below
   Letters: A = tone's Creative Power, B = seal's Power,
   C = tone's Action, D = seal's Action, E = seal's Essence,
   F = seal's Element, G = tone's Name, H = tone's Function. */
(function () {
  'use strict';

  // The 20 seals, 1-20 (as printed on p19).
  var SEALS = [
    { name: 'Red Dragon', power: 'Nurture', action: 'Being', essence: 'Input', element: 'Birth' },
    { name: 'White Wind', power: 'Communicate', action: 'Breath', essence: 'Input', element: 'Spirit' },
    { name: 'Blue Night', power: 'Dream', action: 'Intuition', essence: 'Input', element: 'Abundance' },
    { name: 'Yellow Seed', power: 'Target', action: 'Awareness', essence: 'Input', element: 'Flowering' },
    { name: 'Red Serpent', power: 'Survive', action: 'Instinct', essence: 'Store', element: 'Life Force' },
    { name: 'White World-Bridger', power: 'Equalize', action: 'Opportunity', essence: 'Store', element: 'Death' },
    { name: 'Blue Hand', power: 'Know', action: 'Healing', essence: 'Store', element: 'Accomplishment' },
    { name: 'Yellow Star', power: 'Beautify', action: 'Art', essence: 'Store', element: 'Elegance' },
    { name: 'Red Moon', power: 'Purify', action: 'Flow', essence: 'Process', element: 'Universal Water' },
    { name: 'White Dog', power: 'Love', action: 'Loyalty', essence: 'Process', element: 'Heart' },
    { name: 'Blue Monkey', power: 'Play', action: 'Illusion', essence: 'Process', element: 'Magic' },
    { name: 'Yellow Human', power: 'Influence', action: 'Wisdom', essence: 'Process', element: 'Free Will' },
    { name: 'Red Skywalker', power: 'Explore', action: 'Wakefulness', essence: 'Output', element: 'Space' },
    { name: 'White Wizard', power: 'Enchant', action: 'Receptivity', essence: 'Output', element: 'Timelessness' },
    { name: 'Blue Eagle', power: 'Create', action: 'Mind', essence: 'Output', element: 'Vision' },
    { name: 'Yellow Warrior', power: 'Question', action: 'Fearlessness', essence: 'Output', element: 'Intelligence' },
    { name: 'Red Earth', power: 'Evolve', action: 'Synchronicity', essence: 'Matrix', element: 'Navigation' },
    { name: 'White Mirror', power: 'Reflect', action: 'Order', essence: 'Matrix', element: 'Endlessness' },
    { name: 'Blue Storm', power: 'Catalyze', action: 'Energy', essence: 'Matrix', element: 'Self-Generation' },
    { name: 'Yellow Sun', power: 'Enlighten', action: 'Life', essence: 'Matrix', element: 'Universal Fire' }
  ];

  // The 13 tones, 1-13 (as printed on p18).
  var TONES = [
    { name: 'Magnetic', creative: 'Unify', action: 'Attracting', function: 'Purpose' },
    { name: 'Lunar', creative: 'Polarize', action: 'Stabilizing', function: 'Challenge' },
    { name: 'Electric', creative: 'Activate', action: 'Bonding', function: 'Service' },
    { name: 'Self-Existing', creative: 'Define', action: 'Measuring', function: 'Form' },
    { name: 'Overtone', creative: 'Empower', action: 'Commanding', function: 'Radiance' },
    { name: 'Rhythmic', creative: 'Organize', action: 'Balancing', function: 'Equality' },
    { name: 'Resonant', creative: 'Channel', action: 'Inspiring', function: 'Attunement' },
    { name: 'Galactic', creative: 'Harmonize', action: 'Modeling', function: 'Integrity' },
    { name: 'Solar', creative: 'Pulse', action: 'Realizing', function: 'Intention' },
    { name: 'Planetary', creative: 'Perfect', action: 'Producing', function: 'Manifestation' },
    { name: 'Spectral', creative: 'Dissolve', action: 'Releasing', function: 'Liberation' },
    { name: 'Crystal', creative: 'Dedicate', action: 'Universalizing', function: 'Cooperation' },
    { name: 'Cosmic', creative: 'Endure', action: 'Transcending', function: 'Presence' }
  ];

  /* The Guide Table from p20 — decoded from the table's own vector glyphs.
     The table's columns group the tones by family (each column header
     carries a Maya-numeral tone set), and every guide is the same tone as
     the kin. The rule, verified glyph-by-glyph on rows 1 and 20 and against
     the p20 prose examples (Kin 114 -> White Wind; Kin 229 -> Red Skywalker;
     Kin 11 -> own power doubled), is a fixed seal offset per tone family:

       tones 1, 6, 11  -> guide = the kin's own seal (own power doubled)
       tones 2, 7, 12  -> seal + 12
       tones 3, 8, 13  -> seal + 4
       tones 4, 9      -> seal + 16
       tones 5, 10     -> seal + 8

     (offsets mod 20, wrapping at 20). GUIDE_TABLE[seal - 1][tone - 1] below
     stores the guide for the tones that have one; the 1/6/11 column holds 0
     for "own power doubled" and guideFor() never consults it. */
  var GUIDE_TABLE = (function () {
    // Offset by tone family: 0 = own power doubled.
    var FAMILY_OFFSET = [0, 12, 4, 16, 8];
    function familyOf(tone) {
      if (tone === 1 || tone === 6 || tone === 11) return 0;
      if (tone === 2 || tone === 7 || tone === 12) return 1;
      if (tone === 3 || tone === 8 || tone === 13) return 2;
      if (tone === 4 || tone === 9) return 3;
      return 4; // tones 5 and 10
    }
    var table = [];
    for (var seal = 1; seal <= 20; seal++) {
      var row = [];
      for (var tone = 1; tone <= 13; tone++) {
        var offset = FAMILY_OFFSET[familyOf(tone)];
        row.push(offset === 0 ? 0 : ((seal - 1 + offset) % 20) + 1);
      }
      table.push(row);
    }
    return table;
  })();

  // Anchor: July 26, 2026 = Kin 229 (the almanac's own practice date, p17).
  // Kin advances 1 per day; the 260-kin cycle wraps (Aug 27 = Kin 1).
  function dayNumber(d) {
    var anchor = Date.UTC(2026, 6, 26);
    var target = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((target - anchor) / 86400000);
  }
  function kinOf(d) { return ((229 - 1 + dayNumber(d)) % 260) + 1; }

  // The guide. Same tone as the kin, different seal — unless the tone is
  // Magnetic (1), Rhythmic (6) or Spectral (11): then the kin is guided by
  // its own power doubled.
  function guideFor(seal, tone) {
    return GUIDE_TABLE[seal - 1][tone - 1];
  }

  // The five lines for a calendar date.
  function readingOf(d) {
    var kin = kinOf(d);
    var seal = ((kin - 1) % 20) + 1;
    var tone = ((kin - 1) % 13) + 1;
    var s = SEALS[seal - 1];
    var t = TONES[tone - 1];
    var g = guideFor(seal, tone);
    var guideLine;
    if (g === 0 || g === seal) {
      // Tones 1, 6, 11 — and any table cell that names the kin's own seal —
      // are the kin's own power doubled. The almanac spells this line out
      // ("its own power doubled") without a seal name.
      guideLine = 'I am guided by my own power doubled.';
    } else {
      guideLine = 'I am guided by the power of ' + SEALS[g - 1].element + '.';
    }
    return {
      kin: kin,
      seal: s.name,
      tone: t.name,
      signature: s.name.split(' ')[0] + ' ' + t.name + ' ' + s.name.split(' ').slice(1).join(' '),
      guideSeal: g === 0 ? null : SEALS[g - 1].name,
      lines: [
        'I ' + t.creative + ' in order to ' + s.power + '.',
        t.action + ' ' + s.action + '.',
        'I seal the ' + s.essence + ' of ' + s.element + '.',
        'With the ' + t.name + ' tone of ' + t.function + '.',
        guideLine
      ]
    };
  }

  window.GalacticSignature = { kinOf: kinOf, readingOf: readingOf };
})();
