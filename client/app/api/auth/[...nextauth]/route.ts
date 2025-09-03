import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "dummy",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy",
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        }
      },
      idToken: true,
    }),
    Credentials({
      name: "bridge",
      credentials: {
        token: { label: "token", type: "text" },
      },
      async authorize(credentials) {
        try {
          const token = credentials?.token as string | undefined;
          if (!token) return null;

          // Token format: v1.<base64Payload>.<hmacHex>
          const [version, b64, hmacHex] = token.split(".");
          if (version !== "v1" || !b64 || !hmacHex) return null;

          const secret = process.env.NEXTAUTH_BRIDGE_SECRET || process.env.NEXTAUTH_SECRET || "bridge-secret";
          const expected = crypto.createHmac("sha256", secret).update(b64).digest("hex");
          if (!crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(hmacHex, "hex"))) {
            return null;
          }

          const json = Buffer.from(b64, "base64").toString("utf8");
          const payload = JSON.parse(json);
          if (!payload || typeof payload !== "object") return null;

          // Check expiry (2 minutes default)
          if (!payload.exp || Date.now() > payload.exp) return null;

          const user = {
            id: payload.user?.id || payload.user?.email || payload.user?.sub || "user",
            email: payload.user?.email || null,
            name: payload.user?.name || null,
            image: payload.user?.image || null,
            // Include tokens for device authentication
            tokens: payload.tokens || null,
          } as { id: string; email: string | null; name: string | null; image: string | null; tokens?: { access_token?: string; refresh_token?: string; id_token?: string } };
          return user;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      console.log('JWT callback triggered:', {
        hasAccount: !!account,
        hasUser: !!user,
        accountKeys: account ? Object.keys(account) : [],
        userKeys: user ? Object.keys(user) : [],
        accountPreview: account ? {
          provider: account.provider,
          type: account.type,
          hasIdToken: !!account.id_token,
          hasAccessToken: !!account.access_token,
        } : null,
      });

      // Handle device authentication flow (credentials provider) FIRST if tokens are present on user
      if (user && 'tokens' in user && (user as { tokens?: { access_token?: string; refresh_token?: string; id_token?: string } }).tokens) {
        const userTokens = (user as { tokens: { access_token?: string; refresh_token?: string; id_token?: string } }).tokens;
        console.log('Processing device authentication flow:', {
          idToken: userTokens.id_token ? `${userTokens.id_token.substring(0, 50)}...` : 'MISSING',
          accessToken: userTokens.access_token ? `${userTokens.access_token.substring(0, 50)}...` : 'MISSING',
        });
        
        return {
          ...token,
          accessToken: userTokens.access_token,
          refreshToken: userTokens.refresh_token,
          idToken: userTokens.id_token,
          customData: {
            userId: user.id,
            email: user.email,
          },
        };
      }

      // Standard OAuth flow
      if (account && user) {
        console.log('Processing standard OAuth flow:', {
          idToken: account.id_token ? `${account.id_token.substring(0, 50)}...` : 'MISSING',
          accessToken: account.access_token ? `${account.access_token.substring(0, 50)}...` : 'MISSING',
          provider: account.provider,
        });
        
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          customData: {
            userId: user.id,
            email: user.email,
          },
        };
      }
      
      // If we don't have account/user updates, try to ensure idToken exists using refresh_token
      if (!token.idToken && token.refreshToken) {
        try {
          console.log('Attempting to refresh Google tokens to obtain missing id_token');
          const clientId = process.env.GOOGLE_DEVICE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
          const clientSecret = process.env.GOOGLE_DEVICE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
          if (clientId && clientSecret) {
            const res = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'refresh_token',
                refresh_token: String(token.refreshToken),
              }),
            });
            if (res.ok) {
              const data = await res.json();
              // Update idToken and optionally accessToken
              token.idToken = data.id_token || token.idToken;
              token.accessToken = data.access_token || token.accessToken;
              console.log('Successfully refreshed id_token via Google');
            } else {
              console.warn('Failed to refresh Google tokens', { status: res.status });
            }
          } else {
            console.warn('Missing Google client credentials; cannot refresh id_token');
          }
        } catch (e) {
          console.warn('Error refreshing Google tokens for id_token', e);
        }
      }

      console.log('JWT callback: No account or user tokens found, returning existing token');
      return token;
    },
    async session({ session, token }) {
      console.log('Session callback - token object:', {
        hasAccessToken: !!token.accessToken,
        hasIdToken: !!token.idToken,
        tokenKeys: Object.keys(token),
        tokenPreview: token,
      });
      
      return {
        ...session,
        token: token,
        accessToken: token.accessToken,
        idToken: token.idToken,
        customData: token.customData,
      };
    },
    async signIn({ user, account, profile, email, credentials }) {
      // Always allow sign in
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Very conservative redirect handling to prevent loops
      console.log('NextAuth redirect called:', { url, baseUrl });
      
      // Only allow relative URLs and same-origin URLs
      if (url.startsWith("/")) {
        const result = `${baseUrl}${url}`;
        console.log('Allowing relative URL:', result);
        return result;
      }
      
      // For absolute URLs, only allow same origin
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);
        if (urlObj.origin === baseUrlObj.origin) {
          console.log('Allowing same-origin URL:', url);
          return url;
        }
        console.log('Blocking external URL, redirecting to base:', baseUrl);
      } catch (error) {
        console.log('URL parsing error, using base URL:', baseUrl);
      }
      
      return baseUrl;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-build",
});

export { handler as GET, handler as POST }; 