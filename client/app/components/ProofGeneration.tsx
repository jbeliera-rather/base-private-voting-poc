"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { generateInputs } from "noir-jwt";
import { generateProof } from "../utils/noir";
import type { CompiledCircuit, InputMap, ProofData } from "@noir-lang/types";
import type { Voting } from "../server/db/voting-db";
import JwtCircuitJSON from '@/public/circuit/jwtnoir.json' assert { type: 'json' };
import Tooltip from "./Tooltip";
import { tooltipTexts } from "../utils/tooltipTexts";

interface ExtendedSession {
  idToken?: string;
  [key: string]: unknown;
}

interface ExtendedProofData extends ProofData {
  submitted?: boolean;
}

interface ProofGenerationProps {
  voting: Voting;
  setVoting: (voting: Voting) => void;
}

export default function VotingProofGeneration({ voting, setVoting }: ProofGenerationProps) {
  const { data: session, status, update } = useSession();
  const params = useParams();
  const [proof, setProof] = useState<ExtendedProofData | null>(null);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  // Debug session changes
  useEffect(() => {
    console.log('Session status changed:', {
      status,
      hasSession: !!session,
      sessionKeys: session ? Object.keys(session) : [],
      hasToken: !!(session as { token?: unknown })?.token,
      tokenKeys: (session as { token?: Record<string, unknown> })?.token ? Object.keys((session as { token?: Record<string, unknown> }).token || {}) : [],
      hasIdToken: !!(session as { token?: { idToken?: string } })?.token?.idToken,
    });
  }, [session, status]);

  // Function to refresh session
  const refreshSession = async () => {
    try {
      console.log('Refreshing session...');
      const refreshed = await update();
      console.log('Session refreshed');
      return refreshed;
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return null;
    }
  };

  // Utility function to safely decode base64 with proper padding
  const safeBase64Decode = (str: string): string => {
    // Replace URL-safe characters and add padding if needed
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return atob(base64);
  };

  // Utility function to decode JWT payload
  const decodeJWTPayload = (token: string) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      return JSON.parse(safeBase64Decode(parts[1]));
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  };

  // Function to get ID token from session cookie directly
  const getSessionTokenFromCookie = () => {
    try {
      // Get the session token from the secure cookie
      const cookies = document.cookie.split(';');
      const sessionCookie = cookies.find(cookie => 
        cookie.trim().startsWith('__Secure-next-auth.session-token=') || 
        cookie.trim().startsWith('next-auth.session-token=')
      );
      
      if (sessionCookie) {
        const tokenValue = sessionCookie.split('=')[1];
        console.log('Found session cookie:', tokenValue ? `${tokenValue.substring(0, 50)}...` : 'empty');
        
        if (tokenValue) {
          const payload = decodeJWTPayload(tokenValue);
          if (payload) {
            console.log('Decoded session token payload:', payload);
            return payload;
          }
        }
      }
      
      console.log('No session cookie found');
      return null;
    } catch (error) {
      console.error('Error reading session cookie:', error);
      return null;
    }
  };

  async function getInputs() {
    if (status === "authenticated" && session) {
      try {
        setError(null);

        console.log('Starting ID token retrieval...');
        console.log('Full session object:', session);
        
        let idToken: string | null = null;

        // Strategy 1: Check session.token.idToken (both OAuth and device auth store here)
        const sessionWithToken = session as { token?: { idToken?: string } };
        if (sessionWithToken.token?.idToken) {
          idToken = sessionWithToken.token.idToken;
          console.log('✓ Found ID token in session.token.idToken');
        }

        // Strategy 2: Check session.idToken directly (NextAuth session callback also stores here)
        if (!idToken) {
          const extendedSession = session as unknown as ExtendedSession;
          if (extendedSession.idToken) {
            idToken = extendedSession.idToken;
            console.log('✓ Found ID token in session.idToken');
          }
        }

        // Strategy 4: Fetch fresh ID token from server
        if (!idToken) {
          console.log('Fetching fresh ID token from server...');
          try {
            const idTokenResponse = await fetch('/api/auth/id-token');
            if (idTokenResponse.ok) {
              const data = await idTokenResponse.json();
              if (data.id_token) {
                idToken = data.id_token;
                console.log('✓ Retrieved fresh ID token from server');
              } else {
                console.warn('Server response missing id_token:', data);
              }
            } else {
              const error = await idTokenResponse.json();
              console.warn('Server ID token fetch failed:', error);
            }
          } catch (e) {
            console.warn('Error fetching ID token from server:', e);
          }
        }

        // Strategy 5: Try session refresh
        if (!idToken) {
          console.log('Refreshing session...');
          const refreshedSession = await refreshSession();
          if (refreshedSession) {
            const refreshedToken = (refreshedSession as { token?: { idToken?: string } }).token?.idToken;
            const refreshedDirect = (refreshedSession as unknown as ExtendedSession).idToken;
            
            idToken = refreshedToken || refreshedDirect || null;
            if (idToken) {
              console.log('✓ Found ID token after session refresh');
            }
          }
        }

        // Final check
        if (!idToken) {
          console.error('All ID token retrieval strategies failed');
          throw new Error("ID token not available. Please sign out and sign back in to refresh your authentication.");
        }

        // get public key from google
        const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
        if (!response.ok) {
          throw new Error(`Failed to fetch Google JWKS (status ${response.status})`);
        }
        const keys = await response.json();
        
        console.log('Using ID token for proof generation');

        const [headerEncoded] = idToken.split('.');
        if (!headerEncoded) {
          throw new Error("Invalid JWT format");
        }
        
        const header = JSON.parse(safeBase64Decode(headerEncoded));
        const kid = header.kid;
        if (!kid) {
          throw new Error("JWT header missing 'kid'");
        }
        const pubkey = keys.keys.find((key: { kid: string }) => key.kid === kid);
        if (!pubkey) {
          throw new Error('Public key not found for token kid in Google JWKS');
        }

        const generatedInputs = await generateInputs({
          jwt: idToken,
          pubkey,
          maxSignedDataLength: 1024,
        });
        return generatedInputs;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to get inputs";
        setError(errorMessage);
        return null;
      } 
    }
    return null;
  }

  async function checkNullifier(nullifier: string) {
    try {
      const response = await fetch(`/api/voting/check-nullifier?electionId=${params.id}&nullifier=${nullifier}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to check nullifier');
      }
      const { hasVoted } = await response.json();
      setHasVoted(hasVoted);
      if (hasVoted) {
        setMessage('This account has already cast a vote in this election');
      } 
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check if you have voted');
    }
  }

  async function generateNoirProof() {
    try {
      setIsGeneratingProof(true);
      setError(null);
      
      // Check authentication status first
      if (status !== "authenticated" || !session) {
        throw new Error("Please sign in to generate a proof");
      }
      
      const inputs = await getInputs() as InputMap;
      if (!inputs) {
        throw new Error(error || "Failed to generate JWT proof data. Please try signing out and back in.");
      }
      // Add election index to inputs
      inputs.election_id = Number(params.id);
      const generatedProof = await generateProof(JwtCircuitJSON as CompiledCircuit, inputs as InputMap);
      setProof(generatedProof);

      // Check if the nullifier has already voted
      await checkNullifier(generatedProof.publicInputs[1]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate proof";
      setError(errorMessage);
    } finally {
      setIsGeneratingProof(false);
    }
  }

  async function submitVote() {
    if (!proof || selectedOption === null || hasVoted) return;
              
    try {
      setIsSubmittingVote(true);
      // Store the nullifier and vote
      const response = await fetch('/api/voting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          electionId: Number(params.id),
          proof: proof,
          selectedOption: selectedOption,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit vote. Try again later. If the problem persists, add an issue on GitHub.');
      }

      // Show success message
      setProof({ ...proof, submitted: true });
      
      // Update the voting results without page reload
      const updatedVoting = await fetch(`/api/voting?id=${Number(params.id)}`).then(res => res.json());
      setVoting(updatedVoting);      
      setHasVoted(true);
      setMessage('Your vote has been submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setIsSubmittingVote(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Debug information for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded border">
          <div className="flex justify-between items-start">
            <div>
              <strong>Debug Info:</strong><br/>
              Status: {status}<br/>
              Has Session: {session ? 'Yes' : 'No'}<br/>
              Has Token Object: {session && (session as { token?: unknown }).token ? 'Yes' : 'No'}<br/>
              Token ID Token: {session && (session as { token?: { idToken?: string } }).token?.idToken ? 'Yes' : 'No'}<br/>
              Fallback ID Token: {session && (session as unknown as ExtendedSession).idToken ? 'Yes' : 'No'}
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={refreshSession}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                Refresh Session
              </button>
              <button
                type="button"
                onClick={() => {
                  const payload = getSessionTokenFromCookie();
                  console.log('Manual cookie check result:', payload);
                }}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded hover:bg-green-200 dark:hover:bg-green-800"
              >
                Check Cookie
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div>
        <select
          id="voting-option"
          value={selectedOption === null ? '' : selectedOption}
          disabled={isSubmittingVote || hasVoted}
          onChange={(e) => setSelectedOption(Number(e.target.value))}
          className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500 dark:focus:ring-purple-400 sm:text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 transition-colors"
        >
          <option value="" className="text-gray-900 dark:text-white">Choose an option</option>
          {voting.options.map((option, index) => (
            <option key={option.name} value={index} className="text-gray-900 dark:text-white">
              {option.name}
            </option>
          ))}
        </select>
      </div>

      {status === "authenticated" ? (
        <div className="flex flex-col space-y-4">
          <Tooltip text={tooltipTexts.generateProof} showIcon position="top-end">
            <button
              type="button"
              onClick={generateNoirProof}
              disabled={isGeneratingProof || isSubmittingVote }
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-900 dark:text-white bg-purple-100 dark:bg-purple-700 hover:bg-purple-200 dark:hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-purple-400 disabled:opacity-50 disabled:cursor-not-allowed w-fit transition-colors"
            >
              {isGeneratingProof ? "Generating..." : "Generate Proof"}
            </button>
          </Tooltip>

          <Tooltip text={tooltipTexts.verifyProof} showIcon position="top-end">
            <button
              type="button"
              onClick={submitVote}
              disabled={!proof || selectedOption === null || isSubmittingVote || isGeneratingProof || hasVoted}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-900 dark:text-white bg-green-100 dark:bg-green-700 hover:bg-green-200 dark:hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed w-fit transition-colors"
            >
              {isSubmittingVote ? "Verifying Proof & Submitting Vote..." : "Verify Proof & Submit Vote"}
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="text-sm text-gray-900 dark:text-white">
          Please sign in to vote
        </div>
      )}

      {hasVoted && (
        <div className="text-sm text-gray-900 dark:text-white bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-200 dark:border-green-800">
          {message}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
