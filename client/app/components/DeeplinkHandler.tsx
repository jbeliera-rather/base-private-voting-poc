"use client";

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface DeeplinkHandlerProps {
  onAuthSuccess?: () => void;
  onAuthError?: (error: string) => void;
}

/**
 * Component that handles deeplinks for authentication return flow
 * This component should be mounted at the app level to capture deeplink events
 */
export default function DeeplinkHandler({ onAuthSuccess, onAuthError }: DeeplinkHandlerProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Function to handle deeplink events
    const handleDeeplink = (event: CustomEvent) => {
      const { url } = event.detail;
      
      if (url.startsWith('votingapp://auth/')) {
        if (url.includes('/success')) {
          handleAuthSuccess(url);
        } else if (url.includes('/error')) {
          handleAuthError(url);
        }
      }
    };

    // Function to handle focus events (app returning from background)
    const handleFocus = async () => {
      // Try auto-bridge: fetch a one-time token if external browser just logged in
      try {
        const handshake = sessionStorage.getItem('bridge_handshake');
        if (handshake) {
          const res = await fetch(`/api/auth/bridge?handshake=${encodeURIComponent(handshake)}`);
          const data = await res.json();
          sessionStorage.removeItem('bridge_handshake');
          if (data?.token) {
            // Complete in-app session automatically
            await fetch('/api/auth/callback/credentials?json=true', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ csrfToken: '', provider: 'bridge', token: data.token })
            }).catch(() => {});
          }
        }
      } catch {}

      // Check localStorage for authentication result
      try {
        const authResult = localStorage.getItem('authResult');
        if (authResult) {
          const result = JSON.parse(authResult);
          localStorage.removeItem('authResult');
          
          if (result.type === 'AUTH_SUCCESS') {
            handleAuthSuccess();
          } else if (result.type === 'AUTH_ERROR') {
            handleAuthError(null, result.data.error);
          }
        }
        
        // For Farcaster frames, also check session directly
        if (isFarcasterFrame()) {
          const response = await fetch('/api/auth/session');
          const session = await response.json();
          
          if (session?.user) {
            handleAuthSuccess();
          }
        }
      } catch (error) {
        console.error('Error parsing auth result:', error);
      }
    };

    // Function to detect if running in Farcaster frame
    const isFarcasterFrame = (): boolean => {
      return window.parent !== window || 
             document.referrer.includes('warpcast.com') ||
             document.referrer.includes('farcaster.xyz');
    };

    // Function to handle URL hash changes (for web-based deeplinks)
    const handleHashChange = () => {
      const hash = window.location.hash;
      
      if (hash.includes('#auth=success')) {
        handleAuthSuccess();
      } else if (hash.includes('#auth=error')) {
        const params = new URLSearchParams(hash.substring(1));
        const error = params.get('error') || 'Authentication failed';
        handleAuthError(null, error);
      }
    };

    // Function to handle message events (for iframe/popup scenarios)
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'AUTH_SUCCESS') {
        handleAuthSuccess();
      } else if (event.data.type === 'AUTH_ERROR') {
        handleAuthError(null, event.data.data.error);
      }
    };

    // Add event listeners
    window.addEventListener('deeplink' as keyof WindowEventMap, handleDeeplink as EventListener);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('message', handleMessage);

    // Check initial hash state
    handleHashChange();

    // Cleanup
    return () => {
      window.removeEventListener('deeplink' as keyof WindowEventMap, handleDeeplink as EventListener);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleAuthSuccess = (url?: string) => {
    // Extract callback URL if provided in deeplink
    let callbackUrl = '/';
    
    if (url) {
      try {
        const urlObj = new URL(url.replace('votingapp://', 'https://dummy.com/'));
        callbackUrl = urlObj.searchParams.get('callback') || '/';
      } catch (error) {
        console.error('Error parsing deeplink URL:', error);
      }
    }

    // Clear URL hash if present
    if (window.location.hash.includes('auth=')) {
      window.location.hash = '';
    }

    // Call success callback
    if (onAuthSuccess) {
      onAuthSuccess();
    }

    // Refresh the session to get updated authentication state
    router.refresh();
    
    // Navigate to callback URL if it's different from current page
    if (callbackUrl !== window.location.pathname && callbackUrl !== '/') {
      router.push(callbackUrl);
    }
  };

  const handleAuthError = (url?: string | null, errorMessage?: string) => {
    let error = 'Authentication failed';
    
    if (url) {
      try {
        const urlObj = new URL(url.replace('votingapp://', 'https://dummy.com/'));
        error = urlObj.searchParams.get('error') || error;
      } catch (parseError) {
        console.error('Error parsing deeplink URL:', parseError);
      }
    } else if (errorMessage) {
      error = errorMessage;
    }

    // Clear URL hash if present
    if (window.location.hash.includes('auth=')) {
      window.location.hash = '';
    }

    // Call error callback
    if (onAuthError) {
      onAuthError(error);
    }

    // You might want to show a toast notification here
    console.error('Authentication error:', error);
  };

  // This component doesn't render anything
  return null;
}

// Hook to use deeplink handling in any component
export function useDeeplinkAuth() {
  const router = useRouter();

  const registerAuthHandlers = (
    onSuccess?: () => void,
    onError?: (error: string) => void
  ) => {
    // Register handlers for authentication events
    const handleSuccess = () => {
      if (onSuccess) onSuccess();
      router.refresh();
    };

    const handleError = (error: string) => {
      if (onError) onError(error);
    };

    return { handleSuccess, handleError };
  };

  return { registerAuthHandlers };
}
