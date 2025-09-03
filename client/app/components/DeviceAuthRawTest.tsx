"use client";

import { useState } from 'react';
import toast from 'react-hot-toast';

interface GoogleDeviceResponse {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  expires_in?: number;
  interval?: number;
  error?: string;
  error_description?: string;
}

export default function DeviceAuthRawTest() {
  const [response, setResponse] = useState<GoogleDeviceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rawResponse, setRawResponse] = useState<string>('');

  const testDirectGoogleCall = async () => {
    setIsLoading(true);
    setResponse(null);
    setRawResponse('');
    
    try {
      console.log('Making direct call to device auth API...');
      const apiResponse = await fetch('/api/auth/device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'initiate' }),
      });

      const text = await apiResponse.text();
      setRawResponse(text);
      
      try {
        const data = JSON.parse(text);
        setResponse(data);
        
        if (apiResponse.ok) {
          toast.success('API call successful');
        } else {
          toast.error('API call failed');
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        toast.error('Invalid JSON response');
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Test failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Device Auth Raw Response Test
      </h2>

      <div className="space-y-4">
        <button
          type="button"
          onClick={testDirectGoogleCall}
          disabled={isLoading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:bg-gray-400"
        >
          {isLoading ? 'Testing Google Device API...' : 'Test Direct Google Device API Call'}
        </button>

        {rawResponse && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">Raw API Response</h3>
            <pre className="text-xs bg-black text-green-400 p-4 rounded overflow-auto whitespace-pre-wrap">
              {rawResponse}
            </pre>
          </div>
        )}

        {response && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-3">Parsed Response Analysis</h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Device Code:</strong>
                <div className={response.device_code ? 'text-green-600' : 'text-red-600'}>
                  {response.device_code ? '✓ Present' : '✗ Missing'}
                </div>
              </div>
              
              <div>
                <strong>User Code:</strong>
                <div className={response.user_code ? 'text-green-600' : 'text-red-600'}>
                  {response.user_code || 'Missing'}
                </div>
              </div>
              
              <div>
                <strong>Verification URI:</strong>
                <div className={response.verification_uri ? 'text-green-600' : 'text-red-600'}>
                  {response.verification_uri || 'MISSING - This is the issue!'}
                </div>
              </div>
              
              <div>
                <strong>Verification URI Complete:</strong>
                <div className={response.verification_uri_complete ? 'text-green-600' : 'text-orange-600'}>
                  {response.verification_uri_complete || 'Not provided (optional)'}
                </div>
              </div>
              
              <div>
                <strong>Expires In:</strong>
                <div>{response.expires_in ? `${response.expires_in} seconds` : 'Not provided'}</div>
              </div>
              
              <div>
                <strong>Interval:</strong>
                <div>{response.interval ? `${response.interval} seconds` : 'Not provided'}</div>
              </div>
            </div>

            {response.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <h4 className="font-semibold text-red-800">Error:</h4>
                <p className="text-red-700">{response.error}</p>
                {response.error_description && (
                  <p className="text-red-600 text-sm mt-1">{response.error_description}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Common Issues:</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-700">
            <li><strong>Empty verification_uri:</strong> Usually means wrong OAuth client type (need TV/Limited Input device)</li>
            <li><strong>Invalid client error:</strong> Wrong GOOGLE_CLIENT_ID or it's not for TV devices</li>
            <li><strong>Missing credentials:</strong> Check environment variables</li>
            <li><strong>403/400 errors:</strong> OAuth client not configured for device flow</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
