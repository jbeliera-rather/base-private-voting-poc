"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { toUTCDate } from "../utils/locale";
import Tooltip from "../components/Tooltip";
import { tooltipTexts } from "../utils/tooltipTexts";

interface VotingOption {
  name: string;
  description: string;
  address: string;
}

// Helper function to format date for datetime-local input
function formatDateForInput(date: Date): string {
  return date.toLocaleString('en-US', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, '$3-$1-$2T$4:$5');
}

export default function CreateVoting() {
  const router = useRouter();
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: formatDateForInput(now),
    endDate: formatDateForInput(tomorrow),
    options: [{ name: "", description: "", address: "" }, { name: "", description: "", address: "" }],
    isPublic: false,
    maxVoters: "",
    voteThreshold: "",
    amount: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Filter out options with empty names
    const filteredOptions = formData.options.filter(option => option.name.trim() !== "");

    if (filteredOptions.length < 2) {
      setError("Please add at least 2 voting options");
      setLoading(false);
      return;
    }

    // Check for duplicate option names
    const optionNames = filteredOptions.map(option => option.name.trim().toLowerCase());
    const uniqueOptionNames = new Set(optionNames);
    if (uniqueOptionNames.size !== optionNames.length) {
      setError("Each voting option must have a unique name");
      setLoading(false);
      return;
    }

    // Validate dates
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    if (endDate <= startDate) {
      setError("End date must be after start date");
      setLoading(false);
      return;
    }

    // Validate max voters if provided
    if (formData.maxVoters && (Number.isNaN(Number(formData.maxVoters)) || Number(formData.maxVoters) <= 0)) {
      setError("Maximum voters must be a positive number");
      setLoading(false);
      return;
    }

    // Validate amount if provided
    if (formData.amount && (Number.isNaN(Number(formData.amount)) || Number(formData.amount) < 0)) {
      setError("Amount must be a non-negative number");
      setLoading(false);
      return;
    }

    // Validate addresses if amount > 0
    const amount = Number(formData.amount);
    if (amount > 0) {
      for (let i = 0; i < filteredOptions.length; i++) {
        const option = filteredOptions[i];
        if (!option.address || option.address.trim() === "") {
          setError(`On-chain address is required for option "${option.name}" when amount is greater than zero`);
          setLoading(false);
          return;
        }
        // Basic Ethereum address validation (starts with 0x and 42 characters total)
        if (!/^0x[a-fA-F0-9]{40}$/.test(option.address.trim())) {
          setError(`Invalid Ethereum address format for option "${option.name}"`);
          setLoading(false);
          return;
        }
      }
    }

    try {
      const response = await fetch("/api/voting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          startDate: toUTCDate(formData.startDate),
          endDate: toUTCDate(formData.endDate),
          options: filteredOptions,
          maxVoters: formData.maxVoters ? Number(formData.maxVoters) : undefined,
          voteThreshold: formData.voteThreshold ? Number(formData.voteThreshold) : undefined,
          amount: formData.amount ? Number(formData.amount) : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create voting');
      }

      router.push("/");
      router.refresh();

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create voting");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOptionChange = (index: number, field: keyof VotingOption, value: string) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.map((option, i) => 
        i === index ? { ...option, [field]: value } : option
      ),
    }));
  };

  const addOption = () => {
    setFormData((prev) => ({
      ...prev,
      options: [...prev.options, { name: "", description: "", address: "" }],
    }));
  };

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) return;
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8 pb-20">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Create New Election</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-900 dark:text-white">
                Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 px-3 py-2 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-900 dark:text-white">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 px-3 py-2 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-900 dark:text-white">
                Amount to Transfer (Optional)
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              />
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Amount to be transferred to the winning option's address
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-900 dark:text-white">
                  Start Date
                </label>
                <input
                  type="datetime-local"
                  id="startDate"
                  name="startDate"
                  required
                  value={formData.startDate}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 px-3 py-2 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-900 dark:text-white">
                  End Date
                </label>
                <input
                  type="datetime-local"
                  id="endDate"
                  name="endDate"
                  required
                  value={formData.endDate}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 px-3 py-2 transition-colors"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Voting Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublic"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                  <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-900 dark:text-white">
                    Show results publicly before voting finalization
                  </label>
                </div>

                <div>
                  <label htmlFor="maxVoters" className="block text-sm font-medium text-gray-900 dark:text-white">
                    Maximum Number of Voters (Optional)
                  </label>
                  <input
                    type="number"
                    id="maxVoters"
                    name="maxVoters"
                    min="1"
                    value={formData.maxVoters}
                    onChange={handleChange}
                    placeholder="No limit"
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                  />
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Leave empty for unlimited voters
                  </p>
                </div>

                <div>
                  <label htmlFor="voteThreshold" className="block text-sm font-medium text-gray-900 dark:text-white">
                    Vote Threshold (Optional)
                  </label>
                  <input
                    type="number"
                    id="voteThreshold"
                    name="voteThreshold"
                    min="1"
                    value={formData.voteThreshold}
                    onChange={handleChange}
                    placeholder="No threshold"
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                  />
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Election will end when any option reaches this number of votes
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <label htmlFor="voting-options" className="block text-sm font-medium text-gray-900 dark:text-white">
                  Voting Options
                </label>
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900 hover:bg-indigo-200 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors cursor-default"
                >
                  Add Option
                </button>
              </div>
              <div className="space-y-4">
                {formData.options.map((option, index) => (
                  <div key={`option-${index}-${option.name || 'empty'}`} className="p-4 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <label htmlFor={`option-${index}-name`} className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                          Option Name
                        </label>
                        <input
                          type="text"
                          id={`option-${index}-name`}
                          value={option.name}
                          onChange={(e) => handleOptionChange(index, "name", e.target.value)}
                          placeholder={`Option ${index + 1} Name`}
                          required
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                        />
                      </div>
                      {formData.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="ml-4 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-red-400 transition-colors cursor-default"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div>
                      <label 
                        htmlFor={`option-${index}-description`}
                        className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
                      >
                        Option Description
                      </label>
                      <textarea
                        id={`option-${index}-description`}
                        value={option.description}
                        onChange={(e) => handleOptionChange(index, "description", e.target.value)}
                        placeholder={`Option ${index + 1} Description`}
                        rows={2}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label 
                        htmlFor={`option-${index}-address`}
                        className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
                      >
                        On-Chain Address {Number(formData.amount) > 0 && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="text"
                        id={`option-${index}-address`}
                        value={option.address}
                        onChange={(e) => handleOptionChange(index, "address", e.target.value)}
                        placeholder="0x..."
                        required={Number(formData.amount) > 0}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                      />
                      {Number(formData.amount) > 0 && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          Required when amount is greater than zero
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">{error}</div>
            )}

            <div className="flex justify-end">
              <Tooltip text={tooltipTexts.createElectionForm} showIcon position="top-start">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center rounded-md border border-transparent bg-indigo-100 dark:bg-indigo-700 py-2 px-4 text-sm font-medium text-gray-900 dark:text-white shadow-sm hover:bg-indigo-200 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-default"
                >
                  {loading ? "Creating..." : "Create Election"}
                </button>
              </Tooltip>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}