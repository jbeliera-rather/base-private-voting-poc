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
}: VotingGridProps) => (
  <div className="mb-12">
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 sm:gap-0">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          placeholder="Search elections..."
          value={searchQuery}
          onChange={(e) => {
            const value = e.target.value;
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 w-48"
        />
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1 || filteredVotings.length === 0}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-800 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            ←
          </button>
          <span className="px-1 text-sm text-gray-900 dark:text-white">
            {filteredVotings.length === 0 ? "0/0" : `${currentPage}/${totalPages}`}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage === totalPages || filteredVotings.length === 0}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-800 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            →
          </button>
        </div>
      </div>
    </div>
    {filteredVotings.length === 0 ? (
      <div className="text-center text-gray-900 dark:text-white">No {title.toLowerCase()} at the moment</div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVotings.map((voting) => (
          <Link
            key={voting.id}
            href={`/voting/${voting.id}`}
            className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md dark:shadow-gray-900/20 dark:hover:shadow-gray-900/40 transition-all duration-200 border border-gray-200 dark:border-gray-700 cursor-default hover:scale-105 hover:-translate-y-1"
          >
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {voting.title}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4 line-clamp-2">
                {voting.description}
              </p>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <div>Start: {formatLocalDate(voting.startDate)}</div>
              </div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <div>End: {formatLocalDate(voting.endDate)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    )}
  </div>
);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Elections</h1>
            <Tooltip text={tooltipTexts.createElectionHome} showIcon>
              <Link
                href="/create"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-900 dark:text-white bg-indigo-100 dark:bg-indigo-700 hover:bg-indigo-200 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors cursor-default"
              >
                Create New Election
              </Link>
            </Tooltip>
          </div>
          
          {loading ? (
            <div className="text-center text-gray-900 dark:text-white">Loading...</div>
          ) : error ? (
            <div className="text-center text-red-600 dark:text-red-400">{error}</div>
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
