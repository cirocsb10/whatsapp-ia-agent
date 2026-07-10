"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/contexts/auth-context";
import { QueryProvider } from "@/shared/api/query-provider";
import { WebVitals } from "@/shared/monitoring/web-vitals";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <QueryProvider>
        <AuthProvider>
          <WebVitals />
          {children}
        </AuthProvider>
      </QueryProvider>
    </GoogleOAuthProvider>
  );
}
