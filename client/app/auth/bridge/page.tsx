"use client";

import { useEffect, useMemo } from "react";
import { signIn } from "next-auth/react";

function hmacSHA256(secret: string, data: string) {
  const enc = new TextEncoder();
  const keyPromise = crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return keyPromise.then(async (key) => {
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
    const bytes = new Uint8Array(sig);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  });
}

export default function BridgePage() {

  const params = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search);
  }, []);

  useEffect(() => {
    (async () => {
      if (!params) return;
      const ret = params.get("return") || "/";

      // Create short-lived bridge token with user data from localStorage (if exists)
      // Note: we only need a token to allow in-app webview to authenticate via credentials
      const secret = process.env.NEXT_PUBLIC_BRIDGE_SECRET || "bridge-secret";
      const exp = Date.now() + 2 * 60 * 1000; // 2 minutes
      const payload = {
        user: {},
        exp,
      };
      const json = JSON.stringify(payload);
      const b64 = btoa(unescape(encodeURIComponent(json)));
      const hmac = await hmacSHA256(secret, b64);
      const token = `v1.${b64}.${hmac}`;

      // Try to sign in this tab as well so subsequent checks resolve quickly
      signIn("bridge", { token, redirect: false });

      // Redirect to return URL
      window.location.replace(ret);
    })();
  }, [params]);

  return null;
}


