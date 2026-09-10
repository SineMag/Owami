"""Owami backend regression tests — full API sanity + save-generated bug validation."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://cookist-mode.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

FREE_EMAIL = "cook@owami.app"
PREMIUM_EMAIL = "premium@owami.app"
PASSWORD = "owami123"


# ----- helpers -----
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    j = r.json()
    return j["token"], j["user"]


@pytest.fixture(scope="module")
def free_token():
    tok, _ = _login(FREE_EMAIL, PASSWORD)
    return tok


@pytest.fixture(scope="module")
def premium_token():
    # ensure premium is on (mock-purchase idempotent)
    tok, _ = _login(PREMIUM_EMAIL, PASSWORD)
    requests.post(f"{API}/subscription/mock-purchase", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    return tok


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ----- health / auth -----
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True


class TestAuth:
    def test_login_free(self):
        tok, user = _login(FREE_EMAIL, PASSWORD)
        assert tok and user["email"] == FREE_EMAIL

    def test_login_premium(self):
        tok, user = _login(PREMIUM_EMAIL, PASSWORD)
        assert user["email"] == PREMIUM_EMAIL

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": FREE_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me(self, free_token):
        r = requests.get(f"{API}/auth/me", headers=_h(free_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == FREE_EMAIL

    def test_register_and_delete(self):
        email = f"test_{int(time.time())}@owami.app"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "owami123", "display_name": "T"}, timeout=15)
        assert r.status_code == 200
        tok = r.json()["token"]
        d = requests.delete(f"{API}/auth/me", headers=_h(tok), timeout=15)
        assert d.status_code == 200


class TestUpdateMe:
    """PATCH /api/auth/me: display_name, avatar_url, owner_name sync."""

    def test_update_display_name_and_owner_name_sync(self, free_token):
        # get current name to restore later
        me = requests.get(f"{API}/auth/me", headers=_h(free_token), timeout=15).json()
        original = me["display_name"]
        try:
            new_name = "Chef Ada"
            r = requests.patch(f"{API}/auth/me", headers=_h(free_token),
                               json={"display_name": new_name}, timeout=15)
            assert r.status_code == 200, f"patch failed: {r.status_code} {r.text}"
            assert r.json()["display_name"] == new_name

            # verify via GET
            g = requests.get(f"{API}/auth/me", headers=_h(free_token), timeout=15)
            assert g.json()["display_name"] == new_name

            # verify owner_name propagation on user's recipes (create a recipe to test)
            create = requests.post(f"{API}/recipes", headers=_h(free_token), json={
                "title": "TEST_OwnerSync", "description": "d", "image_url": "",
                "prep_time": 1, "cook_time": 1, "servings": 1, "difficulty": "Easy", "category": "Dinner",
                "ingredients": [{"name": "salt", "quantity": "1", "unit": "tsp"}],
                "instructions": ["s1"], "tags": []
            }, timeout=15)
            assert create.status_code == 200
            rid = create.json()["id"]

            # rename again to trigger sync
            new_name2 = "Chef Ada Two"
            r2 = requests.patch(f"{API}/auth/me", headers=_h(free_token),
                                json={"display_name": new_name2}, timeout=15)
            assert r2.status_code == 200

            # check recipe owner_name updated
            rec = requests.get(f"{API}/recipes/{rid}", timeout=15).json()
            assert rec.get("owner_name") == new_name2, f"owner_name not synced: {rec.get('owner_name')}"

            # cleanup created recipe
            requests.delete(f"{API}/recipes/{rid}", headers=_h(free_token), timeout=15)
        finally:
            # restore original display_name
            requests.patch(f"{API}/auth/me", headers=_h(free_token),
                           json={"display_name": original}, timeout=15)

    def test_update_empty_display_name_400(self, free_token):
        r = requests.patch(f"{API}/auth/me", headers=_h(free_token),
                           json={"display_name": "   "}, timeout=15)
        assert r.status_code == 400
        assert "empty" in r.text.lower() or "name" in r.text.lower()

    def test_update_only_avatar_url(self, free_token):
        me = requests.get(f"{API}/auth/me", headers=_h(free_token), timeout=15).json()
        original_avatar = me.get("avatar_url") or ""
        try:
            avatar = "/api/uploads/test_avatar.jpg"
            r = requests.patch(f"{API}/auth/me", headers=_h(free_token),
                               json={"avatar_url": avatar}, timeout=15)
            assert r.status_code == 200
            assert r.json().get("avatar_url") == avatar
            # display_name should NOT be affected
            assert r.json()["display_name"] == me["display_name"]
        finally:
            requests.patch(f"{API}/auth/me", headers=_h(free_token),
                           json={"avatar_url": original_avatar}, timeout=15)

    def test_update_requires_auth(self):
        r = requests.patch(f"{API}/auth/me", json={"display_name": "x"}, timeout=15)
        assert r.status_code in (401, 403)


# ----- recipes / likes / saves / history -----
class TestRecipes:
    def test_list_recipes(self):
        r = requests.get(f"{API}/recipes?limit=50", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 16, f"expected >=16 seeded recipes, got {len(data)}"

    def test_popular(self):
        r = requests.get(f"{API}/recipes/popular", timeout=15)
        assert r.status_code == 200

    def test_recommended(self, free_token):
        r = requests.get(f"{API}/recipes/recommended", headers=_h(free_token), timeout=15)
        assert r.status_code == 200

    def test_get_recipe_and_like_save_history(self, free_token):
        recipes = requests.get(f"{API}/recipes", timeout=15).json()
        rid = recipes[0]["id"]

        r = requests.get(f"{API}/recipes/{rid}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == rid

        # like toggle
        r = requests.post(f"{API}/recipes/{rid}/like", headers=_h(free_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json()["liked"], bool)

        # save toggle
        r = requests.post(f"{API}/recipes/{rid}/save", headers=_h(free_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json()["saved"], bool)

        # history
        r = requests.post(f"{API}/recipes/{rid}/history?status=started", headers=_h(free_token), timeout=15)
        assert r.status_code == 200

        for path in ["likes", "saves", "history", "recipes"]:
            r = requests.get(f"{API}/me/{path}", headers=_h(free_token), timeout=15)
            assert r.status_code == 200, f"/me/{path} failed"

    def test_categories(self):
        r = requests.get(f"{API}/categories", timeout=15)
        assert r.status_code == 200
        assert "Dinner" in r.json()


# ----- subscription -----
class TestSubscription:
    def test_status_free(self, free_token):
        r = requests.get(f"{API}/subscription/status", headers=_h(free_token), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "offerings" in j and len(j["offerings"]) >= 2

    def test_status_premium(self, premium_token):
        r = requests.get(f"{API}/subscription/status", headers=_h(premium_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["is_premium"] is True

    def test_restore(self, premium_token):
        r = requests.post(f"{API}/subscription/restore", headers=_h(premium_token), timeout=15)
        assert r.status_code == 200


# ----- preferences -----
class TestPrefs:
    def test_set_prefs(self, free_token):
        r = requests.put(f"{API}/me/preferences",
                         headers=_h(free_token),
                         json={"diet": ["vegetarian"], "liked_ingredients": ["basil"],
                               "disliked": ["cilantro"], "onboarded": True}, timeout=15)
        assert r.status_code == 200

    def test_set_prefs_with_cuisines_and_skill_level(self):
        """New this iteration: PrefsIn accepts cuisines + skill_level."""
        email = f"test_prefs_{int(time.time())}@owami.app"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "owami123", "display_name": "P"}, timeout=15)
        assert r.status_code == 200
        tok = r.json()["token"]
        try:
            payload = {
                "diet": ["Vegetarian"],
                "cuisines": ["Italian", "Thai"],
                "liked_ingredients": ["Pasta"],
                "disliked": ["peanuts", "cilantro"],
                "skill_level": "intermediate",
                "onboarded": True,
            }
            r = requests.put(f"{API}/me/preferences", headers=_h(tok), json=payload, timeout=15)
            assert r.status_code == 200, f"prefs set failed: {r.status_code} {r.text}"
            body = r.json()
            prefs = body["preferences"]
            assert prefs["diet"] == ["Vegetarian"]
            assert prefs["cuisines"] == ["Italian", "Thai"]
            assert prefs["liked_ingredients"] == ["Pasta"]
            assert prefs["disliked"] == ["peanuts", "cilantro"]
            assert prefs["skill_level"] == "intermediate"
            assert prefs["onboarded"] is True

            # GET /auth/me should reflect the same
            me = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=15).json()
            mp = me["preferences"]
            assert mp["cuisines"] == ["Italian", "Thai"]
            assert mp["skill_level"] == "intermediate"
            assert mp["onboarded"] is True
        finally:
            requests.delete(f"{API}/auth/me", headers=_h(tok), timeout=15)

    def test_set_prefs_defaults_empty_arrays_and_none(self):
        """Skip-all path: empty prefs should default cleanly."""
        email = f"test_prefs_skip_{int(time.time())}@owami.app"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "owami123", "display_name": "S"}, timeout=15)
        assert r.status_code == 200
        tok = r.json()["token"]
        try:
            # send only onboarded=true, everything else defaulted
            r = requests.put(f"{API}/me/preferences", headers=_h(tok),
                             json={"onboarded": True}, timeout=15)
            assert r.status_code == 200
            prefs = r.json()["preferences"]
            assert prefs["diet"] == []
            assert prefs["cuisines"] == []
            assert prefs["liked_ingredients"] == []
            assert prefs["disliked"] == []
            assert prefs["skill_level"] is None
            assert prefs["onboarded"] is True
        finally:
            requests.delete(f"{API}/auth/me", headers=_h(tok), timeout=15)

    def test_register_new_user_not_onboarded(self):
        """Fresh users must have onboarded flag NOT set (or false) so index.tsx redirects to /onboarding."""
        email = f"test_ob_{int(time.time())}@owami.app"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "owami123", "display_name": "N"}, timeout=15)
        assert r.status_code == 200
        tok = r.json()["token"]
        try:
            me = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=15).json()
            # onboarded must be falsy so frontend routes to /onboarding
            assert not me.get("preferences", {}).get("onboarded"), \
                f"fresh user should not be onboarded: {me.get('preferences')}"
        finally:
            requests.delete(f"{API}/auth/me", headers=_h(tok), timeout=15)


# ----- AI (premium gating + save-generated bug) -----
class TestAI:
    def test_from_ingredients_free_402(self, free_token):
        r = requests.post(f"{API}/ai/from-ingredients",
                          headers=_h(free_token),
                          json={"ingredients": ["chicken", "rice"]}, timeout=90)
        assert r.status_code == 402

    def test_from_ingredients_premium_and_save_generated(self, premium_token):
        """CRITICAL: Save-generated must accept Gemini's numeric quantities (bug fix validation)."""
        r = requests.post(f"{API}/ai/from-ingredients",
                          headers=_h(premium_token),
                          json={"ingredients": ["chicken", "tomato", "rice", "onion", "garlic"]},
                          timeout=120)
        assert r.status_code == 200, f"AI generate failed: {r.status_code} {r.text[:400]}"
        gen = r.json()
        assert "title" in gen and "ingredients" in gen and "instructions" in gen

        # Feed the raw AI JSON straight to save-generated (this used to 422 with numeric quantities)
        r2 = requests.post(f"{API}/ai/save-generated",
                           headers=_h(premium_token),
                           json=gen, timeout=30)
        assert r2.status_code == 200, f"save-generated failed (bug NOT fixed): {r2.status_code} {r2.text[:400]}"
        saved = r2.json()
        assert saved.get("id"), "saved recipe missing id"

        # verify persisted
        r3 = requests.get(f"{API}/recipes/{saved['id']}", timeout=15)
        assert r3.status_code == 200
        assert r3.json()["title"] == gen["title"]

    def test_save_generated_with_forced_numeric_quantities(self, premium_token):
        """Regression: send explicit numeric quantities like Gemini would."""
        payload = {
            "title": "TEST_Numeric Qty Recipe",
            "description": "test",
            "prep_time": "10",  # string int
            "cook_time": 20,
            "servings": 2.0,    # float
            "difficulty": "Easy",
            "category": "Dinner",
            "ingredients": [
                {"name": "Chicken", "quantity": 500, "unit": "g"},        # numeric
                {"name": "Rice", "quantity": 1.5, "unit": "cups"},        # float
                {"name": "Salt", "quantity": None, "unit": None},         # nulls
            ],
            "instructions": ["Step one", {"text": "Step two dict"}, 3],
            "tags": ["quick", 5],
        }
        r = requests.post(f"{API}/ai/save-generated",
                          headers=_h(premium_token), json=payload, timeout=15)
        assert r.status_code == 200, f"coercion failed: {r.status_code} {r.text[:400]}"
        j = r.json()
        # ensure coercion worked
        assert isinstance(j["ingredients"][0]["quantity"], str)
        assert isinstance(j["instructions"][0], str)
        assert j["prep_time"] == 10

    def test_ai_ask(self, free_token):
        r = requests.post(f"{API}/ai/ask",
                          headers=_h(free_token),
                          json={"question": "How much salt for 2 servings?"}, timeout=60)
        assert r.status_code == 200
        assert "answer" in r.json() and len(r.json()["answer"]) > 0

    def test_ai_scale_free_402(self, free_token):
        recipes = requests.get(f"{API}/recipes", timeout=15).json()
        r = requests.post(f"{API}/ai/scale",
                          headers=_h(free_token),
                          json={"recipe_id": recipes[0]["id"], "servings": 4}, timeout=30)
        assert r.status_code == 402

    def test_ai_scale_premium(self, premium_token):
        recipes = requests.get(f"{API}/recipes", timeout=15).json()
        r = requests.post(f"{API}/ai/scale",
                          headers=_h(premium_token),
                          json={"recipe_id": recipes[0]["id"], "servings": 4}, timeout=30)
        assert r.status_code == 200
        assert r.json()["servings"] == 4


