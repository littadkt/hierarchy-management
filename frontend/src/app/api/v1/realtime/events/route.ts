import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";
  const { search } = new URL(request.url);
  const targetUrl = `${backendUrl}/api/v1/realtime/events${search}`;

  try {
    const backendRes = await fetch(targetUrl, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      signal: request.signal,
    });

    if (!backendRes.ok) {
      return new Response(backendRes.body, {
        status: backendRes.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    return new Response(backendRes.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: any) {
    // If backend is temporarily offline, restarting, or refactoring,
    // respond gracefully with a 503 and SSE comment so Next.js does not log proxy ECONNREFUSED
    return new Response(`: backend temporarily unavailable, retrying in 3s\n\n`, {
      status: 503,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Retry-After": "3",
      },
    });
  }
}
