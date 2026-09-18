/* config.js — Oneness Lifestyles app configuration (single, labeled place).
   Owner: U-04 (Gateway contract). Operator-fillable values live here so no
   address or passcode is ever embedded in a page.

   Shape:
     GATEWAY_URL   — n8n knowledge-base gateway address for the Daily
                     Attunement Reading (U-03). Operator fills before launch.
     NIA_PASSCODE  — passcode Mz. Felicia gives her active clients for Nia's
                     daily check-in (U-12). Operator fills before launch. */

window.APP_CONFIG = {
  GATEWAY_URL: '',     // n8n knowledge-base gateway (U-03/U-04)
  NIA_PASSCODE: '',     // Nia gate passcode (U-12; fill before launch)
  STORAGE_KEY: 'oneness.daily-attunement.v1'  // localStorage key for the last reading (U-03)
};
