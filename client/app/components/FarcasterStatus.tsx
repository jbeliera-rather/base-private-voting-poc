"use client";

import { useEffect, useState } from 'react';
import { FarcasterAuth } from '../utils/farcaster-auth';

interface FarcasterStatusProps {
  children?: React.ReactNode;
  showStatus?: boolean;
}

/**
 * Component that shows Farcaster Frame status and handles frame-specific logic
 */
export default function FarcasterStatus({ children, showStatus = false }: FarcasterStatusProps) {
  const [isFrameEnvironment, setIsFrameEnvironment] = useState(false);
  const [frameContext, setFrameContext] = useState<{ url?: string; referrer?: string } | null>(null);

  useEffect(() => {
    // Check if we're in a Farcaster Frame
    const isFarcaster = FarcasterAuth.isFarcasterEnvironment();
    setIsFrameEnvironment(isFarcaster);

    if (isFarcaster) {
      const context = FarcasterAuth.getFrameContext();
      setFrameContext(context);
      
      // Handle any pending auth returns
      FarcasterAuth.handleAuthReturn();
    }
  }, []);

  // Don't show status by default unless requested
  if (!showStatus) {
    return <>{children}</>;
  }

  return (
    <div>
      {isFrameEnvironment && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 p-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                  Running in Farcaster Frame
                </span>
              </div>
              {frameContext?.referrer && (
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  From: {frameContext.referrer.includes('warpcast.com') ? 'Warpcast' : 'Farcaster Client'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Hook for Farcaster Frame status
 */
export function useFarcasterStatus() {
  const [isFrameEnvironment, setIsFrameEnvironment] = useState(false);
  const [frameContext, setFrameContext] = useState<{ url?: string; referrer?: string } | null>(null);

  useEffect(() => {
    const isFarcaster = FarcasterAuth.isFarcasterEnvironment();
    setIsFrameEnvironment(isFarcaster);

    if (isFarcaster) {
      const context = FarcasterAuth.getFrameContext();
      setFrameContext(context);
    }
  }, []);

  return {
    isFrameEnvironment,
    frameContext,
    notifyStatus: FarcasterAuth.notifyAuthStatus,
    handleAuthReturn: FarcasterAuth.handleAuthReturn
  };
}
