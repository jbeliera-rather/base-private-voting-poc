"use client";

import { useState } from 'react';
import toast from 'react-hot-toast';

interface DiagnosticResult {
  environment: {
    // Main OAuth credentials
    hasClientId: boolean;
    hasClientSecret: boolean;
    clientIdLength: number;
    clientSecretLength: number;
    clientIdSuffix: string;
    // Device-specific credentials
    hasDeviceClientId: boolean;
    hasDeviceClientSecret: boolean;
    deviceClientIdLength: number;
    deviceClientSecretLength: number;
    deviceClientIdSuffix: string;
    // Active credentials
    activeClientIdLength: number;
    activeClientIdSuffix: string;
  };
  oauth: {
    deviceCodeEndpoint: string;
    tokenEndpoint: string;
    userInfoEndpoint: string;
  };
  recommendations: string[];
}

export default function DeviceAuthDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/device-debug', {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        setDiagnostics(data);
        toast.success('Diagnostics completed');
      } else {
        toast.error('Failed to run diagnostics');
      }
    } catch (error) {
      console.error('Diagnostics error:', error);
      toast.error('Diagnostics failed');
    } finally {
      setIsLoading(false);
    }
  };

  const testGoogleEndpoint = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/device-debug', {
        method: 'POST',
      });

      const data = await response.json();
      setTestResult(data);
      
      if (response.ok) {
        toast.success('Configuration test passed');
      } else {
        toast.error('Configuration test failed');
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Test failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Device Auth Diagnostics
      </h2>

      <div className="space-y-4">
        <button
          type="button"
          onClick={runDiagnostics}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:bg-gray-400"
        >
          {isLoading ? 'Running Diagnostics...' : 'Run Environment Diagnostics'}
        </button>

        <button
          type="button"
          onClick={testGoogleEndpoint}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:bg-gray-400"
        >
          {isLoading ? 'Testing...' : 'Test Google Configuration'}
        </button>

        {diagnostics && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">Environment Check</h3>
            
            <div className="space-y-4">
              {/* Device-specific credentials (preferred for device flow) */}
              <div className="bg-blue-50 p-3 rounded border">
                <h4 className="font-semibold text-blue-800 mb-2">Device Flow Credentials (TV/Limited Input)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>GOOGLE_DEVICE_CLIENT_ID:</span>
                    <span className={diagnostics.environment.hasDeviceClientId ? 'text-green-600' : 'text-orange-600'}>
                      {diagnostics.environment.hasDeviceClientId ? '✓ Set (Recommended)' : '○ Not Set'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>GOOGLE_DEVICE_CLIENT_SECRET:</span>
                    <span className={diagnostics.environment.hasDeviceClientSecret ? 'text-green-600' : 'text-orange-600'}>
                      {diagnostics.environment.hasDeviceClientSecret ? '✓ Set (Recommended)' : '○ Not Set'}
                    </span>
                  </div>

                  {diagnostics.environment.hasDeviceClientId && (
                    <>
                      <div className="flex justify-between">
                        <span>Device Client ID Length:</span>
                        <span>{diagnostics.environment.deviceClientIdLength} chars</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Device Client ID Suffix:</span>
                        <span className="font-mono text-xs">...{diagnostics.environment.deviceClientIdSuffix}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Standard OAuth credentials */}
              <div className="bg-gray-50 p-3 rounded border">
                <h4 className="font-semibold text-gray-800 mb-2">Standard OAuth Credentials (Web/Desktop)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>GOOGLE_CLIENT_ID:</span>
                    <span className={diagnostics.environment.hasClientId ? 'text-green-600' : 'text-red-600'}>
                      {diagnostics.environment.hasClientId ? '✓ Set' : '✗ Missing'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>GOOGLE_CLIENT_SECRET:</span>
                    <span className={diagnostics.environment.hasClientSecret ? 'text-green-600' : 'text-red-600'}>
                      {diagnostics.environment.hasClientSecret ? '✓ Set' : '✗ Missing'}
                    </span>
                  </div>

                  {diagnostics.environment.hasClientId && (
                    <>
                      <div className="flex justify-between">
                        <span>Client ID Length:</span>
                        <span>{diagnostics.environment.clientIdLength} chars</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Client ID Suffix:</span>
                        <span className="font-mono text-xs">...{diagnostics.environment.clientIdSuffix}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Active configuration */}
              <div className="bg-green-50 p-3 rounded border">
                <h4 className="font-semibold text-green-800 mb-2">Active Device Flow Configuration</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Using:</span>
                    <span className="font-semibold">
                      {diagnostics.environment.hasDeviceClientId ? 'Device Credentials' : 'Standard Credentials'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Client ID Suffix:</span>
                    <span className="font-mono text-xs">...{diagnostics.environment.activeClientIdSuffix}</span>
                  </div>
                </div>
              </div>
            </div>

            {diagnostics.recommendations.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-red-800 mb-2">Recommendations:</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-red-700">
                  {diagnostics.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4">
              <h4 className="font-semibold text-gray-800 mb-2">Google Endpoints:</h4>
              <ul className="text-xs space-y-1 font-mono text-gray-600">
                <li>Device Code: {diagnostics.oauth.deviceCodeEndpoint}</li>
                <li>Token: {diagnostics.oauth.tokenEndpoint}</li>
                <li>User Info: {diagnostics.oauth.userInfoEndpoint}</li>
              </ul>
            </div>
          </div>
        )}

        {testResult && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">Configuration Test</h3>
            <pre className="text-xs bg-white p-3 rounded border overflow-auto">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}

        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <h3 className="font-semibold text-red-800 mb-2">⚠️ Important: Device Flow Requirements</h3>
          <div className="text-sm text-red-700 mb-4">
            <strong>Google requires a specific client type for device code flow!</strong>
            <br />
            If you're getting "Only clients of type 'TVs and Limited Input devices' can use..." error, 
            you need to create a new OAuth client with the correct type.
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Setup Instructions for Device Flow</h3>
          <ol className="list-decimal pl-5 space-y-3 text-sm text-blue-700">
            <li>
              <strong>Go to Google Cloud Console:</strong>
              <br />
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">
                https://console.cloud.google.com/apis/credentials
              </a>
            </li>
            <li>
              <strong>Create OAuth 2.0 Client ID:</strong>
              <br />
              Click "Create Credentials" → "OAuth client ID"
            </li>
            <li>
              <strong>⚠️ CRITICAL: Select Application Type:</strong>
              <br />
              <span className="font-semibold bg-yellow-200 px-2 py-1 rounded">
                Choose "TV and Limited Input device"
              </span>
              <br />
              <em>(This is required for device code flow to work)</em>
            </li>
            <li>
              <strong>Copy credentials:</strong>
              <br />
              Copy the Client ID and Client Secret
            </li>
            <li>
              <strong>Update environment variables:</strong>
              <br />
              Add to your .env.local file (recommended approach):
              <div className="bg-gray-800 text-green-400 p-2 rounded mt-1 font-mono text-xs">
                # For device code flow (TV client)<br/>
                GOOGLE_DEVICE_CLIENT_ID=your-tv-client-id.apps.googleusercontent.com<br/>
                GOOGLE_DEVICE_CLIENT_SECRET=your-tv-client-secret<br/>
                <br/>
                # For standard OAuth flow (keep existing)<br/>
                GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com<br/>
                GOOGLE_CLIENT_SECRET=your-web-client-secret<br/>
                <br/>
                # Required<br/>
                NEXTAUTH_SECRET=your-secret-key
              </div>
              <div className="mt-2 text-xs text-blue-600">
                💡 <strong>Pro tip:</strong> You can use separate clients for device flow (TV type) and standard OAuth (Web type), 
                or just create a TV client and use it for both.
              </div>
            </li>
            <li>
              <strong>Alternative Option:</strong>
              <br />
              You can keep your existing web client for standard OAuth and create a separate 
              TV client just for device code flow
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
