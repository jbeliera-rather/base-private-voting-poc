"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "../../components/Navbar";
import { Toaster } from 'react-hot-toast';
import VotingProofGeneration from "../../components/ProofGeneration";
import type { Voting } from "../../server/db/voting-db";
import { formatLocalDate } from "../../utils/locale";

export default function VotingPage() {
  const params = useParams();
  const [voting, setVoting] = useState<Voting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVoting() {
      try {
        const response = await fetch(`/api/voting?id=${Number(params.id)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch voting');
        }
        const data = await response.json();
        setVoting(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load voting');
      } finally {
        setLoading(false);
      }
    }

    fetchVoting();
    
    // Calculate time until next minute starts
    const now = new Date();
    const secondsUntilNextMinute = 65 - now.getSeconds(); // Checks five seconds after the minute starts
    const millisecondsUntilNextMinute = secondsUntilNextMinute * 1000;
    
    // Set initial timeout to start at the beginning of the next minute
    const initialTimeout = setTimeout(() => {
      fetchVoting(); // Fetch immediately at the start of the minute
      
      // Then set up interval for every minute after that
      const interval = setInterval(fetchVoting, 60000);
      
      // Cleanup interval on unmount
      return () => clearInterval(interval);
    }, millisecondsUntilNextMinute);
    
    // Cleanup timeout on unmount
    return () => clearTimeout(initialTimeout);
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center text-gray-900 dark:text-white">Loading...</div>
        </main>
      </div>
    );
  }

  if (error || !voting) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center text-red-600 dark:text-red-400">
            {error || 'Voting not found'}
          </div>
        </main>
      </div>
    );
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700';
      case 'closed':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600';
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 transition-colors">
      <Navbar />
      <Toaster />
      <main className="max-w-6xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-12 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div className="flex-1">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-700 via-gray-700 to-slate-800 dark:from-slate-300 dark:via-gray-300 dark:to-slate-400 bg-clip-text text-transparent mb-2">{voting.title}</h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl">
                  {voting.description}
                </p>
              </div>
              <div className={`px-4 py-2 rounded-2xl text-sm font-semibold border ${getStatusColor(voting.status)} flex items-center gap-2`}>
                {voting.status === 'active' ? '🟢 Open' : voting.status === 'pending' ? '⏳ Upcoming' : '🔒 Closed'}
              </div>
            </div>
            <div className="mb-12 animate-slideIn">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                📋 Election Details
              </h2>
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <span className="text-2xl">📅</span>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">Start Date</div>
                      <div className="text-gray-600 dark:text-gray-300">{formatLocalDate(voting.startDate)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <span className="text-2xl">🏁</span>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">End Date</div>
                      <div className="text-gray-600 dark:text-gray-300">{formatLocalDate(voting.endDate)}</div>
                    </div>
                  </div>
                  {voting.maxVoters && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                      <span className="text-2xl">👥</span>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">Max Voters</div>
                        <div className="text-gray-600 dark:text-gray-300">{voting.maxVoters}</div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Election closes when reached</p>
                      </div>
                    </div>
                  )}
                  {voting.voteThreshold && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                      <span className="text-2xl">🎯</span>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">Vote Threshold</div>
                        <div className="text-gray-600 dark:text-gray-300">{voting.voteThreshold}</div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Election ends when any option reaches this</p>
                      </div>
                    </div>
                  )}
                  {voting.amount && voting.amount > 0 && (
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                        <span className="text-3xl">💰</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-gray-900 dark:text-white">Funding Amount</div>
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">{voting.amount} ETH</div>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {voting.status === 'closed' && voting.fundsDistributed 
                              ? "Funds have been distributed to the winning option's address"
                              : "This amount will be transferred to the winning option's designated address"
                            }
                          </p>
                          {voting.status === 'closed' && voting.fundsDistributed && (
                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 font-semibold">
                              ✅ Distributed
                            </span>
                          )}
                          {voting.status === 'closed' && !voting.fundsDistributed && (
                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 font-semibold">
                              ⏳ Pending
                            </span>
                          )}
                        </div>
                      </div>
                      {voting.status === 'closed' && voting.fundsDistributed && voting.distributionTxHash && (
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-700 dark:text-gray-300">Transaction:</span>
                            <a 
                              href={`https://sepolia.basescan.org/tx/${voting.distributionTxHash}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                            >
                              {voting.distributionTxHash.slice(0, 10)}...{voting.distributionTxHash.slice(-8)}
                            </a>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(voting.distributionTxHash || '')}
                              className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                              title="Copy full transaction hash"
                            >
                              📋
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Voting Options */}
            <div className="mb-12 animate-slideIn">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                🗳️ Voting Options
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {voting.options.map((option, index) => (
                  <div key={`${option.name}-${index}`} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 transition-all duration-200 card hover:scale-105">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{option.name}</h3>
                        <p className="text-gray-700 dark:text-gray-300 text-sm mb-4 leading-relaxed">{option.description}</p>
                        {voting.amount && voting.amount > 0 && option.address && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">💳 Funding Address:</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                              <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">
                                {option.address}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Results Section - Only show if results are public or voting is closed */}
            {(voting.isPublic || voting.status === 'closed') && (
              <div className="mb-12 animate-slideIn">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  {voting.status === 'closed' ? "🏆 Final Results" : "📊 Current Votes"}
                </h2>
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 card">
                  {(() => {
                    const totalVotes = voting.results.reduce((sum, votes) => sum + votes, 0);
                    const winningIndex = voting.results.indexOf(Math.max(...voting.results));
                    const isWinnerDetermined = voting.status === 'closed' && totalVotes > 0;
                    
                    return (
                      <>
                        <div className="mb-6 text-center">
                          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Total Votes</div>
                          <div className="text-4xl font-bold gradient-text">{totalVotes}</div>
                        </div>
                        {voting.amount && voting.amount > 0 && isWinnerDetermined && (
                          <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-2xl">
                            <div className="text-center mb-4">
                              <div className="text-6xl mb-2">🏆</div>
                              <div className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">Winner Announced!</div>
                              <div className="text-xl font-semibold text-green-900 dark:text-green-100">
                                {voting.options[winningIndex]?.name}
                              </div>
                            </div>
                            <div className="text-center">
                              <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 font-semibold">
                                💰 {voting.amount} ETH Prize
                              </span>
                            </div>
                            {voting.options[winningIndex]?.address && (
                              <div className="mt-3">
                                <span className="text-xs text-green-700 dark:text-green-300">Recipient Address:</span>
                                <p className="text-xs font-mono text-green-800 dark:text-green-200 break-all">
                                  {voting.options[winningIndex].address}
                                </p>
                              </div>
                            )}
                            {voting.fundsDistributed && voting.distributionTxHash && (
                              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-green-700 dark:text-green-300">✅ Funds Distributed</span>
                                  <span className="text-xs text-green-600 dark:text-green-400">
                                    ({new Date().toLocaleDateString()})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-green-700 dark:text-green-300">Transaction:</span>
                                  <a 
                                    href={`https://sepolia.basescan.org/tx/${voting.distributionTxHash}`}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline break-all"
                                  >
                                    {voting.distributionTxHash}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => navigator.clipboard.writeText(voting.distributionTxHash || '')}
                                    className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                                    title="Copy transaction hash"
                                  >
                                    📋
                                  </button>
                                </div>
                              </div>
                            )}
                            {voting.fundsDistributed && !voting.distributionTxHash && (
                              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                                <span className="text-xs text-green-700 dark:text-green-300">
                                  ⚠️ Funds distribution attempted (no votes cast or missing address)
                                </span>
                              </div>
                            )}
                            {voting.amount && voting.amount > 0 && !voting.fundsDistributed && (
                              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                                <span className="text-xs text-yellow-700 dark:text-yellow-300">
                                  ⏳ Funds distribution pending...
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="space-y-4">
                          {voting.results.map((votes, index) => {
                            const option = voting.options[index];
                            const percentage = totalVotes > 0 
                              ? (votes / totalVotes) * 100
                              : 0;
                            
                            const displayPercentage = percentage.toFixed(1);
                            const isWinner = isWinnerDetermined && index === winningIndex;
                            
                            return (
                              <div key={`${option.name}-${index}`} className={`p-4 rounded-xl border transition-all duration-300 ${isWinner ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className={`flex items-center gap-3 ${isWinner ? 'text-green-900 dark:text-green-100' : 'text-gray-900 dark:text-white'}`}>
                                    {isWinner && <span className="text-2xl">🏆</span>}
                                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                                      <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                                        {index + 1}
                                      </span>
                                    </div>
                                    <div className="font-semibold">{option.name}</div>
                                  </div>
                                  <div className={`text-right ${isWinner ? 'text-green-700 dark:text-green-300 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                                    <div className="text-lg font-bold">{votes} votes</div>
                                    <div className="text-sm">{displayPercentage}%</div>
                                  </div>
                                </div>
                                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isWinner 
                                        ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                                        : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                    }`}
                                    style={{ width: `${percentage}%`, maxWidth: '100%' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
          {voting.status === 'active' && (
            <div className="mb-12 animate-slideIn">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                🗳️ Cast Your Vote
              </h2>
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 card">
                <VotingProofGeneration voting={voting} setVoting={setVoting} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 