"use client";

import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from 'react'
import { ThemeProvider } from './components/ThemeProvider';
import { FloatingActions } from './components/FloatingActions';
import { MiniKitProvider } from '@coinbase/onchainkit/minikit';
import { baseSepolia } from 'wagmi/chains';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <ThemeProvider>
      <SessionProvider>
        <MiniKitProvider apiKey={process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY} chain={baseSepolia}>
        {children}
        <FloatingActions />
        </MiniKitProvider>
      </SessionProvider>
    </ThemeProvider>
  );
} 

