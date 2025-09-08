"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import Tooltip from "./Tooltip";
import { tooltipTexts } from "../utils/tooltipTexts";

export default function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      // Redirect to device authentication page
      router.push('/auth/signin');
    } catch (error) {
      console.error('Navigation error:', error);
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
          
          
          {/* Auth Controls - Right */}
          <div className="flex items-center">
            {session ? (
              <div className="flex items-center space-x-3">
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
                    className="bg-red-100 hover:bg-red-200 dark:bg-red-600 dark:hover:bg-red-700 text-red-900 dark:text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 btn"
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
                  className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-600 dark:hover:bg-blue-700 text-blue-900 dark:text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 btn disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSigningIn ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-900 dark:border-white" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" aria-label="Google logo">
                        <title>Google</title>
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span>Google</span>
                    </>
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