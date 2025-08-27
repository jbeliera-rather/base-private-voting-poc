import { initializeActiveVotings, initializeInactiveVotings, startExpirationChecker } from './db/voting-status';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia, hardhat } from 'viem/chains';
import type { PrivateKeyAccount } from 'viem';

// Global instances
let protocolAccount: PrivateKeyAccount | null = null;

// Get the appropriate chain based on environment
function getChain() {
  const chainName = process.env.NEXT_PUBLIC_CHAIN?.toLowerCase();
  switch (chainName) {
    case 'base':
      return base;
    case 'basesepolia':
      return baseSepolia;
    default:
      console.warn(`Chain "${process.env.NEXT_PUBLIC_CHAIN}" not recognized, defaulting to baseSepolia`);
      return baseSepolia;
  }
}

// Get protocol account
export function getProtocolAccount() {
  if (!protocolAccount) {
    protocolAccount = privateKeyToAccount(process.env.PROTOCOL_PRIVATE_KEY as `0x${string}`);
  }
  return protocolAccount;
}

// Create wallet client with account
export function createProtocolWalletClient() {
  const account = getProtocolAccount();
  const chain = getChain();
  
  return createWalletClient({
    account,
    chain,
    transport: http(),
  });
}

// Initialize the server
export async function initializeServer() {
  try {
    const protocolAccount = privateKeyToAccount(process.env.PROTOCOL_PRIVATE_KEY as `0x${string}`);
    console.log('Protocol account:', protocolAccount.address);

    // Initialize protocol account
    getProtocolAccount();
    console.log('Protocol wallet initialized for chain:', getChain().name);

    // Initialize the active votings list
    await initializeActiveVotings();
    await initializeInactiveVotings();
    
    // Start the expiration checker
    await startExpirationChecker();
    
    console.log('Server initialized successfully');
  } catch (error) {
    console.error('Failed to initialize server:', error);
    throw error;
  }
} 