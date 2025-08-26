import { http, cookieStorage, createConfig, createStorage } from 'wagmi';
import { base, baseSepolia, hardhat } from 'wagmi/chains'; 
import { coinbaseWallet } from 'wagmi/connectors';

export function getConfig() {

  const chain = process.env.NEXT_PUBLIC_CHAIN === 'base' ? base : 
                process.env.NEXT_PUBLIC_CHAIN === 'baseSepolia' ? baseSepolia :
                hardhat;

  return createConfig({
    connectors: [
      coinbaseWallet({
        appName: 'OnchainKit',
        preference: 'smartWalletOnly',
        version: '4',
      }),
    ],
    syncConnectedChain:true,
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    chains: [chain],
    transports: {
      [base.id]: http(),
      [baseSepolia.id]: http(),
      [hardhat.id]: http(),
    },
  });
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}