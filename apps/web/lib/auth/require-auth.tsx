"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { FullPageLoader } from "@/components/shared/full-page-loader";
import { useAuth } from "@/lib/auth/auth-provider";

/**
 * Client-side route guard. This is a UX guard only; the Core API and Supabase
 * RLS remain the authorization boundary.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      const next = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/login?next=${next}`);
    }
  }, [status, router, pathname]);

  if (status === "loading") {
    return <FullPageLoader label="Restoring your session" />;
  }

  if (status === "unauthenticated") {
    return <FullPageLoader label="Redirecting to sign in" />;
  }

  return <>{children}</>;
}
