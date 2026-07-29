import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "programtrack-super-secret-jwt-key-2026-development-hub";

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Allow static files, Next internal routes, public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get("programtrack_session");
  let isAuthenticated = false;
  let userRole: string | null = null;

  if (sessionCookie?.value) {
    try {
      const secretKey = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(sessionCookie.value, secretKey);
      isAuthenticated = true;
      userRole = (payload.role as string) || null;
    } catch {
      isAuthenticated = false;
    }
  }

  const isLoginPage = pathname === "/login";
  const isApiAuthRoute = pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/logout");

  // Allow login API routes
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // If visiting /login with explicit logout/clear/unauthorized query param, clear cookie and stay on login
  if (isLoginPage && (searchParams.has("logout") || searchParams.has("clear") || searchParams.has("unauthorized"))) {
    const response = NextResponse.next();
    response.cookies.delete("programtrack_session");
    return response;
  }

  // If authenticated and visiting /login, redirect to /programs
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/programs", req.url));
  }

  // If unauthenticated and trying to access protected routes/pages
  if (!isAuthenticated && !isLoginPage) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", req.url);
    const response = NextResponse.redirect(loginUrl);
    // Clear invalid/expired session cookie immediately
    if (sessionCookie) {
      response.cookies.delete("programtrack_session");
    }
    return response;
  }

  // Edge RBAC check for admin-only staff routes (/staff, /api/staff)
  const isAdminRoute = pathname.startsWith("/staff") || pathname.startsWith("/api/staff");
  if (isAdminRoute && userRole !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/programs", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
