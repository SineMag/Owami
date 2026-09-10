import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export type User = {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  is_premium?: boolean;
};

export type Ingredient = { name: string; quantity: string; unit: string };
export type Recipe = {
  id: string;
  owner_id: string;
  owner_name?: string;
  title: string;
  description: string;
  image_url: string;
  prep_time: number;
  cook_time: number;
  servings: number;
  difficulty: string;
  category: string;
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];
  likes_count?: number;
};

let TOKEN: string | null = null;

export async function loadToken() {
  TOKEN = await AsyncStorage.getItem("owami_token");
  return TOKEN;
}
export async function setToken(t: string | null) {
  TOKEN = t;
  if (t) await AsyncStorage.setItem("owami_token", t);
  else await AsyncStorage.removeItem("owami_token");
}
export function getToken() {
  return TOKEN;
}

async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      msg = j.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  register: (data: { email: string; password: string; display_name: string }) =>
    req<{ token: string; user: User }>("POST", "/auth/register", data),
  login: (data: { email: string; password: string }) =>
    req<{ token: string; user: User }>("POST", "/auth/login", data),
  me: () => req<User>("GET", "/auth/me"),
  deleteMe: () => req("DELETE", "/auth/me"),

  listRecipes: (q?: string, category?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    return req<Recipe[]>("GET", `/recipes?${p.toString()}`);
  },
  popular: () => req<Recipe[]>("GET", "/recipes/popular"),
  recommended: () => req<Recipe[]>("GET", "/recipes/recommended"),
  getRecipe: (id: string) => req<Recipe>("GET", `/recipes/${id}`),
  createRecipe: (r: Partial<Recipe>) => req<Recipe>("POST", "/recipes", r),
  updateRecipe: (id: string, r: Partial<Recipe>) => req<Recipe>("PUT", `/recipes/${id}`, r),
  deleteRecipe: (id: string) => req("DELETE", `/recipes/${id}`),

  likeToggle: (id: string) => req<{ liked: boolean }>("POST", `/recipes/${id}/like`),
  saveToggle: (id: string) => req<{ saved: boolean }>("POST", `/recipes/${id}/save`),
  myLikes: () => req<Recipe[]>("GET", "/me/likes"),
  mySaves: () => req<Recipe[]>("GET", "/me/saves"),
  myRecipes: () => req<Recipe[]>("GET", "/me/recipes"),
  history: () => req<{ history: any; recipe: Recipe }[]>("GET", "/me/history"),
  recordHistory: (id: string, status: string) =>
    req("POST", `/recipes/${id}/history?status=${status}`),

  subStatus: () => req<{ is_premium: boolean; offerings: any[] }>("GET", "/subscription/status"),
  mockPurchase: () => req<{ is_premium: boolean }>("POST", "/subscription/mock-purchase"),
  restore: () => req<{ is_premium: boolean }>("POST", "/subscription/restore"),
  cancelSub: () => req<{ is_premium: boolean }>("POST", "/subscription/cancel"),

  fromIngredients: (ingredients: string[]) =>
    req<any>("POST", "/ai/from-ingredients", { ingredients }),
  saveGenerated: (r: any) => req<Recipe>("POST", "/ai/save-generated", r),
  ask: (question: string, recipe_id?: string, current_step?: number) =>
    req<{ answer: string }>("POST", "/ai/ask", { question, recipe_id, current_step }),
  scale: (recipe_id: string, servings: number) =>
    req<{ servings: number; ingredients: Ingredient[] }>("POST", "/ai/scale", { recipe_id, servings }),
  substitute: (ingredient: string, recipe_id?: string) =>
    req<{ substitutes: { name: string; note: string }[] }>("POST", "/ai/substitute", { ingredient, recipe_id }),

  categories: () => req<string[]>("GET", "/categories"),
};

export function fileUrl(pathOrUrl?: string) {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (pathOrUrl.startsWith("/api/")) return `${BASE}${pathOrUrl}`;
  return pathOrUrl;
}
