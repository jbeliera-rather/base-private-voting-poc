import { signIn } from "next-auth/react";

export interface ExternalAuthConfig {
  appScheme?: string;
  successRoute?: string;
  errorRoute?: string;
}

/**
 * Simplified external authentication handler to prevent redirect loops
 * Uses only popup-based authentication with session polling
 */
class ExternalAuthHandler {
  private config: ExternalAuthConfig;
  private authWindow: Window | null = null;
  private cleanupFunction: (() => void) | null = null;
  private authCompleted = false;
  
  constructor(config: ExternalAuthConfig = {}) {
    this.config = {
      appScheme: 'https://warpcast.com/~/frame',
      successRoute: '/auth/success',
      errorRoute: '/auth/error',
      ...config
    };
  }

  /**
   * Initiates Google OAuth - simplified to prevent redirect loops
   */
  async signInWithGoogle(callbackUrl?: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
      try {
        this.authCompleted = false;
        
        // Check if we're in a webview environment
        const isWebview = this.detectWebview();
        console.log('Starting authentication:', { isWebview, callbackUrl });
        
        if (isWebview) {
          // For webviews, try external browser first, fallback to popup
          this.handleWebviewAuth(callbackUrl || '/', resolve, reject);
        } else {
          // For regular browsers, use standard popup
          this.handleBrowserAuth(callbackUrl || '/', resolve, reject);
        }
      } catch (error) {
        reject({ success: false, error: 'Failed to initiate authentication' });
      }
    });
  }

  /**
   * Handle authentication for webviews (Base, Farcaster, etc.)
   */
  private handleWebviewAuth(
    callbackUrl: string,
    resolve: (value: { success: boolean; error?: string }) => void,
    reject: (reason: { success: boolean; error?: string }) => void
  ) {
    const origin = window.location.origin;
    const returnPath = callbackUrl || '/';
    const bridgeCallback = `${origin}/auth/bridge?return=${encodeURIComponent(returnPath)}`;
    const authUrl = `${origin}/api/auth/signin/google?callbackUrl=${encodeURIComponent(bridgeCallback)}`;
    
    console.log('Webview authentication starting:', authUrl);
    
    // Try to open in external browser
    if (this.tryOpenExternal(authUrl)) {
      console.log('Opened in external browser, monitoring session...');
      // Create a handshake so that the external browser can write a one-time token
      const handshake = Math.random().toString(36).slice(2);
      sessionStorage.setItem('bridge_handshake', handshake);
      // Kick off a POST in the external browser context using a beacon via query param (user will land on /auth/bridge which is client-only)
      // The external browser will hold the NextAuth session; the in-app webview will GET using the same handshake on focus.
      this.monitorSession(resolve, reject);

      // Show a helper prompt to guide the user back to the app
      try {
        const helper = document.createElement('div');
        helper.setAttribute('id', 'auth-helper');
        helper.style.position = 'fixed';
        helper.style.bottom = '16px';
        helper.style.left = '50%';
        helper.style.transform = 'translateX(-50%)';
        helper.style.padding = '10px 14px';
        helper.style.borderRadius = '8px';
        helper.style.background = 'rgba(17,24,39,0.95)';
        helper.style.color = 'white';
        helper.style.fontSize = '12px';
        helper.style.zIndex = '99999';
        helper.style.textAlign = 'center';
        helper.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
        helper.textContent = 'Complete sign in in your browser, then return to this app.';
        document.body.appendChild(helper);
        setTimeout(() => helper.remove(), 6000);
      } catch {}
    } else {
      console.log('External browser failed, falling back to popup...');
      this.openPopup(authUrl, resolve, reject);
    }
  }

  /**
   * Handle authentication for regular browsers
   */
  private handleBrowserAuth(
    callbackUrl: string,
    resolve: (value: { success: boolean; error?: string }) => void,
    reject: (reason: { success: boolean; error?: string }) => void
  ) {
    const origin = window.location.origin;
    const bridgeCallback = `${origin}/auth/bridge?return=${encodeURIComponent(callbackUrl)}`;
    const authUrl = `${origin}/api/auth/signin/google?callbackUrl=${encodeURIComponent(bridgeCallback)}`;
    console.log('Browser authentication starting:', authUrl);
    this.openPopup(authUrl, resolve, reject);
  }

  /**
   * Try to open authentication in external browser
   */
  private tryOpenExternal(authUrl: string): boolean {
    try {
      // Try Base app methods
      if (this.isBaseApp()) {
        const windowWithCoinbase = window as { coinbaseWallet?: { openURL?: (url: string) => void } };
        if (typeof windowWithCoinbase.coinbaseWallet?.openURL === 'function') {
          windowWithCoinbase.coinbaseWallet.openURL(authUrl);
          return true;
        }
      }

      // Try standard external opening
      const externalWindow = window.open(authUrl, '_blank', 'noopener,noreferrer');
      if (externalWindow) {
        // Close immediately - we just want to trigger external browser
        setTimeout(() => externalWindow.close(), 100);
        return true;
      }

      return false;
    } catch (error) {
      console.error('External browser opening failed:', error);
      return false;
    }
  }

  /**
   * Open popup window for authentication
   */
  private openPopup(
    authUrl: string,
    resolve: (value: { success: boolean; error?: string }) => void,
    reject: (reason: { success: boolean; error?: string }) => void
  ) {
    try {
      this.authWindow = window.open(
        authUrl,
        'auth-popup',
        'width=500,height=600,scrollbars=yes,resizable=yes,popup=yes'
      );

      if (!this.authWindow) {
        console.warn('Popup blocked, redirecting current window');
        window.location.href = authUrl;
        return;
      }

      console.log('Popup opened, monitoring session...');
      this.monitorSession(resolve, reject);

      // Also monitor popup closure
      const checkClosed = setInterval(() => {
        if (this.authWindow?.closed) {
          clearInterval(checkClosed);
          if (!this.authCompleted) {
            setTimeout(() => this.checkFinalStatus(resolve, reject), 500);
          }
        }
      }, 1000);

      // Store cleanup function
      if (this.cleanupFunction) {
        const oldCleanup = this.cleanupFunction;
        this.cleanupFunction = () => {
          clearInterval(checkClosed);
          oldCleanup();
        };
      } else {
        this.cleanupFunction = () => clearInterval(checkClosed);
      }

    } catch (error) {
      console.error('Failed to open popup:', error);
      reject({ success: false, error: 'Failed to open authentication window' });
    }
  }

  /**
   * Monitor session for authentication completion
   */
  private monitorSession(
    resolve: (value: { success: boolean; error?: string }) => void,
    reject: (reason: { success: boolean; error?: string }) => void
  ) {
    let attempts = 0;
    const maxAttempts = 150; // 5 minutes at 2-second intervals

    const checkSession = async () => {
      attempts++;
      try {
        const response = await fetch('/api/auth/session');
        const session = await response.json();
        
        if (session?.user) {
          console.log('Authentication successful!');
          this.authCompleted = true;
          this.cleanup();
          resolve({ success: true });
          return;
        }

        if (attempts >= maxAttempts) {
          this.cleanup();
          reject({ success: false, error: 'Authentication timeout' });
          return;
        }

        // Continue monitoring
        setTimeout(checkSession, 2000);
      } catch (error) {
        if (attempts >= maxAttempts) {
          this.cleanup();
          reject({ success: false, error: 'Authentication timeout' });
          return;
        }
        // Continue monitoring on fetch errors
        setTimeout(checkSession, 2000);
      }
    };

    // Start monitoring
    checkSession();

    // Also listen for focus events (user returning to app)
    const handleFocus = () => {
      if (!this.authCompleted) {
        console.log('Window focused, checking session immediately');
        checkSession();
      }
    };

    window.addEventListener('focus', handleFocus);

    // Store cleanup function
    if (this.cleanupFunction) {
      const oldCleanup = this.cleanupFunction;
      this.cleanupFunction = () => {
        window.removeEventListener('focus', handleFocus);
        oldCleanup();
      };
    } else {
      this.cleanupFunction = () => {
        window.removeEventListener('focus', handleFocus);
      };
    }
  }

  /**
   * Check final authentication status
   */
  private async checkFinalStatus(
    resolve: (value: { success: boolean; error?: string }) => void,
    reject: (reason: { success: boolean; error?: string }) => void
  ) {
    try {
      const response = await fetch('/api/auth/session');
      const session = await response.json();
      
      if (session?.user) {
        this.authCompleted = true;
        resolve({ success: true });
      } else {
        reject({ success: false, error: 'Authentication was cancelled' });
      }
    } catch (error) {
      reject({ success: false, error: 'Failed to verify authentication' });
    }
  }

  /**
   * Detect if running in webview environment
   */
  private detectWebview(): boolean {
    if (typeof window === 'undefined') return false;

    const userAgent = navigator.userAgent || '';
    
    // Check for webview indicators
    const webviewPatterns = [
      'wv', // Android WebView
      'FB', 'Facebook', // Facebook
      'Twitter', // Twitter
      'Instagram', // Instagram
      'Line', // Line
      'MicroMessenger', // WeChat
      'Telegram', // Telegram
      'CoinbaseWallet', // Coinbase
      'OnchainKit' // OnchainKit
    ];

    const isWebviewUA = webviewPatterns.some(pattern => userAgent.includes(pattern));
    
    // Check for frame context
    const isFrame = window.parent !== window;
    const hasFrameContext = window.location !== window.parent.location;
    
    // Check for specific app environments
    const isFarcaster = this.isFarcasterApp();
    const isBase = this.isBaseApp();
    
    // Check for React Native WebView
    const isReactNative = typeof (window as { ReactNativeWebView?: unknown }).ReactNativeWebView !== 'undefined';

    return isWebviewUA || isFrame || hasFrameContext || isFarcaster || isBase || isReactNative;
  }

  /**
   * Detect if running in Farcaster app
   */
  private isFarcasterApp(): boolean {
    if (typeof window === 'undefined') return false;

    const isFarcasterUrl = window.location.href.includes('warpcast.com') ||
                          window.location.href.includes('farcaster.xyz') ||
                          document.referrer.includes('warpcast.com') ||
                          document.referrer.includes('farcaster.xyz');

    const hasMiniKit = typeof (window as { MiniKit?: unknown }).MiniKit !== 'undefined' ||
                      document.querySelector('[data-minikit]') !== null;

    return isFarcasterUrl || hasMiniKit;
  }

  /**
   * Detect if running in Base app
   */
  private isBaseApp(): boolean {
    if (typeof window === 'undefined') return false;

    const userAgent = navigator.userAgent || '';
    const isBaseUA = userAgent.includes('BaseApp') ||
                     userAgent.includes('Coinbase') ||
                     userAgent.includes('OnchainKit');

    const isBaseUrl = window.location.href.includes('base.org') ||
                     window.location.href.includes('coinbase.com') ||
                     document.referrer.includes('base.org') ||
                     document.referrer.includes('coinbase.com');

    const hasBaseContext = typeof (window as { coinbaseWallet?: unknown }).coinbaseWallet !== 'undefined' ||
                          typeof (window as { ethereum?: unknown }).ethereum !== 'undefined';

    return isBaseUA || isBaseUrl || hasBaseContext;
  }

  /**
   * Clean up resources
   */
  private cleanup() {
    if (this.authWindow && !this.authWindow.closed) {
      this.authWindow.close();
    }
    this.authWindow = null;

    if (this.cleanupFunction) {
      this.cleanupFunction();
      this.cleanupFunction = null;
    }
  }
}

// Export singleton instance
export const externalAuthHandler = new ExternalAuthHandler();

// Convenience function for components
export async function signInWithExternalBrowser(callbackUrl?: string) {
  return externalAuthHandler.signInWithGoogle(callbackUrl);
}