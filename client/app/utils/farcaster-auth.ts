"use client";

import { signInWithExternalBrowser } from './external-auth';

/**
 * Farcaster-specific authentication utilities
 * Integrates with MiniKit and Farcaster Frame environment
 */
export const FarcasterAuth = {
  /**
   * Initiates authentication flow optimized for Farcaster and Base apps
   */
  async signIn(callbackUrl?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if we're in a Farcaster or Base environment
      const isFarcaster = FarcasterAuth.isFarcasterEnvironment();
      const isBase = FarcasterAuth.isBaseAppEnvironment();
      
      if (isFarcaster || isBase) {
        return await FarcasterAuth.signInInFrame(callbackUrl);
      }
      // Fall back to standard external auth
      return await signInWithExternalBrowser(callbackUrl);
    } catch (error) {
      console.error('Frame authentication error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      };
    }
  },

  /**
   * Sign in optimized for Farcaster Frame environment
   */
  async signInInFrame(callbackUrl?: string): Promise<{ success: boolean; error?: string }> {
    // Store the callback URL for after authentication
    if (callbackUrl) {
      sessionStorage.setItem('fc_auth_callback', callbackUrl);
    }

    // Use external browser for OAuth
    return await signInWithExternalBrowser(callbackUrl);
  },

  /**
   * Check if running in Farcaster environment
   */
  isFarcasterEnvironment(): boolean {
    if (typeof window === 'undefined') return false;

    // Check for frame context
    const isFrame = window.parent !== window;
    
    // Check for Farcaster referrer
    const isFarcasterReferrer = document.referrer.includes('warpcast.com') ||
                               document.referrer.includes('farcaster.xyz');
    
    // Check for Farcaster URL patterns
    const isFarcasterUrl = window.location.href.includes('warpcast.com') ||
                          window.location.href.includes('farcaster.xyz');
    
    // Check for MiniKit presence
    const hasMiniKit = typeof (window as { MiniKit?: unknown }).MiniKit !== 'undefined';

    return isFrame || isFarcasterReferrer || isFarcasterUrl || hasMiniKit;
  },

  /**
   * Check if running in Base app environment
   */
  isBaseAppEnvironment(): boolean {
    if (typeof window === 'undefined') return false;

    // Check for Base app indicators
    const userAgent = navigator.userAgent || '';
    
    // Check for Base-specific patterns
    const isBaseUserAgent = userAgent.includes('BaseApp') || 
                           userAgent.includes('Base/') ||
                           userAgent.includes('Coinbase') ||
                           userAgent.includes('OnchainKit');
    
    // Check for Base app URL patterns
    const isBaseUrl = window.location.href.includes('base.org') ||
                     window.location.href.includes('coinbase.com') ||
                     document.referrer.includes('base.org') ||
                     document.referrer.includes('coinbase.com');
    
    // Check for Base app specific window properties
    const hasBaseContext = typeof (window as { base?: unknown }).base !== 'undefined' ||
                          typeof (window as { ethereum?: unknown }).ethereum !== 'undefined' ||
                          typeof (window as { coinbaseWallet?: unknown }).coinbaseWallet !== 'undefined';
    
    // Check if running in an iframe/webview context with Base indicators
    const isBaseFrame = window.parent !== window && (isBaseUserAgent || isBaseUrl || hasBaseContext);
    
    return isBaseUserAgent || isBaseUrl || hasBaseContext || isBaseFrame;
  },

  /**
   * Handle post-authentication return in frame environment (Farcaster or Base)
   */
  handleAuthReturn(): void {
    if (FarcasterAuth.isFarcasterEnvironment() || FarcasterAuth.isBaseAppEnvironment()) {
      const callbackUrl = sessionStorage.getItem('fc_auth_callback');
      if (callbackUrl) {
        sessionStorage.removeItem('fc_auth_callback');
        // Navigate to the callback URL within the frame
        window.location.href = callbackUrl;
      }
    }
  },

  /**
   * Notify frame client (Farcaster or Base) of authentication status
   */
  notifyAuthStatus(success: boolean, error?: string): void {
    const isFarcaster = FarcasterAuth.isFarcasterEnvironment();
    const isBase = FarcasterAuth.isBaseAppEnvironment();
    
    if (!isFarcaster && !isBase) return;

    // Send message to parent frame (Farcaster or Base client)
    if (window.parent && window.parent !== window) {
      const messageType = isFarcaster ? 'FARCASTER_AUTH_STATUS' : 'FRAME_AUTH_STATUS';
      window.parent.postMessage({
        type: messageType,
        success,
        error,
        timestamp: Date.now(),
        environment: isFarcaster ? 'farcaster' : 'base'
      }, '*');
    }
  },

  /**
   * Get frame context if available (Farcaster or Base)
   */
  getFrameContext(): { url?: string; referrer?: string; environment?: string } | null {
    const isFarcaster = FarcasterAuth.isFarcasterEnvironment();
    const isBase = FarcasterAuth.isBaseAppEnvironment();
    
    if (!isFarcaster && !isBase) return null;

    return {
      url: window.location.href,
      referrer: document.referrer,
      environment: isFarcaster ? 'farcaster' : 'base'
    };
  }
};

/**
 * Hook for using Farcaster authentication in React components
 */
export function useFarcasterAuth() {
  const signIn = async (callbackUrl?: string) => {
    return FarcasterAuth.signIn(callbackUrl);
  };

  const isFrameEnvironment = FarcasterAuth.isFarcasterEnvironment();

  return {
    signIn,
    isFrameEnvironment,
    handleAuthReturn: () => FarcasterAuth.handleAuthReturn(),
    notifyAuthStatus: (success: boolean, error?: string) => FarcasterAuth.notifyAuthStatus(success, error),
    getFrameContext: () => FarcasterAuth.getFrameContext()
  };
}
