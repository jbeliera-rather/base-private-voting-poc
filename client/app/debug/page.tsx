"use client";

import { useState } from 'react';
import DeviceAuthDiagnostics from '../components/DeviceAuthDiagnostics';
import DeviceCodeAuth from '../components/DeviceCodeAuth';
import DeviceAuthRawTest from '../components/DeviceAuthRawTest';
import TokenExchangeDebug from '../components/TokenExchangeDebug';

export default function DebugPage() {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'test' | 'raw' | 'token'>('diagnostics');

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Device Authentication Debug
        </h1>
        
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg p-1 shadow-sm border">
            <button
              type="button"
              onClick={() => setActiveTab('diagnostics')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'diagnostics'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-blue-600'
              }`}
            >
              Diagnostics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'raw'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-700 hover:text-purple-600'
              }`}
            >
              Raw API Test
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('token')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'token'
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-700 hover:text-orange-600'
              }`}
            >
              Token Exchange
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('test')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'test'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-700 hover:text-green-600'
              }`}
            >
              Full Flow Test
            </button>
          </div>
        </div>

        {activeTab === 'diagnostics' && <DeviceAuthDiagnostics />}
        {activeTab === 'raw' && <DeviceAuthRawTest />}
        {activeTab === 'token' && <TokenExchangeDebug />}
        {activeTab === 'test' && (
          <DeviceCodeAuth 
            onSuccess={() => console.log('Auth success')}
            onError={(error) => console.error('Auth error:', error)}
          />
        )}
      </div>
    </div>
  );
}
