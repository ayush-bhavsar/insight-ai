const CRICAPI_BASE_URL = 'https://api.cricapi.com/v1';
const CRICAPI_KEY = process.env.CRICAPI_KEY;

async function fetchFromCricAPI(endpoint, params = {}) {
  if (!CRICAPI_KEY) {
    throw new Error('CRICAPI_KEY not configured');
  }

  const url = new URL(`${CRICAPI_BASE_URL}/${endpoint}`);
  url.searchParams.append('apikey', CRICAPI_KEY);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`CricAPI request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'success') {
    throw new Error(`CricAPI error: ${data.info || 'Unknown error'}`);
  }

  return data.data;
}

async function getLiveMatches() {
  const matches = await fetchFromCricAPI('currentMatches');
  const liveMatches = (matches || []).filter((match) => {
    const name = (match.name || '').toLowerCase();
    return match.matchStarted && !match.matchEnded && name.includes('ipl');
  });
  return liveMatches;
}

async function getMatchInfo(matchId) {
  const match = await fetchFromCricAPI('match_info', { id: matchId });
  return match;
}

async function getMatchScore(matchId) {
  const score = await fetchFromCricAPI('match_score', { id: matchId });
  return score;
}

async function getPlayerStats(playerId) {
  const stats = await fetchFromCricAPI('player_stats', { id: playerId });
  return stats;
}

async function getCurrentIPLMatch() {
  try {
    const liveMatches = await getLiveMatches();
    const scoredMatches = liveMatches.filter((match) => Array.isArray(match.score) && match.score.length > 0);
    const iplMatch = scoredMatches[0] || liveMatches[0];
    if (!iplMatch) {
      return null;
    }

    const matchInfo = await getMatchInfo(iplMatch.id);
    return {
      ...iplMatch,
      ...matchInfo,
    };
  } catch (error) {
    console.error('Error fetching IPL match:', error.message);
    return null;
  }
}

function transformCricAPIToMatchState(cricMatch, existingState) {
  if (!cricMatch) {
    return null;
  }

  const matchInfo = cricMatch.matchInfo || cricMatch;
  const teams = matchInfo.teams || [];
  const teamInfo = matchInfo.teamInfo || [];
  const scoreEntries = Array.isArray(cricMatch.score) ? cricMatch.score : [];
  const currentScore = scoreEntries[scoreEntries.length - 1] || {};
  const previousScore = scoreEntries.length > 1 ? scoreEntries[scoreEntries.length - 2] : null;
  const tossWinner = (matchInfo.tossWinner || '').toLowerCase();
  const tossChoice = (matchInfo.tossChoice || '').toLowerCase();

  let battingTeam = teams[0] || 'Batting Team';
  let bowlingTeam = teams[1] || 'Bowling Team';

  if (scoreEntries.length > 1) {
    battingTeam = teams[1] || battingTeam;
    bowlingTeam = teams[0] || bowlingTeam;
  } else if (tossWinner && tossChoice) {
    const tossWinnerName = teams.find((team) => team.toLowerCase() === tossWinner) || battingTeam;
    const otherTeam = teams.find((team) => team.toLowerCase() !== tossWinner);
    if (tossChoice.includes('bat')) {
      battingTeam = tossWinnerName;
      bowlingTeam = otherTeam || bowlingTeam;
    } else if (tossChoice.includes('bowl')) {
      battingTeam = otherTeam || battingTeam;
      bowlingTeam = tossWinnerName;
    }
  }

  const runs = Number(currentScore.r || currentScore.runs || 0);
  const wickets = Number(currentScore.w || currentScore.wickets || 0);
  const oversValue = currentScore.o ?? currentScore.overs ?? 0;
  const oversParts = String(oversValue).split('.');
  const oversInt = Number(oversParts[0]) || 0;
  const ballsInt = Number(oversParts[1]) || 0;

  const targetRuns = previousScore ? Number(previousScore.r || previousScore.runs || 0) : 0;
  const isSecondInnings = scoreEntries.length > 1;
  const target = isSecondInnings ? targetRuns + 1 : 0;
  const requiredRuns = isSecondInnings ? Math.max(0, target - runs) : 0;
  const ballsRemaining = Math.max(0, 120 - (oversInt * 6 + ballsInt));
  const requiredRunRate = isSecondInnings && ballsRemaining > 0 ? (requiredRuns / (ballsRemaining / 6)).toFixed(1) : '0';
  const runRate = oversInt > 0 || ballsInt > 0 ? (runs / ((oversInt * 6 + ballsInt) / 6)).toFixed(1) : '0';

  const scoreShortName = (teamName) => {
    const info = teamInfo.find((team) => team.name === teamName);
    return info?.shortname || teamName.slice(0, 3).toUpperCase();
  };

  return {
    matchId: matchInfo.id,
    competition: matchInfo.series || existingState?.competition || 'Live Cricket',
    venue: matchInfo.venue || 'TBA',
    status: matchInfo.status || (matchInfo.matchStarted && !matchInfo.matchEnded ? 'Live' : 'Scheduled'),
    battingTeam,
    bowlingTeam,
    battingShortName: scoreShortName(battingTeam),
    bowlingShortName: scoreShortName(bowlingTeam),
    target,
    score: runs,
    wickets,
    overs: oversInt,
    balls: ballsInt,
    requiredRunRate: parseFloat(requiredRunRate),
    runRate: parseFloat(runRate),
    last6Balls: currentScore.lastSixes || ['-', '-', '-', '-', '-', '-'],
    currentBatters: currentScore.batsmen || [
      { name: `${battingTeam} batter 1`, runs: 0, balls: 0 },
      { name: `${battingTeam} batter 2`, runs: 0, balls: 0 },
    ],
    currentBowler: currentScore.bowler || { name: `${bowlingTeam} bowler`, overs: '0.0', runs: 0, wickets: 0 },
    pressureLevel: runs > 0 || wickets > 0 ? 'Medium' : 'Low',
    pressureScore: runs > 0 || wickets > 0 ? 50 : 20,
    winProbability: isSecondInnings ? { battingTeam: 50, bowlingTeam: 50 } : { battingTeam: 0, bowlingTeam: 0 },
    momentum: runs > 0 || wickets > 0 ? [50, 52, 55, 53, 56] : [10, 10, 10, 10, 10],
    runRateGraph: runs > 0 || wickets > 0 ? [runRate || 0, runRate || 0, runRate || 0] : [0, 0, 0],
    overHistory: scoreEntries.map((entry, index) => ({
      over: index + 1,
      runs: Number(entry.r || entry.runs || 0),
      wickets: Number(entry.w || entry.wickets || 0),
      momentum: 50,
    })),
    currentInsight: currentScore.r !== undefined || currentScore.runs !== undefined ? 'Live score loaded from CricAPI.' : 'Match has started, but CricAPI has not exposed the scorecard yet.',
    commentary: { english: 'Live cricket data loaded from CricAPI.' },
    turningPoint: isSecondInnings ? 'Live chase in progress.' : 'Match has started and score data is pending.',
    aiCards: [
      currentScore.r !== undefined || currentScore.runs !== undefined
        ? 'CricAPI scorecard data is available.'
        : 'CricAPI has started the match feed, but the scorecard is not available yet.',
    ],
    updatedAt: new Date().toISOString(),
  };
}

function createNoLiveIPLState(existingState) {
  return {
    matchId: 'no-live-ipl-match',
    competition: existingState?.competition || 'IPL',
    venue: 'No live IPL match',
    status: 'No live IPL match found',
    battingTeam: 'IPL',
    bowlingTeam: 'Waiting for IPL',
    battingShortName: 'IPL',
    bowlingShortName: 'WAIT',
    target: 0,
    score: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    requiredRunRate: 0,
    runRate: 0,
    last6Balls: ['-', '-', '-', '-', '-', '-'],
    currentBatters: [
      { name: 'Awaiting live IPL', runs: 0, balls: 0 },
      { name: 'scorecard data', runs: 0, balls: 0 },
    ],
    currentBowler: { name: 'Waiting for IPL', overs: '0.0', runs: 0, wickets: 0 },
    pressureLevel: 'Low',
    pressureScore: 0,
    winProbability: { battingTeam: 0, bowlingTeam: 0 },
    momentum: [0, 0, 0, 0, 0],
    runRateGraph: [0, 0, 0],
    overHistory: [],
    currentInsight: 'No live IPL match is available right now. The dashboard will update when an IPL game starts.',
    commentary: { english: 'No live IPL match is available right now.' },
    turningPoint: 'Waiting for the next live IPL match.',
    aiCards: ['CricAPI currently has no live IPL match in progress.'],
    updatedAt: new Date().toISOString(),
  };
}

async function getLiveMatchState(existingState) {
  const liveMatch = await getCurrentIPLMatch();
  if (!liveMatch) {
    return null;
  }

  return transformCricAPIToMatchState(liveMatch, existingState);
}

module.exports = {
  getLiveMatches,
  getMatchInfo,
  getMatchScore,
  getPlayerStats,
  getCurrentIPLMatch,
  getLiveMatchState,
  createNoLiveIPLState,
  transformCricAPIToMatchState,
};
