"use client";

import DeviceCodeAuth from '../../components/DeviceCodeAuth';
import Navbar from '../../components/Navbar';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 transition-colors">
      <Navbar />
      <main className="flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center mb-12 animate-fadeIn">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-700 via-gray-700 to-slate-800 dark:from-slate-300 dark:via-gray-300 dark:to-slate-400 bg-clip-text text-transparent mb-4">
              Welcome Back
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-md mx-auto">
              Sign in to access secure, private voting and create your own elections.
            </p>
          </div>
          
          <div className="animate-slideIn">
            <DeviceCodeAuth />
          </div>
          
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>🔒 Secure Authentication</span>
              <span>•</span>
              <span>🛡️ Privacy Protected</span>
              <span>•</span>
              <span>⚡ Fast & Reliable</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


