"use client";

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import DeviceCodeAuth from '../../components/DeviceCodeAuth';

export default function SignInPage() {
  const [authMethod, setAuthMethod] = useState<'standard' | 'device' | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const handleStandardAuth = () => {
    signIn('google', { callbackUrl });
  };

  const handleDeviceAuthSuccess = () => {
    // Redirect to the callback URL after successful device authentication
    router.push(callbackUrl);
  };

  const handleDeviceAuthError = (error: string) => {
    console.error('Device authentication error:', error);
    // Could show error UI or allow user to try again
  };

  if (authMethod === 'device') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Sign In
          </h1>
          
          <DeviceCodeAuth 
            onSuccess={handleDeviceAuthSuccess}
            onError={handleDeviceAuthError}
          />
          
          <div className="mt-6 text-center">
                      <button
            type="button"
            onClick={() => setAuthMethod(null)}
            className="text-blue-600 hover:text-blue-700 text-sm underline"
          >
              ← Back to authentication options
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Sign In
        </h1>
        
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 space-y-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Choose Authentication Method
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Select the authentication method that works best for your environment.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStandardAuth}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Standard Google Sign-In
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAuthMethod('device')}
            className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Device Code Authentication
          </button>

          <div className="mt-4 text-xs text-gray-500">
            <p className="mb-2">
              <strong>Standard Sign-In:</strong> Quick and easy, works in most browsers
            </p>
            <p>
              <strong>Device Code:</strong> Secure option for untrusted browsers, limited input devices, or when privacy is a concern
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


