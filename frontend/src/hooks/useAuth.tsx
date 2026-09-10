import React, { createContext, useContext, useEffect, useState } from "react";
import { api, loadToken, setToken, User } from "@/src/api/client";

type Ctx = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const t = await loadToken();
      if (t) {
        const u = await api.me();
        setUser(u);
      } else setUser(null);
    } catch {
      await setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const signIn = async (email: string, password: string) => {
    const { token, user: u } = await api.login({ email: email.trim().toLowerCase(), password });
    await setToken(token);
    setUser(u);
  };
  const signUp = async (email: string, password: string, display_name: string) => {
    const { token, user: u } = await api.register({ email: email.trim().toLowerCase(), password, display_name });
    await setToken(token);
    setUser(u);
  };
  const signOut = async () => {
    await setToken(null);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, refresh, signIn, signUp, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
