import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { clearToken, currentUser, type User } from "@/src/api";
import { registerForPush } from "@/src/push";

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  ready: false,
  setUser: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    currentUser()
      .then(setUser)
      .finally(() => setReady(true));
  }, []);

  // Her uygulama açılışında / giriş yapıldığında push kaydı (token rotasyonu için güvenli upsert).
  useEffect(() => {
    if (user?.user_id) registerForPush(user.user_id);
  }, [user?.user_id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      setUser,
      logout: async () => {
        await clearToken();
        setUser(null);
      },
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
