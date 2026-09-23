# RevenueCat — integrated (2026-02-10)

This file serves as memory for any later interaction with the user's RevenueCat account via the integration proxy.

## Identifiers (from /setup response — copy verbatim)
- rc_project_id: proj369db34b
- apple_app_id: appd10127c831
- play_app_id: appbcda73ad0e
- entitlement_lookup_key: pro
- offering_lookup_key: default
- Packages (package -> product_id, current price):
  - $rc_monthly -> prod99af514522   ($9.99 / P1M, trial: none)
  - $rc_annual  -> prodb10f8fa856   ($15.99 / P1Y, trial: none)
- Dashboard: https://app.revenuecat.com/projects/proj369db34b

## Status check
Check for project_state in RevenueCat status api response. If project_state is less than project_created, re-fetch the RevenueCat playbook via the integration expert tool.
```
curl -sS -H "Authorization: Bearer sk-emergent-4D6832f56Ae1aC23e1" \
  "$INTEGRATION_PROXY_URL/internal/revenuecat/projects/5e35e45a-d558-4b67-b329-5cb61445f977/status"
```
→ `{"connection_state":"connected","project_state":"...","rc_project_id":"proj369db34b"}`

## Later updates (integration proxy APIs ONLY — NEVER call the RevenueCat REST API)
- Change price/duration/trial OR add a package (upsert):
  ```
  POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/5e35e45a-d558-4b67-b329-5cb61445f977/products
  body: {"products":[{"package":"$rc_monthly","price":14.99,"currency":"USD",
        "period":"P1M","trial":"P1W",
        "prices":[{"amount_micros":14990000,"currency":"USD"}]}]}
  ```
  (amount_micros = price × 1,000,000; omit "trial" for none)
- Remove a package:
  ```
  DELETE $INTEGRATION_PROXY_URL/internal/revenuecat/projects/5e35e45a-d558-4b67-b329-5cb61445f977/products/%24rc_monthly
  ```
  ($ → %24)
- Recover identifiers / repopulate .env: re-run the idempotent /setup call.

## Taking in-app purchases LIVE — store-side steps (USER does these — agent cannot verify or perform)
Needed ONLY for REAL purchases in published store builds. Test Store (Expo Go / web preview / dev build) needs none of this.

- Step 1 — Upload store credentials to RevenueCat dashboard (Home → project → Apps → App name)
  - iOS: In-app purchase key + App Store Connect API key
  - Android: Google Play service-account credentials JSON
- Step 2 — Set up payment profiles for the app in App Store Connect and Play Console
- Step 3 — Create matching in-app purchase products in App Store Connect and Google Play using the SAME product IDs shown in the RevenueCat dashboard (e.g. pro.monthly, pro.annual)
- Step 4 — Make a release build, test IAP with test users via TestFlight / Play internal testing, then submit for review.

All the steps needed to integrate RevenueCat in the production app are also present in the FAQ section of the payments panel.

## Front-end code map
- SDK init + hook: `/app/frontend/src/lib/revenuecat.tsx`
- Identity binder: `/app/frontend/src/components/revenuecat-identity-binder.tsx` (calls `Purchases.logIn(user.id)` on every auth change)
- Root layout wiring: `/app/frontend/app/_layout.tsx` (initializeRevenueCat + SubscriptionProvider + RevenueCatIdentityBinder)
- Paywall: `/app/frontend/app/paywall.tsx` — `RevenueCatUI.Paywall` on native, coded fallback on web using RevenueCat offerings/packages
- Customer Center: opened from Profile › "Manage subscription" via `RevenueCatUI.presentCustomerCenter()` on native
- Gates: `isSubscribed` from `useSubscription()` used in create/from-ingredients and meal-plan

## Env vars written
- EXPO_PUBLIC_REVENUECAT_TEST_API_KEY (live; used on web + __DEV__)
- EXPO_PUBLIC_REVENUECAT_IOS_API_KEY (live; iOS release builds)
- EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY (live; Android release builds)
