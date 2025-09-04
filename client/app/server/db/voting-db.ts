if (process.env.VERCEL) {
  process.env.HOME = '/tmp';   // let bb.js write /tmp/.bb-crs on vercel
}

import { UltraHonkBackend } from '@aztec/bb.js';
import type { CompiledCircuit, ProofData } from '@noir-lang/types';
import { createClient } from '@supabase/supabase-js';
import { addActiveVoting, addInactiveVoting, checkExpiredVotings } from './voting-status';
import { createProtocolWalletClient } from '../init';
import { parseEther } from 'viem';

import JwtCircuitJSON from '@/public/circuit/jwtnoir.json' assert { type: 'json' };

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

// Initialize database tables

export interface Voting {
  id?: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'closed' | 'pending';
  maxVoters?: number;
  voteThreshold?: number;
  isPublic: boolean;
  amount?: number;
  fundsDistributed?: boolean;
  distributionTxHash?: string;
  options: {
    name: string;
    description: string;
    address: string;
  }[];
  results: number[];
}

interface DatabaseVotingOption {
  id: number;
  name: string;
  description: string;
  address: string;
  votes: number;
}

interface DatabaseVoting {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'closed' | 'pending';
  max_voters?: number;
  vote_threshold?: number;
  is_public: boolean;
  amount?: number;
  funds_distributed?: boolean;
  distribution_tx_hash?: string;
  voting_options: DatabaseVotingOption[];
}

export async function verifyProof(circuit: CompiledCircuit, proof: ProofData): Promise<boolean> {
  try { 
    const backend = new UltraHonkBackend(circuit.bytecode);
    console.log("Verifying proof... ⏳");
    const verified = await backend.verifyProof(proof);
    console.log("verified", verified);
    return verified;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("error", error);
    throw new Error(`Failed to verify proof: ${errorMessage}`);
  }
}

// Get all votings
export async function getVotings(): Promise<Voting[]> {
  try {
    const { data: votings, error } = await supabase
      .from('votings')
      .select(`
        *,
        voting_options (
          name,
          description,
          address,
          votes
        )
      `)
      .order('id');

    if (error) throw error;

    return votings.map((v: DatabaseVoting) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      startDate: v.start_date,
      endDate: v.end_date,
      status: v.status,
      maxVoters: v.max_voters,
      voteThreshold: v.vote_threshold,
      isPublic: v.is_public,
      amount: v.amount,
      fundsDistributed: v.funds_distributed || false,
      distributionTxHash: v.distribution_tx_hash || undefined,
      options: v.voting_options.sort((a: DatabaseVotingOption, b: DatabaseVotingOption) => a.id - b.id).map((vo: DatabaseVotingOption) => ({
        name: vo.name,
        description: vo.description,
        address: vo.address
      })),
      results: v.voting_options.sort((a: DatabaseVotingOption, b: DatabaseVotingOption) => a.id - b.id).map((vo: DatabaseVotingOption) => vo.votes)
    }));
  } catch (error) {
    console.error('Error getting votings:', error);
    throw new Error('Failed to get votings');
  }
}

