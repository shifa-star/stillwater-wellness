/* statement-bank.js — Nia statement bank & certification link.
   Owner: U-15. Clearly-labeled places waiting for Mz. Felicia's blessed
   daily statement bank and certification link.

   Shape:
     DAILY_STATEMENTS — the gentle statements the Nia ritual asks, one at a
                        time. Each entry is a short sentence as a string.
                        Waiting for Mz. Felicia's blessed words. The ritual
                        already renders without this; when these fill, the
                        ritual shows them.
     CERTIFICATION_URL — the link to Mz. Felicia's certification, shown in
                        the ritual. Operator fills the certification link
                        before launch. Empty until then. */

window.NIA_STATEMENTS = {
  // ---- Daily statement bank -------------------------------------------
  // Waiting for Mz. Felicia's blessed words.
  // Drop each statement in as its own string, one gentle line at a time.
  // Example shape (delete the example when Mz. Felicia's list lands):
  //   'Today I choose to be gentle with myself.',
  DAILY_STATEMENTS: [],

  // ---- Certification link ---------------------------------------------
  // Operator fills the certification link. A calm default shows until then.
  CERTIFICATION_URL: ''
};
