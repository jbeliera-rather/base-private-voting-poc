"use client";

import { useState } from 'react';
import toast from 'react-hot-toast';

interface TokenDebugResult {
  success: boolean;
  status: string;
  message?: string;
  error?: string;
  googleError?: string;
  troubleshooting?: string;
  rawResponse?: Record<string, unknown>;
}

export default function TokenExchangeDebug() {
  const [deviceCode, setDeviceCode] = useState('');
  const [result, setResult] = useState<TokenDebugResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testTokenExchange = async () => {
    if (!deviceCode.trim()) {
      toast.error('Please enter a device code');
      return;
    }

    setIsLoading(true);
    setResult(null);
    
    try {
      console.log('Testing token exchange with device code:', deviceCode);
      const response = await fetch('/api/auth/device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'poll',
          device_code: deviceCode.trim()
        }),
      });

      const data = await response.json();
      console.log('Token exchange response:', { status: response.status, data });
      
      setResult({
        success: response.ok && data.status === 'success',
        status: response.status.toString(),
        message: data.message,
        error: data.error,
        googleError: data.googleError,
        troubleshooting: data.troubleshooting,
        rawResponse: data,
      });

      if (response.ok) {
        if (data.status === 'success') {
          toast.success('Token exchange successful!');
        } else if (data.status === 'authorization_pending') {
          toast('Authorization pending - complete authentication first', {
            icon: 'ℹ️',
            style: {
              background: '#3b82f6',
              color: 'white',
            },
          });
        } else if (data.status === 'slow_down') {
          toast('Polling too fast - slowing down', {
            icon: '⏳',
            style: {
              background: '#f59e0b',
              color: 'white',
            },
          });
        }
      } else {
        toast.error(data.message || data.error || 'Token exchange failed');
      }
    } catch (error) {
      console.error('Token exchange test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Test failed';
      setResult({
        success: false,
        status: 'network_error',
        error: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockDeviceCode = () => {
    // Generate a mock device code for testing (this won't work but helps test the flow)
    const mockCode = `4/${Array.from({ length: 43 }, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[
        Math.floor(Math.random() * 64)
      ]
    ).join('')}`;
    setDeviceCode(mockCode);
    toast('Generated mock device code for testing', {
      icon: '🔧',
      style: {
        background: '#10b981',
        color: 'white',
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Token Exchange Debug Tool
      </h2>

      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-3">Test Token Exchange</h3>
          <p className="text-blue-700 text-sm mb-4">
            Enter a device code from a device authentication flow to test the token exchange process.
          </p>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="deviceCode" className="block text-sm font-medium text-gray-700 mb-2">
                Device Code:
              </label>
              <div className="flex gap-2">
                <input
                  id="deviceCode"
                  type="text"
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value)}
                  placeholder="4/0AX4XfWi..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={generateMockDeviceCode}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-md"
                >
                  Generate Mock
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={testTokenExchange}
              disabled={isLoading || !deviceCode.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:bg-gray-400"
            >
              {isLoading ? 'Testing Token Exchange...' : 'Test Token Exchange'}
            </button>
          </div>
        </div>

        {result && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">Exchange Result</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <strong>Status:</strong>
                <span className={`ml-2 px-2 py-1 rounded text-sm ${
                  result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {result.success ? 'Success' : 'Failed'}
                </span>
              </div>
              
              <div>
                <strong>HTTP Status:</strong>
                <span className="ml-2">{result.status}</span>
              </div>
              
              {result.message && (
                <div className="md:col-span-2">
                  <strong>Message:</strong>
                  <div className="mt-1 text-sm text-gray-600">{result.message}</div>
                </div>
              )}
              
              {result.error && (
                <div className="md:col-span-2">
                  <strong className="text-red-600">Error:</strong>
                  <div className="mt-1 text-sm text-red-600">{result.error}</div>
                </div>
              )}
              
              {result.googleError && (
                <div className="md:col-span-2">
                  <strong className="text-orange-600">Google Error:</strong>
                  <div className="mt-1 text-sm text-orange-600">{result.googleError}</div>
                </div>
              )}
              
              {result.troubleshooting && (
                <div className="md:col-span-2 bg-yellow-50 p-3 rounded border border-yellow-200">
                  <strong className="text-yellow-800">💡 Troubleshooting:</strong>
                  <div className="mt-1 text-sm text-yellow-700">{result.troubleshooting}</div>
                </div>
              )}
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                Raw Response Data
              </summary>
              <pre className="mt-2 text-xs bg-black text-green-400 p-4 rounded overflow-auto">
                {JSON.stringify(result.rawResponse, null, 2)}
              </pre>
            </details>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Common Token Exchange Errors:</h3>
          <ul className="list-disc pl-5 space-y-2 text-sm text-yellow-700">
            <li>
              <strong>invalid_client:</strong> Wrong OAuth client type - need "TV and Limited Input device"
            </li>
            <li>
              <strong>expired_token:</strong> Device code expired (usually 15-30 minutes)
            </li>
            <li>
              <strong>authorization_pending:</strong> User hasn't completed authentication yet
            </li>
            <li>
              <strong>access_denied:</strong> User declined the authorization request
            </li>
            <li>
              <strong>invalid_grant:</strong> Device code invalid, expired, or already used
            </li>
            <li>
              <strong>slow_down:</strong> Polling too frequently (Google rate limiting)
            </li>
          </ul>
        </div>

        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">How to Get a Valid Device Code:</h3>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-green-700">
            <li>Go to the "Full Flow Test" tab</li>
            <li>Click "Start Device Authentication"</li>
            <li>Copy the device code from the browser's developer console</li>
            <li>Paste it here to test the token exchange</li>
            <li>Complete authentication at the verification URL if testing real flow</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
