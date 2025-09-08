"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "./components/Navbar";
import type { Voting } from "./server/db/voting-db";
import { formatLocalDate } from "./utils/locale";
import Tooltip from "./components/Tooltip";
import { tooltipTexts } from "./utils/tooltipTexts";
import { useMiniKit } from '@coinbase/onchainkit/minikit';

interface VotingGridProps {
  filteredVotings: Voting[];
  title: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  allVotings: Voting[];
}

const VotingGrid = ({ 
  filteredVotings, 
  title, 
  searchQuery, 
  setSearchQuery, 
  currentPage, 
  setCurrentPage, 
  totalPages,
  allVotings
}: VotingGridProps) => {
  const getStatusIcon = (title: string) => {
    if (title.includes('Open')) return '🟢';
    if (title.includes('Upcoming')) return '⏳';
    if (title.includes('Closed')) return '🔒';
    return '📊';
  };

  return (
    <div className="mb-16 animate-slideIn">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4 sm:gap-0">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{getStatusIcon(title)}</span>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full text-sm font-medium">
            {filteredVotings.length}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search elections..."
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 w-64 transition-all duration-200"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 p-1">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1 || filteredVotings.length === 0}
              className="px-3 py-1 text-sm rounded-lg text-gray-900 dark:text-white disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 btn"
            >
              ←
            </button>
            <span className="px-2 text-sm text-gray-900 dark:text-white font-medium">
              {filteredVotings.length === 0 ? "0/0" : `${currentPage}/${totalPages}`}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages || filteredVotings.length === 0}
              className="px-3 py-1 text-sm rounded-lg text-gray-900 dark:text-white disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 btn"
            >
              →
            </button>
          </div>
        </div>
      </div>
      {filteredVotings.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 max-w-md mx-auto">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No {title.toLowerCase()} found</h3>
            <p className="text-gray-600 dark:text-gray-400">Check back later or create a new election!</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredVotings.map((voting, index) => (
            <Link
              key={voting.id}
              href={`/voting/${voting.id}`}
              className="block bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl dark:shadow-gray-900/20 dark:hover:shadow-gray-900/40 transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 cursor-default hover:scale-105 hover:-translate-y-2 card animate-fadeIn"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2 flex-1">
                    {voting.title}
                  </h3>
                  {voting.amount && voting.amount > 0 && (
                    <div className="ml-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-lg text-xs font-semibold">
                      💰 {voting.amount} ETH
                    </div>
                  )}
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-6 line-clamp-3 text-sm leading-relaxed">
                  {voting.description}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <span>📅</span>
                      <span className="font-medium">Start:</span>
                    </span>
                    <span>{formatLocalDate(voting.startDate)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <span>🏁</span>
                      <span className="font-medium">End:</span>
                    </span>
                    <span>{formatLocalDate(voting.endDate)}</span>
                  </div>
                  {voting.options && (
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <span>🗳️</span>
                        <span className="font-medium">Options:</span>
                      </span>
                      <span>{voting.options.length}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Click to view details</span>
                    <span className="text-indigo-600 dark:text-indigo-400 text-sm font-medium">→</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

type VotingData = {
  votings: Voting[];
  totalPages: number;
}

export default function Home() {
  const [votings, setVotings] = useState<Voting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<VotingData>({ votings: [], totalPages: 0 });
  const [pendingData, setPendingData] = useState<VotingData>({ votings: [], totalPages: 0 });
  const [closedData, setClosedData] = useState<VotingData>({ votings: [], totalPages: 0 });
  
  // Separate search queries for each section
  const [activeSearch, setActiveSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [closedSearch, setClosedSearch] = useState("");
  
  // Separate pagination for each section
  const [activePage, setActivePage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [closedPage, setClosedPage] = useState(1);
  
  const itemsPerPage = 6;

 //Initialize MiniKit
 const { setFrameReady, isFrameReady } = useMiniKit();

  useEffect(() => {
   if (!isFrameReady) setFrameReady();
  }, [isFrameReady, setFrameReady]);

  const fetchVotings = useCallback(async () => {
    try {
      const response = await fetch('/api/voting');
      if (!response.ok) {
        throw new Error('Failed to fetch votings');
      }
      const data = await response.json();
      setVotings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load votings');
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter and paginate votings for each section
  const getFilteredAndPaginatedVotings = useCallback((status: string, searchQuery: string, currentPage: number) => {
    const filtered = votings.filter((voting) => 
      voting.status === status && voting.title.toLowerCase().includes(searchQuery.toLowerCase()
      )
    );
    
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    return {
      votings: filtered.slice(startIndex, startIndex + itemsPerPage),
      totalPages
    };
  }, [votings]);

  useEffect(() => {
    fetchVotings();

    // Prepare data for each section
    setActiveData(getFilteredAndPaginatedVotings('active', activeSearch, activePage));
    setPendingData(getFilteredAndPaginatedVotings('pending', pendingSearch, pendingPage));
    setClosedData(getFilteredAndPaginatedVotings('closed', closedSearch, closedPage));
    // Calculate time until next minute starts
    const now = new Date();
    const secondsUntilNextMinute = 65 - now.getSeconds(); // Checks five seconds after the minute starts
    const millisecondsUntilNextMinute = secondsUntilNextMinute * 1000;
    
    // Set initial timeout to start at the beginning of the next minute
    const initialTimeout = setTimeout(() => {
      fetchVotings(); // Fetch immediately at the start of the minute
      
      // Then set up interval for every minute after that
      const interval = setInterval(() => {
        fetchVotings();
        setActiveData(getFilteredAndPaginatedVotings('active', activeSearch, activePage));
        setPendingData(getFilteredAndPaginatedVotings('pending', pendingSearch, pendingPage));
        setClosedData(getFilteredAndPaginatedVotings('closed', closedSearch, closedPage));
      }, 60000);
      
      // Cleanup interval on unmount
      return () => clearInterval(interval);
    }, millisecondsUntilNextMinute);
    
    // Cleanup timeout on unmount
    return () => clearTimeout(initialTimeout);
  }, [fetchVotings, activePage, pendingPage, closedPage, activeSearch, pendingSearch, closedSearch, getFilteredAndPaginatedVotings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 transition-colors">
      <Navbar />
      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center mb-12 animate-fadeIn">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-700 via-gray-700 to-slate-800 dark:from-slate-300 dark:via-gray-300 dark:to-slate-400 bg-clip-text text-transparent mb-4">
              Elections
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
              Discover and participate in secure, private voting processes. <br /> Create transparent elections with optional funding distribution.
            </p>
            <Tooltip text={tooltipTexts.createElectionHome} showIcon>
              <Link
                href="/create"
                className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-slate-600 via-gray-600 to-slate-700 dark:from-slate-500 dark:via-gray-500 dark:to-slate-600 hover:from-slate-700 hover:via-gray-700 hover:to-slate-800 dark:hover:from-slate-600 dark:hover:via-gray-600 dark:hover:to-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 dark:focus:ring-slate-400 transition-all duration-300 cursor-default btn shadow-lg hover:shadow-xl hover:scale-105 transform"
              >
                <span className="mr-2">🚀</span>
                Create New Election
              </Link>
            </Tooltip>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 text-gray-900 dark:text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                <span className="text-lg">Loading elections...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 max-w-md mx-auto">
                <div className="text-red-600 dark:text-red-400 text-lg font-semibold">⚠️ Error Loading Elections</div>
                <p className="text-red-500 dark:text-red-300 mt-2">{error}</p>
              </div>
            </div>
          ) : (
            <>
              <VotingGrid 
                filteredVotings={activeData.votings}
                title="Open Elections"
                searchQuery={activeSearch}
                setSearchQuery={setActiveSearch}
                currentPage={activePage}
                setCurrentPage={setActivePage}
                totalPages={activeData.totalPages}
                allVotings={votings}
              />

              <VotingGrid 
                filteredVotings={pendingData.votings}
                title="Upcoming Elections"
                searchQuery={pendingSearch}
                setSearchQuery={setPendingSearch}
                currentPage={pendingPage}
                setCurrentPage={setPendingPage}
                totalPages={pendingData.totalPages}
                allVotings={votings}
              />

              <VotingGrid 
                filteredVotings={closedData.votings}
                title="Closed Elections"
                searchQuery={closedSearch}
                setSearchQuery={setClosedSearch}
                currentPage={closedPage}
                setCurrentPage={setClosedPage}
                totalPages={closedData.totalPages}
                allVotings={votings}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
