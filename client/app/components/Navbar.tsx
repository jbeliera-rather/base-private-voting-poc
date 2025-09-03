"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import Tooltip from "./Tooltip";
import { tooltipTexts } from "../utils/tooltipTexts";
import { FarcasterAuth } from "../utils/farcaster-auth";

export default function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await FarcasterAuth.signIn(window.location.pathname);
      if (result.success) {
        // Notify Farcaster client of successful authentication
        FarcasterAuth.notifyAuthStatus(true);
        router.refresh();
      } else {
        console.error('Farcaster sign in failed:', result.error);
        // Notify Farcaster client of authentication error
        FarcasterAuth.notifyAuthStatus(false, result.error);
        // Fallback to standard NextAuth sign in
        signIn("google", { callbackUrl: window.location.pathname });
      }
    } catch (error) {
      console.error('Farcaster auth error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      FarcasterAuth.notifyAuthStatus(false, errorMessage);
      // Fallback to standard NextAuth sign in
      signIn("google", { callbackUrl: window.location.pathname });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ 
      callbackUrl: window.location.pathname,
      redirect: true 
    });
    router.refresh();
  };

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-lg border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:h-16 py-4 sm:py-0 gap-4 sm:gap-0">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/Rather.png"
                alt="Rather labs logo"
                width={32}
                height={32}
                className="rounded-full"
              />
              <Tooltip text={tooltipTexts.title} showIcon position="bottom-end" mobilePosition="bottom-start">
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  Rather Labs Private Voting PoC
                </span>
              </Tooltip>
            </Link>
          
          </div>
          
          
          {/* Google Auth - Right */}
          <div className="flex items-center">
            {session ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {session.user?.image && (
                    <Image
                      src={session.user.image}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {session.user?.name}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {session.user?.email}
                    </span>
                  </div>
                </div>
                <Tooltip text={tooltipTexts.signOut} showIcon>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="bg-red-100 hover:bg-red-200 dark:bg-red-600 dark:hover:bg-red-700 text-red-900 dark:text-white px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-default"
                  >
                    Sign Out
                  </button>
                </Tooltip>
              </div>
            ) : (
              <Tooltip text={tooltipTexts.signIn} showIcon>
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isSigningIn || status === 'loading'}
                  className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-600 dark:hover:bg-blue-700 text-blue-900 dark:text-white px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-default disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSigningIn ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-900 dark:border-white" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 