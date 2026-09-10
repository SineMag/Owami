# Owami — Product Requirements Document (MVP)

## Product
**Owami** is a personal digital cookbook and cooking companion.
Tagline: *Save recipes, create meals, and cook hands-free.*

## Target Platform
- Expo React Native (SDK 57), iOS + Android + Web preview
- Backend: FastAPI + MongoDB + Emergent Object Storage
- AI: Gemini 3 Flash via Emergent Universal Key
- Subscription: Local premium entitlement stub (RevenueCat-ready architecture)

## Users
- **Home cooks** who want a warm, personal cookbook and a hands-free assistant while cooking.
- Free vs Owami+ premium tiers.

## MVP Features Shipped
### Auth
- Register, login, /me, delete account. JWT + bcrypt.
- Seeded test users: `cook@owami.app` / `owami123` (free) and `premium@owami.app` / `owami123` (premium).

### Cookbook
- 16 seeded autumn-themed recipes across breakfast/lunch/dinner/dessert/snack.
- CRUD recipes (title, description, image URL, prep/cook/servings/difficulty/category, ingredients, instructions).
- Like/save/history toggles.

### Discover
- Search by title/ingredient/description/tag.
- Category chips (All / Breakfast / Lunch / Dinner / Dessert / Snack / Vegetarian / Quick).
- 2-column recipe grid.

### Cookist Mode (differentiator)
- Large-typography step-by-step instructions.
- Prev / Repeat / Next controls with haptics.
- Inline countdown timer + "Set 5 min timer" shortcut.
- "Ask Owami" text input powered by Gemini (fallback intents: next/previous/repeat/timer).
- Records cooking history on start & complete.

### AI (Premium)
- **What's in my kitchen?** — enter ingredients, get a full recipe (title, ingredients, missing ingredients, steps, tags).
- **Recipe scaling** — deterministic quantity scaling to N servings.
- **Ingredient substitutions** — LLM-powered.
- Free users are redirected to paywall (402 on backend).

### Paywall & Subscription
- Native full-bleed autumn paywall with feature list, plan toggle (Monthly / Yearly), Subscribe, Restore, Terms, Privacy.
- Local mock-purchase flips `is_premium` flag (drop-in for real RevenueCat SDK).

### Profile & Settings
- Stats (Recipes / Saved / Cooked).
- Notifications, Voice, Dietary, Privacy, Terms, Restore, Sign out, Delete account.

## Design
- Autumn kitchen palette: `#FDFBF7` cream · `#2D1E19` espresso · `#C04A2C` terracotta · `#DE8F42` golden · `#3E2723` chestnut inverse.
- Bottom tabs: Home · Discover · Create · Cookbook · Profile.
- Cookist Mode uses inverse (chestnut) background for high contrast.

## Deferred / Native-build required
- Real STT/TTS (Android SpeechRecognizer / Expo speech-recognition). Preview uses text input.
- Real RevenueCat purchase flow (requires signed Android build & store SKUs).
- Push notifications (Emergent-managed, requires build + Firebase key).

## Deliverables
- Backend: `/app/backend/server.py` (auth, recipes, likes, saves, history, AI, subscription, uploads).
- Frontend: `/app/frontend/app/*` (welcome, auth, tabs, recipe detail, cookist, paywall, policy).
- Test credentials: `/app/memory/test_credentials.md`.
