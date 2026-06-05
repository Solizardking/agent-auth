import { createClerkCaapMiddleware } from "@clawd/clerk-caap/middleware";

export const middleware = createClerkCaapMiddleware({
  protectedPaths: [/^\/api\/caap\/attest/],
  publicPaths: [
    /^\/$/, // homepage
    /^\/api\/caap\/discovery/,
    /^\/api\/siws\//,    // SIWS challenge+verify are public (self-auth)
    /^\/api\/tee\/report/,
  ],
});

export const config = {
  matcher: ["/api/:path*"],
};