// Get a specific voting by ID
export async function getVotingById(id: number): Promise<Voting | null> {
  try {
    const { data: voting, error } = await supabase
      .from('votings')
      .select(`
        *,
        voting_options (
          id,
          name,
          description,
          address,
          votes
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!voting) return null;

    return {
      id: voting.id,
      title: voting.title,
      description: voting.description,
      startDate: voting.start_date,
      endDate: voting.end_date,
      status: voting.status,
      maxVoters: voting.max_voters,
      voteThreshold: voting.vote_threshold,
      isPublic: voting.is_public,
      amount: voting.amount,
      fundsDistributed: voting.funds_distributed || false,
      distributionTxHash: voting.distribution_tx_hash || undefined,
      options: voting.voting_options.sort((a: DatabaseVotingOption, b: DatabaseVotingOption) => a.id - b.id).map((vo: DatabaseVotingOption) => ({
        name: vo.name,
        description: vo.description,
        address: vo.address
      })),
      results: voting.voting_options.sort((a: DatabaseVotingOption, b: DatabaseVotingOption) => a.id - b.id).map((vo: DatabaseVotingOption) => vo.votes)
    };
  } catch (error) {
    console.error('Error getting voting by ID:', error);
    throw new Error('Failed to get voting');
  }
}

// Add a new voting
export async function addVoting(voting: Voting): Promise<Voting> {
  try {
    const currentDate = new Date();
    const beginDate = new Date(voting.startDate); // Convert to UTC
    const endDate = new Date(voting.endDate); // Convert to UTC
    if (beginDate >= endDate) {
      throw new Error('Start date must be before end date');
    }

    let status: 'active' | 'closed' | 'pending' = 'pending';
    if (beginDate.getTime() > currentDate.getTime()) {
      status = 'pending';
    } else if (endDate.getTime() <= currentDate.getTime()) {
      status = 'closed';
    } else {
      status = 'active';
    }

    // Start a transaction
    const { data: newVoting, error: votingError } = await supabase
      .from('votings')
      .insert({
        title: voting.title,
        description: voting.description,
        start_date: voting.startDate,
        end_date: voting.endDate,
        status,
        max_voters: voting.maxVoters,
        vote_threshold: voting.voteThreshold,
        is_public: voting.isPublic,
        amount: voting.amount
      })
      .select()
      .single();

    if (votingError) throw votingError;

    // Insert voting options
    const { error: optionsError } = await supabase
      .from('voting_options')
      .insert(
        voting.options.map(option => ({
          voting_id: newVoting.id,
          name: option.name,
          description: option.description,
          address: option.address,
          votes: 0
        }))
      );

    if (optionsError) throw optionsError;

    if (status === 'active') {
      await addActiveVoting(newVoting.id, voting.endDate);
    } else {
      await addInactiveVoting(newVoting.id, voting.startDate);
    }

    return {
      ...voting,
      id: newVoting.id,
      status,
      results: voting.options.map(() => 0)
    };
  } catch (error) {
    console.error('Error adding voting:', error);
    throw new Error('Failed to add voting');
  }
}

// Distribute funds to winning option
async function distributeFunds(voting: Voting): Promise<string | null> {
  try {
    if (!voting.amount || voting.amount <= 0) {
      return null; // No funds to distribute
    }

    // Check if funds have already been distributed
    if (voting.fundsDistributed) {
      console.log(`Funds already distributed for election ${voting.id}. TX: ${voting.distributionTxHash}`);
      return voting.distributionTxHash || null;
    }

    // Find the winning option (highest votes)
    const maxVotes = Math.max(...voting.results);
    const winningIndex = voting.results.indexOf(maxVotes);
    
    if (maxVotes === 0) {
      console.log(`No votes cast in election ${voting.id}, funds will remain in protocol`);
      // Mark as distributed even if no votes to prevent retries
      await supabase
        .from('votings')
        .update({ 
          funds_distributed: true,
          distribution_tx_hash: null 
        })
        .eq('id', voting.id);
      return null;
    }

    const winningOption = voting.options[winningIndex];
    if (!winningOption?.address) {
      console.error(`Winning option for voting ${voting.id} has no address specified`);
      // Mark as distributed to prevent retries
      await supabase
        .from('votings')
        .update({ 
          funds_distributed: true,
          distribution_tx_hash: null 
        })
        .eq('id', voting.id);
      return null;
    }

    const walletClient = createProtocolWalletClient();
    const amount = parseEther(voting.amount.toString());

    console.log(`Distributing ${voting.amount} ETH to winning option "${winningOption.name}" at address ${winningOption.address}`);

    // Send the transaction
    const txHash = await walletClient.sendTransaction({
      to: winningOption.address as `0x${string}`,
      value: amount,
    });

    // Mark funds as distributed in database
    await supabase
      .from('votings')
      .update({ 
        funds_distributed: true,
        distribution_tx_hash: txHash 
      })
      .eq('id', voting.id);

    console.log(`Funds distributed successfully. Transaction hash: ${txHash}`);
    return txHash;
  } catch (error) {
    console.error('Error distributing funds:', error);
    throw error;
  }
}

// Close a voting and distribute funds if applicable
export async function closeVoting(id: number): Promise<boolean> {
  try {
    // Get the voting details before closing
    const voting = await getVotingById(id);
    if (!voting) {
      throw new Error(`Voting with id ${id} not found`);
    }

    // Close the voting first
    const { error } = await supabase
      .from('votings')
      .update({ status: 'closed' })
      .eq('id', id);

    if (error) throw error;

    // Distribute funds if applicable
    if (voting.amount && voting.amount > 0) {
      try {
        const txHash = await distributeFunds(voting);
        if (txHash) {
          console.log(`Election ${id} ("${voting.title}") closed and funds distributed. TX: ${txHash}`);
        } else {
          console.log(`Election ${id} ("${voting.title}") closed. No funds distributed.`);
        }
      } catch (fundError) {
        console.error(`Failed to distribute funds for voting ${id}:`, fundError);
        // Don't throw here - we want the voting to remain closed even if fund distribution fails
      }
    } else {
      console.log(`Election ${id} ("${voting.title}") closed. No funding configured.`);
    }

    return true;
  } catch (error) {
    console.error('Error closing voting:', error);
    throw new Error('Failed to close voting');
  }
}

// Open a voting
export async function openVoting(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('votings')
      .update({ status: 'active' })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error opening voting:', error);
    throw new Error('Failed to open voting');
  }
}

// Add a vote to a voting
export async function addVote(electionId: number, proof: ProofData, selectedOptionIndex: number) {
  try {
    // Verify the proof
    const isValid = await verifyProof(JwtCircuitJSON as CompiledCircuit, proof as ProofData);
    if (!isValid) {
      throw new Error('Invalid proof submitted');
    }

    const nullifier = proof.publicInputs[1];

    // Check if the nullifier already exists
    const { data: existingNullifier, error: nullifierError } = await supabase
      .from('nullifiers')
      .select()
      .eq('nullifier', nullifier)
      .eq('voting_id', electionId)
      .single();

    if (nullifierError && nullifierError.code !== 'PGRST116') throw nullifierError;
    if (existingNullifier) {
      throw new Error('This account already cast a vote in this election');
    }

    // Get the voting option ID
    const { data: votingOption, error: optionError } = await supabase
      .from('voting_options')
      .select('id')
      .eq('voting_id', electionId)
      .order('id')
      .range(selectedOptionIndex, selectedOptionIndex)
      .single();

    if (optionError) throw optionError;

    // Start a transaction
    const { error: transactionError } = await supabase.rpc('add_vote', {
      p_nullifier: nullifier,
      p_voting_id: electionId,
      p_option_id: votingOption.id
    });

    if (transactionError) throw transactionError;

    checkExpiredVotings();
  } catch (error) {
    console.error('Error adding vote:', error);
    throw error;
  }
}

