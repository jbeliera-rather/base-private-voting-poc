import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import crypto from "node:crypto";

export const dynamic = 'force-dynamic';

const handler = NextAuth({
  providers: [
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
    async jwt({ token, user }) {
      // Handle device authentication flow
      if (user && 'tokens' in user && (user as { tokens?: { access_token?: string; refresh_token?: string; id_token?: string } }).tokens) {
        const userTokens = (user as { tokens: { access_token?: string; refresh_token?: string; id_token?: string } }).tokens;
        
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
      
      // If we don't have user updates, try to ensure idToken exists using refresh_token
      if (!token.idToken && token.refreshToken) {
        try {
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
              token.idToken = data.id_token || token.idToken;
              token.accessToken = data.access_token || token.accessToken;
            }
          }
        } catch (e) {
          // Silent fail
        }
      }

      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        token: token,
        accessToken: token.accessToken,
        idToken: token.idToken,
        customData: token.customData,
      };
    },
    async signIn() {
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