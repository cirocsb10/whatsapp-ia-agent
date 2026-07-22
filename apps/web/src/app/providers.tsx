"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, type AuthUser } from "@/contexts/auth-context";
import { QueryProvider } from "@/shared/api/query-provider";
import { WebVitals } from "@/shared/monitoring/web-vitals";
import { Toaster } from "@/shared/ui/Toaster";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function Providers({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}) {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <QueryProvider>
        <AuthProvider initialUser={initialUser}>
          <WebVitals />
          {children}
          <Toaster />
        </AuthProvider>
      </QueryProvider>
    </GoogleOAuthProvider>
  );
}
