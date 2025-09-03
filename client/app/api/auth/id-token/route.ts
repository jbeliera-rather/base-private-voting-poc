import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret-for-build';
    const token = await getToken({ req, secret });

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // If idToken is already present in the server token, return it directly
    if ((token as { idToken?: string }).idToken) {
      return NextResponse.json({ id_token: (token as { idToken?: string }).idToken });
    }

    const refreshToken = (token as { refreshToken?: string }).refreshToken;
    if (!refreshToken) {
      return NextResponse.json({ error: 'No id_token or refresh_token available' }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_DEVICE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DEVICE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Google client credentials not configured' }, { status: 500 });
    }

    // Refresh tokens to obtain a fresh id_token
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to refresh Google tokens', status: res.status }, { status: 500 });
    }

    const data = await res.json();
    if (!data.id_token) {
      return NextResponse.json({ error: 'Refresh succeeded but id_token missing' }, { status: 500 });
    }

    return NextResponse.json({ id_token: data.id_token });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


