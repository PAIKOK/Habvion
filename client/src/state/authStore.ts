import { create } from "zustand";
import type { PublicUser } from "@shared/types/user";
import { api } from "../api/client";

type AuthState = {
  user: PublicUser | null;
  status: "loading" | "ready";
  googleClientId: string | null;
  aiProvider: string;
  meshProvider: string;
  contactForwardingEnabled: boolean;
  authCookieName: string;
  refresh: () => Promise<void>;
  signup: (input: { name: string; email: string; password: string; consent: true }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  google: (credential: string, consent?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};
/** Who is signed in. The session itself is an httpOnly cookie the page cannot read. */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  googleClientId: null,
  aiProvider: "unknown",
  meshProvider: "unknown",
  contactForwardingEnabled: false,
  authCookieName: "hb_session",
  async refresh() {
    try {
      const [me, config] = await Promise.all([
        api<{ user: PublicUser | null }>("/auth/me"),
        api<{ googleClientId: string | null; aiProvider: string; meshProvider: string; contactForwardingEnabled: boolean; authCookieName: string }>("/auth/config"),
      ]);
      set({ user: me.user, ...config, status: "ready" });
    } catch {
      set({ user: null, status: "ready" });
    }
  },
  async signup(input) {
    set({ user: (await api<{ user: PublicUser }>("/auth/signup", { body: input })).user });
  },
  async login(input) {
    set({ user: (await api<{ user: PublicUser }>("/auth/login", { body: input })).user });
  },
  async google(credential, consent) {
    set({ user: (await api<{ user: PublicUser }>("/auth/google", { body: { credential, ...(consent ? { consent: true } : {}) } })).user });
  },
  async logout() {
    await api("/auth/logout", { body: {} }).catch(() => {});
    set({ user: null });
  },
}));
/** Only same-site paths may be a post-login destination. */
export const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/start");