# ----- Meal Plans -----
class TestMealPlan:
    def test_meal_plan_free_gated(self, free_token):
        r = requests.post(f"{API}/me/meal-plan",
                          headers=_h(free_token),
                          json={"date": "2026-01-15", "slot": "dinner", "recipe_id": "x"}, timeout=15)
        assert r.status_code == 402

    def test_meal_plan_premium_flow(self, premium_token):
        recipes = requests.get(f"{API}/recipes", timeout=15).json()
        rid = recipes[0]["id"]
        # add
        r = requests.post(f"{API}/me/meal-plan",
                          headers=_h(premium_token),
                          json={"date": "2026-01-20", "slot": "lunch", "recipe_id": rid}, timeout=15)
        assert r.status_code == 200
        pid = r.json()["id"]

        # list
        r = requests.get(f"{API}/me/meal-plan", headers=_h(premium_token), timeout=15)
        assert r.status_code == 200
        found = any(p["plan"].get("id") == pid for p in r.json())
        assert found, "added meal plan not in list"

        # delete
        r = requests.delete(f"{API}/me/meal-plan/{pid}", headers=_h(premium_token), timeout=15)
        assert r.status_code == 200

    def test_meal_plan_list_free_ok(self, free_token):
        r = requests.get(f"{API}/me/meal-plan", headers=_h(free_token), timeout=15)
        assert r.status_code == 200  # GET is unrestricted
