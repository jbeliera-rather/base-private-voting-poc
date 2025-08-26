"use client";

import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from 'react'
import { ThemeProvider } from './components/ThemeProvider';
import { FloatingActions } from './components/FloatingActions';
import { MiniKitProvider } from '@coinbase/onchainkit/minikit';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { 
  baseSepolia, 
  base, 
  localhost
} from 'wagmi/chains'; 

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getConfig } from '@/wagmi'; // your import path may vary
import { WagmiProvider } from "wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  const getChain = () => {
    const chainName = process.env.NEXT_PUBLIC_CHAIN?.toLowerCase();

    switch (chainName) {
      case 'base':
        return base;
      case 'basesepolia':
        return baseSepolia;
      case 'localhost':
        return localhost;
      default:
        console.warn(`Chain "${process.env.NEXT_PUBLIC_CHAIN}" not recognized, defaulting to baseSepolia`);
        return baseSepolia;
    }
  };


  const [config] = useState(() => getConfig());
  const [queryClient] = useState(() => new QueryClient());

  const chain = getChain();

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <ThemeProvider>
      <SessionProvider>
        <MiniKitProvider apiKey={process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY} chain={chain}>
          <WagmiProvider config={config} >
            <QueryClientProvider client={queryClient}>
              <OnchainKitProvider 
                chain={chain} 
                apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY} 
                projectId={process.env.NEXT_PUBLIC_PROJECT_ID}
                config={{ // Add paymaster to sponsor gas for the user
                  appearance: {
                    name: 'Chat-ching Bot ',
                    logo: 'https://onchainkit.xyz/favicon/48x48.png?v4-19-24',
                    mode: 'auto',
                    theme: 'default', // 'base', 'cyberpunk', 'default', 'hacker'
                  }, 
                  paymaster: process.env.NEXT_PUBLIC_PAYMASTER_ENDPOINT, 
                }}
              >
              {children}
              <FloatingActions />
              </OnchainKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </MiniKitProvider>
      </SessionProvider>
    </ThemeProvider>
  );
} 