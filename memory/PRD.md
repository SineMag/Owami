# Owami — PRD (v1.1)

## v1.1 Additions (Voice + Onboarding + Photo Upload + Meal Plan)

### Voice On Device (Cookist Mode)
- Web Speech API integration (`src/voice/webVoice.ts`) — STT + TTS work in Chrome/Edge/Safari on the web preview.
- Cookist Mode now has:
  - Mic button (auto-fills the Ask box, executes intents, and speaks reply)
  - Speaker toggle (volume icon in top bar) — auto-speaks each step as it changes
  - Intent parser: next / previous / repeat / pause / resume / "timer for N minutes" / free-form questions (routed to Gemini via `/api/ai/ask`)
- Native (Expo Go): mic falls back to text input with a hint "Full hands-free voice unlocks in the Android build" — architecture is ready to drop in `expo-speech-recognition` + Emergent OpenAI TTS on native build.

### Onboarding Taste Quiz
- 3-step quiz screen at `/onboarding`, shown right after registration (and to any user without `preferences.onboarded=true`).
- Steps: diet chips → favorite ingredients chips → dislikes free-text.
- Saved via `PUT /api/me/preferences`. Skippable.
- Recommendations backend already reads `likes` + `saves` + `tags` — the prefs enrich recommendation fallback and feed the AI generator.

### Photo Upload (Create Recipe)
- Uses `expo-image-picker` with proper permission handshake (getPermissions → requestPermissions → linking hint on deny).
- Two entry points: **Choose photo** (library) and **Take photo** (camera).
- Uploads to backend `/api/upload` (Emergent Object Storage), preview shown with upload progress overlay, remove button, and error copy on failure.
- `app.json` declares `expo-image-picker` plugin with iOS/Android usage strings.

### Weekly Meal Plan (Owami+)
- New backend endpoints:
  - `GET /api/me/meal-plan` — list current user's plan entries with hydrated recipe
  - `POST /api/me/meal-plan` — upsert (date+slot unique per user); 402 for free users
  - `DELETE /api/me/meal-plan/{id}` — remove entry
- New screen `/meal-plan` with a 7-day grid (Today / Tomorrow / +5 dates), 3 slots per day (Breakfast / Lunch / Dinner).
- Tap an empty slot → bottom-sheet recipe picker; tap an item to open the recipe; × to remove.
- Free-user variant shows an inline upgrade card.
- Access from Cookbook top-right "Meal plan" pill.

## Test Credentials
Reset on this checkpoint:
- **cook@owami.app / owami123** (free, onboarded=true)
- **premium@owami.app / owami123** (Owami+, onboarded=true)
