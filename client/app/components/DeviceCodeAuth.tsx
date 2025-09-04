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
  }, [deviceData, isPolling, onSuccess, onError]);

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
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Device Authentication
      </h2>

      {!deviceData && !isLoading && (
        <div className="text-center">
          <p className="text-gray-600 mb-6">
            Authenticate using Google's secure device flow. Perfect for untrusted browsers or limited input devices.
          </p>
          <button
            type="button"
            onClick={initiateDeviceAuth}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
          >
            Start Device Authentication
          </button>
        </div>
      )}

      {isLoading && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Initializing authentication...</p>
        </div>
      )}

      {deviceData && (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Step 1: Copy this code</h3>
            <div className="flex items-center gap-2">
              <code className="bg-white px-3 py-2 rounded border text-lg font-mono tracking-wider flex-1 text-center">
                {deviceData.user_code}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(deviceData.user_code)}
                className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded transition duration-200"
                title="Copy code"
              >
                📋
              </button>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Step 2: Visit this URL</h3>
            {deviceData.verification_uri ? (
              <div className="flex items-center gap-2 mb-3">
                <code className="bg-white px-3 py-2 rounded border text-sm flex-1">
                  {deviceData.verification_uri}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(deviceData.verification_uri)}
                  className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded transition duration-200"
                  title="Copy URL"
                >
                  📋
                </button>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-3">
                <p className="text-yellow-800 text-sm mb-2">
                  ⚠️ Verification URL not provided by Google. Please try this fallback:
                </p>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-3 py-2 rounded border text-sm flex-1">
                    https://www.google.com/device
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('https://www.google.com/device')}
                    className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded transition duration-200"
                    title="Copy URL"
                  >
                    📋
                  </button>
                </div>
              </div>
            )}
            
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
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-center block"
              >
                Open Authentication Page (Pre-filled Code)
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
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-center block"
              >
                Open Google Authentication
              </button>
            )}
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Step 3: Wait for confirmation</h3>
            <p className="text-blue-700 text-sm mb-3">
              After entering the code on the authentication page, this window will automatically complete the sign-in process.
            </p>
            
            {isPolling && (
              <div className="flex items-center gap-2 text-blue-700">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                <span className="text-sm">Waiting for authentication...</span>
              </div>
            )}
          </div>

          <div className="text-center text-sm text-gray-500">
            Code expires in: <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
                      <button
              type="button"
              onClick={() => {
                setError(null);
                setDeviceData(null);
                setIsPolling(false);
              }}
              className="mt-2 text-red-600 hover:text-red-700 underline text-sm"
            >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
