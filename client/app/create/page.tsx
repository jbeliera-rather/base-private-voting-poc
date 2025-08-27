"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { toUTCDate } from "../utils/locale";
import Tooltip from "../components/Tooltip";
import { tooltipTexts } from "../utils/tooltipTexts";
import { 
  useAccount, 
  useSendTransaction, 
  useWaitForTransactionReceipt, 
  useBalance, 
  useWalletClient, 
  useSwitchChain,
  useEstimateGas,
  useGasPrice } from "wagmi";
import { parseEther, formatEther } from "viem";

interface VotingOption {
  name: string;
  description: string;
  address: string;
}

// Fixed protocol address where funds will be transferred
const PROTOCOL_ADDRESS = process.env.NEXT_PUBLIC_PROTOCOL_ADDRESS as `0x${string}`;

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
  
  // Wagmi hooks
  const { isConnected, address } = useAccount();
    const { data: balance } = useBalance({
    address: address,
  });

  const { chainId } = useAccount();
  const { data: walletClient } = useWalletClient();

  const { switchChain } = useSwitchChain();
    
  useEffect(() => { // without this, the signature is failing for testnet and localhost
    if (walletClient?.chain.id !== chainId) {
      switchChain({ chainId: walletClient?.chain.id as 84532 | 8453 });
    }
  }, [walletClient?.chain.id, chainId, switchChain]); 

  const { data: txHash, sendTransaction, isPending: isTxPending, error: txError } = useSendTransaction();
  const { isLoading: isWaitingForReceipt, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  
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
  const [transactionStep, setTransactionStep] = useState<'none' | 'sending' | 'waiting' | 'creating'>('none');
  const [pendingFilteredOptions, setPendingFilteredOptions] = useState<VotingOption[]>([]);
  const [lastFailedTx, setLastFailedTx] = useState<{amount: string, options: VotingOption[]} | null>(null);

  // Gas estimation for the transaction - moved after formData declaration
  const shouldEstimateGas = Number(formData.amount) > 0 && PROTOCOL_ADDRESS && PROTOCOL_ADDRESS !== ("undefined" as `0x${string}`) && !Number.isNaN(Number(formData.amount));
  
  const { data: gasEstimate } = useEstimateGas({
    to: PROTOCOL_ADDRESS,
    value: shouldEstimateGas ? parseEther(formData.amount) : undefined,
    query: {
      enabled: shouldEstimateGas,
    },
  });

  const { data: gasPrice } = useGasPrice({
    query: {
      enabled: shouldEstimateGas,
    },
  });

  // Calculate estimated gas cost in ETH
  const estimatedGasCost = gasEstimate && gasPrice ? gasEstimate * gasPrice : parseEther("0.0000001"); // fallback to rough estimate

  const parseTransactionError = useCallback((error: Error): string => {
    const message = error.message.toLowerCase();
    
    // User rejected transaction
    if (message.includes('user rejected') || message.includes('user denied') || message.includes('user cancelled')) {
      return "Transaction was cancelled by user";
    }
    
    // Insufficient funds
    if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
      return "Insufficient ETH balance to complete the transaction";
    }
    
    // Gas related errors
    if (message.includes('gas') && message.includes('limit')) {
      return "Transaction failed due to gas limit. Please try again.";
    }
    
    if (message.includes('gas') && message.includes('price')) {
      return "Transaction failed due to gas price. Please try again.";
    }
    
    // Network errors
    if (message.includes('network') || message.includes('connection')) {
      return "Network connection error. Please check your connection and try again.";
    }
    
    // RPC errors
    if (message.includes('rpc') || message.includes('provider')) {
      return "Network provider error. Please try again or switch networks.";
    }
    
    // Execution reverted
    if (message.includes('execution reverted')) {
      return "Transaction was reverted. The protocol address may not be able to receive funds.";
    }
    
    // Nonce errors
    if (message.includes('nonce')) {
      return "Transaction nonce error. Please try again.";
    }
    
    // Replacement transaction
    if (message.includes('replacement') || message.includes('underpriced')) {
      return "Transaction was replaced or underpriced. Please try again.";
    }
    
    // Default fallback
    return `Transaction failed: ${error.message}`;
  }, []);

  const createElection = useCallback(async (filteredOptions: VotingOption[]) => {
    setTransactionStep('creating');
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
      setTransactionStep('none');
    } finally {
      setLoading(false);
    }
  }, [formData, router]);

  // Handle transaction success
  useEffect(() => {
    if (isTxSuccess && transactionStep === 'waiting' && pendingFilteredOptions.length > 0) {
      createElection(pendingFilteredOptions);
      setPendingFilteredOptions([]);
    }
  }, [isTxSuccess, transactionStep, pendingFilteredOptions, createElection]);

  // Handle transaction states
  useEffect(() => {
    if (isTxPending) {
      setTransactionStep('sending');
    } else if (isWaitingForReceipt) {
      setTransactionStep('waiting');
    }
  }, [isTxPending, isWaitingForReceipt]);

  // Handle transaction errors - capture values at time of error
  useEffect(() => {
    if (txError) {
      setError(parseTransactionError(txError));
      setLoading(false);
      setTransactionStep('none');
      setPendingFilteredOptions([]);
    }
  }, [txError, parseTransactionError]);

  // Store failed transaction details when error occurs
  useEffect(() => {
    if (txError && pendingFilteredOptions.length > 0) {
      setLastFailedTx({
        amount: formData.amount,
        options: [...pendingFilteredOptions] // create a copy to avoid reference issues
      });
    }
  }, [txError, pendingFilteredOptions, formData.amount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTransactionStep('none');

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
      // Check wallet connection
      if (!isConnected) {
        setError("Please connect your wallet to create an election with funding");
        setLoading(false);
        return;
      }

      // Check protocol address is set
      if (!PROTOCOL_ADDRESS || PROTOCOL_ADDRESS === ("undefined" as `0x${string}`)) {
        setError("Protocol address is not configured. Please contact the administrator.");
        setLoading(false);
        return;
      }

      // Check balance
      console.log("balance", balance);
      if (!balance) {
        setError("Unable to fetch wallet balance. Please try again.");
        setLoading(false);
        return;
      }

      const requiredAmount = parseEther(amount.toString());
      const totalRequired = requiredAmount + estimatedGasCost;

      if (balance.value < requiredAmount) {
        setError(
          `Insufficient balance. Required: ${amount} ETH, Available: ${formatEther(balance.value)} ETH`
        );
        setLoading(false);
        return;
      }

      if (balance.value < totalRequired) {
        setError(
          `Insufficient balance for transaction and gas fees. Required: ~${formatEther(totalRequired)} ETH (${amount} ETH + ${formatEther(estimatedGasCost)} ETH gas), Available: ${formatEther(balance.value)} ETH`
        );
        setLoading(false);
        return;
      }

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

      // Send transaction first
      try {
        setPendingFilteredOptions(filteredOptions);
        setTransactionStep('sending');
        sendTransaction({
          to: PROTOCOL_ADDRESS,
          value: parseEther(amount.toString()),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? parseTransactionError(err) : "Failed to send transaction";
        setError(errorMessage);
        setLoading(false);
        setTransactionStep('none');
        setPendingFilteredOptions([]);
      }
    } else {
      // No amount, create election directly
      await createElection(filteredOptions);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when user modifies the form
    if (error) {
      setError(null);
    }
    
    // Clear last failed transaction if amount changes
    if (name === 'amount' && lastFailedTx) {
      setLastFailedTx(null);
    }
  };

  const handleOptionChange = (index: number, field: keyof VotingOption, value: string) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.map((option, i) => 
        i === index ? { ...option, [field]: value } : option
      ),
    }));
    
    // Clear error when user modifies options
    if (error) {
      setError(null);
    }
  };

  const addOption = () => {
    setFormData((prev) => ({
      ...prev,
      options: [...prev.options, { name: "", description: "", address: "" }],
    }));
  };

  const getButtonText = () => {
    const amount = Number(formData.amount);
    
    if (amount > 0 && !isConnected) {
      return "Connect Wallet Required";
    }

    if (amount > 0 && (!PROTOCOL_ADDRESS || PROTOCOL_ADDRESS === ("undefined" as `0x${string}`))) {
      return "Protocol Address Not Configured";
    }
    
    if (amount > 0 && balance && balance.value < parseEther(amount.toString()) + estimatedGasCost) {
      return "Insufficient Balance";
    }
    
    switch (transactionStep) {
      case 'sending':
        return "Sending Transaction...";
      case 'waiting':
        return "Confirming Transaction...";
      case 'creating':
        return "Creating Election...";
      default:
        return loading ? "Creating..." : amount > 0 ? "Fund & Create Election" : "Create Election";
    }
  };

  const isButtonDisabled = () => {
    const amount = Number(formData.amount);
    
    if (loading) return true;
    
    if (amount > 0) {
      if (!isConnected) return true;
      if (!PROTOCOL_ADDRESS || PROTOCOL_ADDRESS === ("undefined" as `0x${string}`)) return true;
      if (balance && balance.value < parseEther(amount.toString()) + estimatedGasCost) return true;
    }
    
    return false;
  };

  const retryTransaction = useCallback(() => {
    if (!lastFailedTx) return;
    
    setError(null);
    setLoading(true);
    setPendingFilteredOptions(lastFailedTx.options);
    setTransactionStep('sending');
    
    try {
      sendTransaction({
        to: PROTOCOL_ADDRESS,
        value: parseEther(lastFailedTx.amount),
      });
      setLastFailedTx(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? parseTransactionError(err) : "Failed to send transaction";
      setError(errorMessage);
      setLoading(false);
      setTransactionStep('none');
      setPendingFilteredOptions([]);
    }
  }, [lastFailedTx, sendTransaction, parseTransactionError]);

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
                ETH amount to transfer (Optional)
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                min="0"
                step="1e-9"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              />
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Amount to be transferred to the winning option's address. <br />
                Funds will first be sent to the protocol address for escrow.
                <br />
                <span className="text-xs">💡 Tip: Ensure you have extra ETH for gas fees {gasEstimate && gasPrice ? `(~${formatEther(estimatedGasCost)} ETH estimated)` : "(~0.01 ETH estimated)"}</span>
              </p>
              {Number(formData.amount) > 0 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-500 font-mono">
                  Protocol Address: {PROTOCOL_ADDRESS || "Not configured"}
                </p>
              )}
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

            {/* Wallet connection notice */}
            {Number(formData.amount) > 0 && !isConnected && (
              <div className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                ⚠️ Wallet connection required for elections with funding
              </div>
            )}

            {/* Balance warnings */}
            {Number(formData.amount) > 0 && !Number.isNaN(Number(formData.amount)) && isConnected && balance && (
              <>
                {balance.value < parseEther(formData.amount) && (
                  <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">
                    ❌ Insufficient balance. Required: {formData.amount} ETH, Available: {formatEther(balance.value)} ETH
                  </div>
                )}
                {balance.value >= parseEther(formData.amount) && balance.value < parseEther(formData.amount) + estimatedGasCost && (
                  <div className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                    ⚠️ Low balance warning. You may not have enough ETH for gas fees. 
                    <br />
                    Available: {formatEther(balance.value)} ETH | Estimated gas: {formatEther(estimatedGasCost)} ETH
                  </div>
                )}
                {balance.value >= parseEther(formData.amount) + estimatedGasCost && (
                  <div className="text-green-700 dark:text-green-300 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-200 dark:border-green-800">
                    ✅ Sufficient balance. Available: {formatEther(balance.value)} ETH | Gas: {formatEther(estimatedGasCost)} ETH
                  </div>
                )}
              </>
            )}

            {/* Protocol address warning */}
            {Number(formData.amount) > 0 && (!PROTOCOL_ADDRESS || PROTOCOL_ADDRESS === ("undefined" as `0x${string}`)) && (
              <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">
                ❌ Protocol address not configured. Please contact the administrator.
              </div>
            )}

            {/* Transaction status */}
            {transactionStep !== 'none' && (
              <div className="text-blue-700 dark:text-blue-300 text-sm bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                {transactionStep === 'sending' && "🔄 Sending transaction..."}
                {transactionStep === 'waiting' && "⏳ Waiting for transaction confirmation..."}
                {transactionStep === 'creating' && "📋 Creating election..."}
                {txHash && (
                  <div className="mt-1 text-xs font-mono">
                    Transaction: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <strong>Transaction Error:</strong> {error}
                  </div>
                  {lastFailedTx && (
                    <button
                      type="button"
                      onClick={retryTransaction}
                      disabled={loading || isButtonDisabled()}
                      className="ml-3 px-3 py-1 text-xs bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-red-800 dark:text-red-200 rounded-md border border-red-300 dark:border-red-600 disabled:opacity-50 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </div>
                {lastFailedTx && (
                  <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                    Click "Retry" to attempt the transaction again, or modify the amount and resubmit.
                  </div>
                )}
                
                {/* Helpful tips for common errors */}
                <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-700">
                  <div className="text-xs text-red-600 dark:text-red-300">
                    <strong>💡 Troubleshooting Tips:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {error.toLowerCase().includes('insufficient') && (
                        <li>Add more ETH to your wallet or reduce the amount</li>
                      )}
                      {error.toLowerCase().includes('gas') && (
                        <li>Try increasing gas fees in your wallet or wait for network congestion to clear</li>
                      )}
                      {error.toLowerCase().includes('rejected') && (
                        <li>Click "Retry" to approve the transaction in your wallet</li>
                      )}
                      {error.toLowerCase().includes('network') && (
                        <li>Check your internet connection and try switching networks</li>
                      )}
                      {error.toLowerCase().includes('reverted') && (
                        <li>Verify the protocol address is correct and can receive funds</li>
                      )}
                      <li>Try refreshing the page if the error persists</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Tooltip text={tooltipTexts.createElectionForm} showIcon position="top-start">
                <button
                  type="submit"
                  disabled={isButtonDisabled()}
                  className="inline-flex justify-center rounded-md border border-transparent bg-indigo-100 dark:bg-indigo-700 py-2 px-4 text-sm font-medium text-gray-900 dark:text-white shadow-sm hover:bg-indigo-200 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-default"
                >
                  {getButtonText()}
                </button>
              </Tooltip>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}