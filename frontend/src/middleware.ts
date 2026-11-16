import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Extract client IP address
  // Priority:
  // 1. Existing x-forwarded-for header (if already behind a reverse proxy like Nginx)
  // 2. x-real-ip header
  // 3. request.ip (Next.js client IP detection)
  // 4. socket remoteAddress fallback
  const existingForwarded = request.headers.get("x-forwarded-for");
  const existingRealIp = request.headers.get("x-real-ip");
  const requestIp = (request as any).ip || (request as any).socket?.remoteAddress || "";

  let clientIp = "";
  if (existingForwarded) {
    clientIp = existingForwarded.split(",")[0].trim();
  } else if (existingRealIp) {
    clientIp = existingRealIp.trim();
  } else if (requestIp) {
    clientIp = requestIp;
  }

  // Clean IPv4-mapped IPv6 prefix if present (::ffff:192.168.1.5 -> 192.168.1.5)
  if (clientIp.startsWith("::ffff:")) {
    clientIp = clientIp.substring(7);
  }

  if (clientIp) {
    requestHeaders.set("x-forwarded-for", clientIp);
    requestHeaders.set("x-real-ip", clientIp);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: "/api/v1/:path*",
};
