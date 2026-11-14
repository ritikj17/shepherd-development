"use client";

import * as React from "react";

import { isSupabaseConfigured } from "@/lib/api/config";
import { registerApiTokenProvider } from "@/lib/api/client";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const DEMO_SESSION_KEY = "shepherd.demo.session.v1";

export const DEMO_CREDENTIALS = {
  email: "demo@shepherd.app",
  password: "DemoUser123!",
  displayName: "Demo User",
} as const;

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  isDemo: boolean;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface DemoSession {
  displayName: string;
  email: string;
  createdAt: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  isDemoSession: boolean;
  authConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    displayName: string;
    email: string;
    password: string;
  }) => Promise<{ requiresConfirmation: boolean }>;
  signOut: (options?: { global?: boolean }) => Promise<void>;
  enterDemo: (displayName?: string) => void;
  updateDisplayName: (displayName: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const DEMO_COOKIE_NAME = "shepherd_demo_session";

function setDemoCookie(enabled: boolean) {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.cookie = `${DEMO_COOKIE_NAME}=1; path=/; max-age=86400; SameSite=Lax`;
  } else {
    document.cookie = `${DEMO_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  }
}

function readDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) {
      setDemoCookie(false);
      return null;
    }
    const parsed = JSON.parse(raw) as DemoSession;
    if (!parsed?.displayName) {
      setDemoCookie(false);
      return null;
    }
    setDemoCookie(true);
    return parsed;
  } catch {
    return null;
  }
}

function writeDemoSession(session: DemoSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
      setDemoCookie(true);
    } else {
      window.localStorage.removeItem(DEMO_SESSION_KEY);
      setDemoCookie(false);
    }
  } catch {
    // Non-fatal: the demo session simply will not persist across reloads.
  }
}

function mapSupabaseUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): AuthUser {
  const metadataName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : undefined;
  const email = user.email ?? "unknown@example.test";
  return {
    id: user.id,
    email,
    displayName: metadataName || email.split("@")[0] || "SHEPHERD user",
    isDemo: false,
  };
}

export function mapAuthErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "That email and password combination is not correct.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirm your email address before signing in. Check your inbox for the confirmation link.";
  }
  if (normalized.includes("user already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (normalized.includes("password should be")) {
    return "Choose a stronger password (at least 8 characters).";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (normalized.includes("signup is disabled")) {
    return "Sign-ups are currently disabled for this project.";
  }
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isDemoSession, setIsDemoSession] = React.useState(false);

  React.useEffect(() => {
    registerApiTokenProvider(async () => {
      // If a demo session is active, provide the gated mock token for the in-memory backend adapter
      const demo = readDemoSession();
      if (demo) {
        return "mock-user-demo";
      }

      const supabase = getBrowserSupabaseClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          return data.session.access_token;
        }
      }
      // For unauthenticated local development demo mode when Supabase is unconfigured,
      // provide the gated mock token for the in-memory backend adapter.
      if (!isSupabaseConfigured) {
        return "mock-user-demo";
      }
      return null;
    });
  }, []);

  React.useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      // The demo session lives in localStorage, so it can only be restored after
      // mount. Doing this in an effect avoids a server/client hydration mismatch.
      /* eslint-disable react-hooks/set-state-in-effect */
      const demo = readDemoSession();
      if (demo) {
        setUser({
          id: "demo-user",
          email: demo.email,
          displayName: demo.displayName,
          isDemo: true,
        });
        setIsDemoSession(true);
        setStatus("authenticated");
      } else {
        setUser(null);
        setIsDemoSession(false);
        setStatus("unauthenticated");
      }
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.user) {
        setUser(mapSupabaseUser(data.session.user));
        setStatus("authenticated");
      } else {
        const demo = readDemoSession();
        if (demo) {
          setUser({
            id: "demo-user",
            email: demo.email,
            displayName: demo.displayName,
            isDemo: true,
          });
          setIsDemoSession(true);
          setStatus("authenticated");
        } else {
          setUser(null);
          setStatus("unauthenticated");
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setUser(mapSupabaseUser(session.user));
        setStatus("authenticated");
      } else {
        const demo = readDemoSession();
        if (demo) {
          setUser({
            id: "demo-user",
            email: demo.email,
            displayName: demo.displayName,
            isDemo: true,
          });
          setIsDemoSession(true);
          setStatus("authenticated");
        } else {
          setUser(null);
          setStatus("unauthenticated");
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const enterDemo = React.useCallback((displayName?: string) => {
    const session: DemoSession = {
      displayName: displayName?.trim() || "Demo User",
      email: "demo@shepherd.app",
      createdAt: new Date().toISOString(),
    };
    writeDemoSession(session);
    setUser({
      id: "demo-user",
      email: session.email,
      displayName: session.displayName,
      isDemo: true,
    });
    setIsDemoSession(true);
    setStatus("authenticated");
  }, []);

  const signIn = React.useCallback(
    async (email: string, password: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      // Allow default demo testing credentials in all environments
      if (
        (normalizedEmail === "demo@shepherd.app" ||
          normalizedEmail === "demo@shepherd.local" ||
          normalizedEmail === "demo@example.com") &&
        (password === "DemoUser123!" || password === "demo1234")
      ) {
        enterDemo("Demo User");
        return;
      }

      const supabase = getBrowserSupabaseClient();
      if (!supabase) {
        throw new Error(
          "Supabase authentication is not configured. Use the demo testing account (demo@shepherd.app / DemoUser123!) or add the Supabase environment variables.",
        );
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(mapAuthErrorMessage(error.message));
    },
    [enterDemo],
  );

  const signUp = React.useCallback(
    async (input: { displayName: string; email: string; password: string }) => {
      const normalizedEmail = input.email.trim().toLowerCase();
      if (
        normalizedEmail === "demo@shepherd.app" ||
        normalizedEmail === "demo@shepherd.local" ||
        normalizedEmail === "demo@example.com"
      ) {
        enterDemo(input.displayName || "Demo User");
        return { requiresConfirmation: false };
      }

      const supabase = getBrowserSupabaseClient();
      if (!supabase) {
        throw new Error(
          "Supabase authentication is not configured. Use the demo workspace or add the Supabase environment variables.",
        );
      }
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { display_name: input.displayName } },
      });
      if (error) throw new Error(mapAuthErrorMessage(error.message));
      return { requiresConfirmation: !data.session };
    },
    [enterDemo],
  );

  const signOut = React.useCallback(async (options?: { global?: boolean }) => {
    const supabase = getBrowserSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut({ scope: options?.global ? "global" : "local" });
    }
    writeDemoSession(null);
    setUser(null);
    setIsDemoSession(false);
    setStatus("unauthenticated");
  }, []);

  const updateDisplayName = React.useCallback(
    async (displayName: string) => {
      const supabase = getBrowserSupabaseClient();
      if (supabase && user && !user.isDemo) {
        const { error } = await supabase.auth.updateUser({
          data: { display_name: displayName },
        });
        if (error) throw new Error(mapAuthErrorMessage(error.message));
        setUser({ ...user, displayName });
        return;
      }

      const demo = readDemoSession();
      if (demo) {
        writeDemoSession({ ...demo, displayName });
      }
      setUser((current) =>
        current ? { ...current, displayName } : current,
      );
    },
    [user],
  );

  const requestPasswordReset = React.useCallback(async (email: string) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      throw new Error(
        "Supabase authentication is not configured, so password reset is unavailable.",
      );
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : undefined,
    });
    if (error) throw new Error(mapAuthErrorMessage(error.message));
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isDemoSession,
      authConfigured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      enterDemo,
      updateDisplayName,
      requestPasswordReset,
    }),
    [
      status,
      user,
      isDemoSession,
      signIn,
      signUp,
      signOut,
      enterDemo,
      updateDisplayName,
      requestPasswordReset,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
