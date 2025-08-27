import { closeVoting, getVotings, openVoting, type Voting } from './voting-db';

// Keep track of active voting IDs sorted by end date
let activeVotingIds: number[] = [];
let inactiveVotingIds: number[] = [];

// Initialize the active voting indices
export async function initializeActiveVotings() {
  const votings = await getVotings();
  activeVotingIds = votings
    .filter((voting: Voting) => voting.status === 'active')
    .sort((a: Voting, b: Voting) => (new Date(a.endDate)).getTime() - (new Date(b.endDate)).getTime())
    .map((voting: Voting) => voting.id)
    .filter((id): id is number => id !== undefined);
}

export async function initializeInactiveVotings() {
  const votings = await getVotings();
  inactiveVotingIds = votings
    .filter((voting: Voting) => voting.status !== 'active')
    .sort((a: Voting, b: Voting) => (new Date(a.startDate)).getTime() - (new Date(b.startDate)).getTime())
    .map((voting: Voting) => voting.id)
    .filter((id): id is number => id !== undefined);
}

// Add a new voting to the active list
export async function addActiveVoting(id: number, endDate: string) {
  const endDateTime = new Date(endDate).getTime();
  const votings = await getVotings();
  const insertIndex = activeVotingIds.findIndex(
    votingId => {
      const voting = votings.find(v => v.id === votingId);
      return voting && new Date(voting.endDate).getTime() > endDateTime;
    }
  );
  
  if (insertIndex === -1) {
    activeVotingIds.push(id);
  } else {
    activeVotingIds.splice(insertIndex, 0, id);
  }
}

// Add a new voting to the inactive list
export async function addInactiveVoting(id: number, beginDate: string) {
  const beginDateTime = new Date(beginDate).getTime();
  const votings = await getVotings();
  const insertIndex = inactiveVotingIds.findIndex(
    votingId => {
      const voting = votings.find(v => v.id === votingId);
      return voting && new Date(voting.startDate).getTime() > beginDateTime;
    }
  );
  
  if (insertIndex === -1) {
    inactiveVotingIds.push(id);
  } else {
    inactiveVotingIds.splice(insertIndex, 0, id);
  }
}

// Check and close expired votings
export async function checkExpiredVotings() {
  const now = new Date();
  const votings = await getVotings();
  const expiredIds: number[] = [];

  // Find all expired votings
  for (let i = 0; i < activeVotingIds.length; i++) {
    const votingId = activeVotingIds[i];
    const voting = votings.find(v => v.id === votingId);
    
    if (voting) {
      let shouldClose = new Date(voting.endDate) <= now; // Time expired
      if (voting.voteThreshold !== undefined && voting.voteThreshold > 0) { // Threshold reached
        shouldClose = shouldClose || voting.results.some(votes => votes >= (voting.voteThreshold as number)); 
      }

      if (voting.maxVoters !== undefined && voting.maxVoters > 0) { // Max voters reached
        shouldClose = shouldClose || voting.results.reduce((a, b) => a + b, 0) >= voting.maxVoters;
      }
      
      if (shouldClose) {
        expiredIds.push(i);
        console.log(`Closing voting ${votingId} ("${voting.title}") - expired or conditions met`);
        await closeVoting(votingId);
      } 
    }
  }

  // Remove expired votings from the active list (in reverse order to maintain correct indices)
  for (let i = expiredIds.length - 1; i >= 0; i--) {
    activeVotingIds.splice(expiredIds[i], 1);
  }

  return expiredIds.length > 0;
}

// Check and open votings that have reached their begin date
export async function checkBeginVotings() {
  const now = new Date();
  const votings = await getVotings();
  let openedAny = false;

  // Check all votings
  for (let i = 0; i < inactiveVotingIds.length; i++) {
    const votingId = inactiveVotingIds[i];
    const voting = votings.find(v => v.id === votingId);
    
    if (voting && 
        voting.status !== 'active' && 
        new Date(voting.startDate) <= now && 
        new Date(voting.endDate) > now &&
        (!voting.maxVoters || voting.results.reduce((a, b) => a + b, 0) < voting.maxVoters) &&
        (!voting.voteThreshold || voting.results.some(votes => votes >= (voting.voteThreshold as number)))
    ) {
      // Open the voting
      await openVoting(votingId); // This will update the status to 'active'
      openedAny = true;
      // Add to active votings list
      await addActiveVoting(votingId, voting.endDate);
      // Remove from inactive votings list
      inactiveVotingIds.splice(i, 1);
    }
  }

  return openedAny;
}

// Start the voting status checker
export async function startExpirationChecker() {
  // Check immediately on start
  await checkBeginVotings();
  await checkExpiredVotings();
  
  // Calculate time until next minute starts
  const now = new Date();
  const secondsUntilNextMinute = 60 - now.getSeconds();
  const millisecondsUntilNextMinute = secondsUntilNextMinute * 1000;
  
  // Set initial timeout to start at the beginning of the next minute
  setTimeout(async () => {
    // Check immediately at the start of the minute
    await checkBeginVotings();
    await checkExpiredVotings();
    
    // Then set up interval for every minute after that
    setInterval(async () => {
      await checkBeginVotings();
      await checkExpiredVotings();
    }, 60_000);
  }, millisecondsUntilNextMinute);
} 