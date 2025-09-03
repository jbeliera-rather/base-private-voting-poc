import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getServerSession } from 'next-auth';

export const dynamic = 'force-dynamic';

type BridgeEntry = { token: string; exp: number };

function getStore(): Map<string, BridgeEntry> {
  const g = globalThis as unknown as { __BRIDGE_STORE?: Map<string, BridgeEntry> };
  if (!g.__BRIDGE_STORE) g.__BRIDGE_STORE = new Map();
  return g.__BRIDGE_STORE;
}

function signToken(payload: object, secret: string): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  const hmac = crypto.createHmac('sha256', secret).update(b64).digest('hex');
  return `v1.${b64}.${hmac}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const handshake = url.searchParams.get('handshake');

    // Handle device code authentication (direct token creation)
    if (body.user && body.tokens) {
      const secret = process.env.NEXTAUTH_BRIDGE_SECRET || process.env.NEXTAUTH_SECRET || 'bridge-secret';
      const exp = Date.now() + 2 * 60 * 1000; // 2 minutes
      const payload = { user: body.user, tokens: body.tokens, exp };
      const token = signToken(payload, secret);

      return NextResponse.json({ bridgeToken: token });
    }

    // Handle handshake-based authentication (existing functionality)
    if (!handshake) {
      return NextResponse.json({ error: 'Missing handshake or user data' }, { status: 400 });
    }

    // Must have an external browser NextAuth session
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const secret = process.env.NEXTAUTH_BRIDGE_SECRET || process.env.NEXTAUTH_SECRET || 'bridge-secret';
    const exp = Date.now() + 2 * 60 * 1000; // 2 minutes
    const payload = { user: session.user, exp };
    const token = signToken(payload, secret);

    // Store in in-memory bridge store for the in-app webview to fetch
    const store = getStore();
    store.set(handshake, { token, exp });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const handshake = url.searchParams.get('handshake');
    if (!handshake) {
      return NextResponse.json({ error: 'Missing handshake' }, { status: 400 });
    }

    const store = getStore();
    const entry = store.get(handshake);
    if (!entry) {
      return NextResponse.json({ token: null });
    }
    if (Date.now() > entry.exp) {
      store.delete(handshake);
      return NextResponse.json({ token: null });
    }

    // One-time read: delete after returning
    store.delete(handshake);
    return NextResponse.json({ token: entry.token });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


