"use client";

import { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import toast from 'react-hot-toast';

interface DeviceAuthData {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

interface DeviceCodeAuthProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function DeviceCodeAuth({ onSuccess, onError }: DeviceCodeAuthProps) {
  const [deviceData, setDeviceData] = useState<DeviceAuthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const initiateDeviceAuth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Initiating device authentication...');
      const response = await fetch('/api/auth/device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'initiate' }),
      });

      console.log('Device auth response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Device auth error response:', errorData);
        
        let errorMessage = 'Failed to initiate device authentication';
        if (errorData.details) {
          errorMessage = `${errorData.error || errorMessage}: ${errorData.details}`;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        throw new Error(errorMessage);
      }

      const data: DeviceAuthData = await response.json();
      console.log('Device auth success:', {
        hasUserCode: !!data.user_code,
        expiresIn: data.expires_in,
        interval: data.interval,
      });
      
      setDeviceData(data);
      setTimeLeft(data.expires_in);
    } catch (err) {
      console.error('Device auth initiation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start device authentication';
      setError(errorMessage);
      onError?.(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  const pollForToken = useCallback(async () => {
    if (!deviceData || isPolling) return;

    setIsPolling(true);

    const poll = async () => {
      try {
        const response = await fetch('/api/auth/device', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            action: 'poll',
            device_code: deviceData.device_code 
          }),
        });

        const data = await response.json();

        if (data.status === 'success') {
          // Authentication successful - create a bridge token for NextAuth
          const bridgeResponse = await fetch('/api/auth/bridge', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user: data.user,
              tokens: data.tokens,
            }),
          });

          if (bridgeResponse.ok) {
            const { bridgeToken } = await bridgeResponse.json();
            
            // Sign in using the bridge token
            const result = await signIn('credentials', {
              token: bridgeToken,
              redirect: false,
            });

            if (result?.ok) {
              toast.success('Successfully authenticated!');
              window.location.href = '/';
              return; // Stop polling
            }
            throw new Error('Failed to complete authentication');
          }
          throw new Error('Failed to create authentication session');
        }
        if (data.status === 'authorization_pending') {
          // Continue polling
          setTimeout(poll, (deviceData.interval || 5) * 1000);
          return;
        }
        if (data.status === 'slow_down') {
          // Slow down polling
          setTimeout(poll, (deviceData.interval || 5) * 1000 + 1000);
          return;
        }
        // Error occurred
        console.error('Token polling error:', data);
        
        let errorMessage = data.message || data.error || 'Authentication failed';
        
        // Add troubleshooting info if available
        if (data.troubleshooting) {
          errorMessage += `\n\nTroubleshooting: ${data.troubleshooting}`;
        }
        
        if (data.googleError && data.googleError !== data.message) {
          errorMessage += `\n\nGoogle Error: ${data.googleError}`;
        }
        
        throw new Error(errorMessage);
      } catch (err) {
        console.error('Token exchange error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMessage);
        onError?.(errorMessage);
        toast.error(errorMessage.split('\n')[0]); // Show only first line in toast
        setIsPolling(false);
      }
    };

    // Start polling
    setTimeout(poll, (deviceData.interval || 5) * 1000);
  }, [deviceData, isPolling, onError]);

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft > 0 && deviceData) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (timeLeft === 0 && deviceData) {
      setError('Device code expired. Please try again.');
      setDeviceData(null);
      setIsPolling(false);
    }
  }, [timeLeft, deviceData]);

  // Auto-start polling when device data is available
  useEffect(() => {
    if (deviceData && !isPolling) {
      pollForToken();
    }
  }, [deviceData, isPolling, pollForToken]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 card">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔐</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Device Authentication
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Secure Google authentication for your device
        </p>
      </div>

      {!deviceData && !isLoading && (
        <div className="text-center space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
            <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
              <span className="font-semibold">🔒 Secure Authentication:</span> Use Google's device flow for maximum security. Perfect for untrusted browsers or limited input devices.
            </p>
          </div>
          <button
            type="button"
            onClick={initiateDeviceAuth}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 btn shadow-lg hover:shadow-xl"
          >
            <span className="flex items-center justify-center gap-2">
              <span>🚀</span>
              Start Device Authentication
            </span>
          </button>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300 font-medium">Initializing authentication...</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Please wait while we set up your secure connection</p>
        </div>
      )}

      {deviceData && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6 rounded-xl border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">1</span>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Copy this code</h3>
            </div>
            <div className="flex items-center gap-3">
              <code className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-xl font-mono tracking-wider flex-1 text-center text-gray-900 dark:text-white shadow-sm">
                {deviceData.user_code}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(deviceData.user_code)}
                className="bg-indigo-100 dark:bg-indigo-900 hover:bg-indigo-200 dark:hover:bg-indigo-800 px-4 py-3 rounded-xl transition-all duration-200 btn"
                title="Copy code"
              >
                <span className="text-lg">📋</span>
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-green-700 dark:text-green-300">2</span>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Visit this URL</h3>
            </div>
            {deviceData.verification_uri ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <code className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm flex-1 text-gray-900 dark:text-white shadow-sm break-all">
                    {deviceData.verification_uri}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(deviceData.verification_uri)}
                    className="bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800 px-4 py-3 rounded-xl transition-all duration-200 btn"
                    title="Copy URL"
                  >
                    <span className="text-lg">📋</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl mb-3">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm mb-3 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Verification URL not provided by Google. Please try this fallback:</span>
                </p>
                <div className="flex items-center gap-3">
                  <code className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm flex-1 text-gray-900 dark:text-white shadow-sm">
                    https://www.google.com/device
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('https://www.google.com/device')}
                    className="bg-yellow-100 dark:bg-yellow-900 hover:bg-yellow-200 dark:hover:bg-yellow-800 px-4 py-3 rounded-xl transition-all duration-200 btn"
                    title="Copy URL"
                  >
                    <span className="text-lg">📋</span>
                  </button>
                </div>
              </div>
            )}
            
            <div className="mt-4">
              {deviceData.verification_uri_complete ? (
                <button
                  type="button"
                  onClick={() => {
                    // Force open in new popup window with specific dimensions
                    if (typeof window !== 'undefined' && window.open) {
                      const popup = window.open(
                        deviceData.verification_uri_complete, 
                        'google-auth-popup',
                        'width=500,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,directories=no,status=no'
                      );
                      if (popup) {
                        popup.focus();
                      }
                    } else if (deviceData.verification_uri_complete) {
                      window.location.href = deviceData.verification_uri_complete;
                    }
                  }}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 btn shadow-lg hover:shadow-xl"
                >
                  <span className="flex items-center justify-center gap-2">
                    <span>🚀</span>
                    Open Authentication Page (Pre-filled Code)
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const url = deviceData.verification_uri || 'https://www.google.com/device';
                    // Force open in new popup window with specific dimensions
                    if (typeof window !== 'undefined' && window.open) {
                      const popup = window.open(
                        url, 
                        'google-auth-popup',
                        'width=500,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,directories=no,status=no'
                      );
                      if (popup) {
                        popup.focus();
                      }
                    } else {
                      window.location.href = url;
                    }
                  }}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 btn shadow-lg hover:shadow-xl"
                >
                  <span className="flex items-center justify-center gap-2">
                    <span>🌐</span>
                    Open Google Authentication
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">3</span>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Wait for confirmation</h3>
            </div>
            <p className="text-blue-800 dark:text-blue-200 text-sm mb-4 leading-relaxed">
              After entering the code on the authentication page, this window will automatically complete the sign-in process.
            </p>
            
            {isPolling && (
              <div className="flex items-center gap-3 text-blue-800 dark:text-blue-200 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <span className="text-sm font-medium">Waiting for authentication...</span>
              </div>
            )}
          </div>

          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Code expires in:</div>
            <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Authentication Error</h4>
              <p className="text-red-700 dark:text-red-300 text-sm leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setDeviceData(null);
                  setIsPolling(false);
                }}
                className="mt-4 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-800 dark:text-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 btn"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
