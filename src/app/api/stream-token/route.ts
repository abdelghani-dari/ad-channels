import { NextRequest, NextResponse } from "next/server";

// In-memory token cache to avoid spamming the token service
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get("baseUrl");

  if (!baseUrl) {
    return NextResponse.json({ error: "Missing baseUrl parameter" }, { status: 400 });
  }

  // Check cache
  const cached = tokenCache.get(baseUrl);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 30000) {
    return NextResponse.json({ token: cached.token, cached: true });
  }

  try {
    const tokenUrl = `https://token.easybroadcast.io/all?url=${encodeURIComponent(baseUrl)}`;
    const res = await fetch(tokenUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`Token service responded with status ${res.status}`);
    }

    let token = await res.text();
    token = token.trim();
    if (token.startsWith("?")) {
      token = token.substring(1);
    }

    // Try to extract expires timestamp if present: &expires=1791151348
    let expiresAt = now + 120000; // default 2 minutes
    const expiresMatch = token.match(/expires=(\d+)/);
    if (expiresMatch && expiresMatch[1]) {
      const expSec = parseInt(expiresMatch[1], 10);
      if (!isNaN(expSec)) {
        expiresAt = expSec * 1000;
      }
    }

    tokenCache.set(baseUrl, { token, expiresAt });

    return NextResponse.json({ token, cached: false });
  } catch (error: any) {
    console.error("Token resolution error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to resolve stream token" },
      { status: 500 }
    );
  }
}
