import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/setup/(.*)",
  "/overview(.*)",
  "/analytics(.*)",
  "/catalog(.*)",
  "/inbox(.*)",
  "/orders(.*)",
  "/agent(.*)",
  "/settings(.*)",
  "/support(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
