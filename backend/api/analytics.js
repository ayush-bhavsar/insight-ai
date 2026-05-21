const samplePlayers = [
  {
    name: 'Virat Kohli',
    team: 'RCB',
    role: 'Batter',
    strikeRate: 138,
    recentForm: '88, 42, 71, 55',
    boundaryPercent: 18,
    dotBallPercent: 27,
    matchImpact: 91,
    venuePerformance: 'Excellent at Chinnaswamy',
  },
  {
    name: 'Rashid Khan',
    team: 'GT',
    role: 'Bowler',
    strikeRate: 192,
    recentForm: '2/18, 1/22, 3/19, 1/17',
    boundaryPercent: 8,
    dotBallPercent: 44,
    matchImpact: 94,
    venuePerformance: 'Controls middle overs on slow decks',
  },
  {
    name: 'Suryakumar Yadav',
    team: 'MI',
    role: 'Batter',
    strikeRate: 174,
    recentForm: '64, 31, 89, 23',
    boundaryPercent: 24,
    dotBallPercent: 20,
    matchImpact: 89,
    venuePerformance: 'Strong against pace under lights',
  },
  {
    name: 'Jasprit Bumrah',
    team: 'MI',
    role: 'Bowler',
    strikeRate: 285,
    recentForm: '2/24, 3/16, 1/19, 2/21',
    boundaryPercent: 5,
    dotBallPercent: 51,
    matchImpact: 96,
    venuePerformance: 'Elite death-overs record',
  },
  {
    name: 'Shubman Gill',
    team: 'GT',
    role: 'Batter',
    strikeRate: 146,
    recentForm: '52, 77, 48, 61',
    boundaryPercent: 20,
    dotBallPercent: 25,
    matchImpact: 86,
    venuePerformance: 'Technically solid on true pitches',
  },
  {
    name: 'Hardik Pandya',
    team: 'MI',
    role: 'All-Rounder',
    strikeRate: 162,
    recentForm: '31, 19, 46, 2/27',
    boundaryPercent: 21,
    dotBallPercent: 22,
    matchImpact: 87,
    venuePerformance: 'Impact player in pressure chases',
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function createInitialMatchState() {
  return {
    matchId: 'ipl-insight-ai-demo',
    competition: 'IPL 2026',
    venue: 'Narendra Modi Stadium',
    status: 'Live',
    battingTeam: 'Chennai Super Kings',
    bowlingTeam: 'Mumbai Indians',
    battingShortName: 'CSK',
    bowlingShortName: 'MI',
    target: 184,
    score: 126,
    wickets: 4,
    overs: 15,
    balls: 2,
    requiredRunRate: 11.5,
    runRate: 8.1,
    last6Balls: ['1', '0', '4', 'W', '2', '1'],
    currentBatters: [
      { name: 'Ruturaj Gaikwad', runs: 61, balls: 41 },
      { name: 'Shivam Dube', runs: 22, balls: 13 },
    ],
    currentBowler: { name: 'Jasprit Bumrah', overs: '3.2', runs: 26, wickets: 1 },
    pressureLevel: 'High',
    pressureScore: 82,
    winProbability: { battingTeam: 34, bowlingTeam: 66 },
    momentum: [52, 54, 58, 61, 59, 63, 67, 69, 74, 71, 76, 79],
    runRateGraph: [7.1, 7.6, 8.0, 8.4, 8.2, 8.6, 8.9, 9.3, 9.6, 9.1, 8.8, 8.1],
    overHistory: [
      { over: 1, runs: 8, wickets: 0, momentum: 48 },
      { over: 2, runs: 9, wickets: 0, momentum: 52 },
      { over: 3, runs: 10, wickets: 1, momentum: 46 },
      { over: 4, runs: 7, wickets: 0, momentum: 45 },
      { over: 5, runs: 12, wickets: 0, momentum: 56 },
      { over: 6, runs: 14, wickets: 0, momentum: 60 },
      { over: 7, runs: 8, wickets: 1, momentum: 55 },
      { over: 8, runs: 11, wickets: 0, momentum: 59 },
      { over: 9, runs: 9, wickets: 0, momentum: 57 },
      { over: 10, runs: 13, wickets: 0, momentum: 64 },
      { over: 11, runs: 6, wickets: 1, momentum: 52 },
      { over: 12, runs: 10, wickets: 0, momentum: 60 },
      { over: 13, runs: 7, wickets: 0, momentum: 58 },
      { over: 14, runs: 9, wickets: 0, momentum: 62 },
      { over: 15, runs: 8, wickets: 0, momentum: 65 },
    ],
    currentInsight: 'The chase is under real pressure because the required rate is climbing faster than the scoring rate.',
    commentary: {
      english: 'The batting side needs calm execution now. A boundary or two could flip the pressure immediately.',
      hindi: 'Ab batting team ko shant dimaag se khelna hoga. Ek do boundary pressure ko turant badal sakti hain.',
      gujarati: 'Havé batting team ne shant rahine khelvu padse. Ek-be boundary thi pressure tatkal badli shake chhe.',
      hinglish: 'Ab batting team ko calm rehna hoga. Ek boundary ya do dot balls ka pressure turant change kar sakte hain.',
    },
    turningPoint: '15th over wicket changed the chase balance.',
    aiCards: [
      'The batting team is under pressure because dot balls have slowed the chase.',
      'The finishers now matter more than the top order.',
      'A wicket in the next over could make the target feel much bigger.',
    ],
    updatedAt: new Date().toISOString(),
  };
}

function derivePressureScore(state) {
  const rrGap = Math.max(0, state.requiredRunRate - state.runRate);
  const wicketFactor = state.wickets * 4;
  const dotPenalty = Math.max(0, 18 - state.last6Balls.filter((ball) => ball === '0').length * 5);
  const boundaryBoost = state.last6Balls.filter((ball) => ball === '4' || ball === '6').length * 3;
  return clamp(Math.round(rrGap * 7 + wicketFactor + dotPenalty - boundaryBoost), 0, 100);
}

function pressureLevelFromScore(score) {
  if (score < 35) return 'Low';
  if (score < 70) return 'Medium';
  return 'High';
}

function isMatchComplete(state) {
  return state.score >= state.target || state.wickets >= 10 || state.overs >= 20;
}

function calculateWinProbability(state) {
  const ballsRemaining = Math.max(0, 120 - (state.overs * 6 + state.balls));
  const runsRequired = Math.max(0, state.target - state.score);
  const chaseProgress = state.target > 0 ? state.score / state.target : 0;
  const overPressure = state.requiredRunRate - state.runRate;
  const wicketDamage = state.wickets * 2.6;
  const ballsPressure = ballsRemaining > 0 ? runsRequired / Math.max(1, ballsRemaining / 6) : 0;

  let battingChance = 50 + chaseProgress * 30 - overPressure * 5 - wicketDamage - ballsPressure * 1.2;
  battingChance = clamp(Math.round(battingChance), 2, 98);

  return {
    battingTeam: battingChance,
    bowlingTeam: 100 - battingChance,
  };
}

function buildMomentumSeries(state) {
  const latestMomentum = state.overHistory.slice(-12).map((entry) => entry.momentum);
  const latestRunRate = state.runRateGraph.slice(-12);
  return {
    momentum: latestMomentum,
    runRate: latestRunRate,
  };
}

function detectTurningPoint(state) {
  const decisiveOver = [...state.overHistory].reverse().find((entry) => entry.wickets > 0 || entry.runs >= 14 || entry.momentum >= 70);
  if (!decisiveOver) {
    return 'The match is still building toward a clear turning point.';
  }

  if (decisiveOver.wickets > 0) {
    return `The ${decisiveOver.over}th over was a turning point because a wicket broke the scoring rhythm.`;
  }

  if (decisiveOver.runs >= 14) {
    return `The ${decisiveOver.over}th over shifted momentum with a quick scoring burst.`;
  }

  return `The ${decisiveOver.over}th over changed the feel of the chase.`;
}

function simulateNextBall(state) {
  const next = JSON.parse(JSON.stringify(state));
  if (isMatchComplete(next)) {
    next.status = 'Complete';
    next.requiredRunRate = 0;
    next.pressureScore = 0;
    next.pressureLevel = 'Low';
    next.winProbability = next.score >= next.target
      ? { battingTeam: 100, bowlingTeam: 0 }
      : { battingTeam: 0, bowlingTeam: 100 };
    next.currentInsight = next.score >= next.target
      ? 'The chase is complete and the batting team has finished the job.'
      : 'The innings is complete and the bowling side has controlled the end of the match.';
    next.turningPoint = detectTurningPoint(next);
    return next;
  }

  const ballOutcomes = [0, 0, 1, 1, 2, 2, 3, 4, 4, 6, 'W'];
  const outcome = ballOutcomes[Math.floor(Math.random() * ballOutcomes.length)];
  const currentOverRuns = next._currentOverRuns || 0;
  const currentOverWickets = next._currentOverWickets || 0;

  next.balls += 1;
  let ballText = String(outcome);

  if (outcome === 'W') {
    next.wickets += 1;
    next._currentOverWickets = currentOverWickets + 1;
    ballText = 'W';
    if (next.currentBatters.length > 1) {
      next.currentBatters[1] = {
        name: `New Batter ${next.wickets}`,
        runs: 0,
        balls: 0,
      };
    }
  } else {
    next.score += outcome;
    next._currentOverRuns = currentOverRuns + outcome;
    if (next.currentBatters[0]) {
      next.currentBatters[0].runs += outcome;
      next.currentBatters[0].balls += 1;
    }
  }

  if (next.balls === 6) {
    const completedOver = next.overs + 1;
    next.overHistory.push({
      over: completedOver,
      runs: next._currentOverRuns || 0,
      wickets: next._currentOverWickets || 0,
      momentum: clamp((next.momentum[next.momentum.length - 1] || 50) + ((next._currentOverRuns || 0) - 6) * 2 - (next._currentOverWickets || 0) * 8, 0, 100),
    });
    next.overs += 1;
    next.balls = 0;
    next._currentOverRuns = 0;
    next._currentOverWickets = 0;
    next.currentBowler = {
      name: next.overs % 2 === 0 ? 'Ravi Bishnoi' : 'Jasprit Bumrah',
      overs: `${next.overs}.0`,
      runs: Math.max(12, next.currentBowler.runs + Math.floor(Math.random() * 6) - 2),
      wickets: next.currentBowler.wickets,
    };
  }

  next.last6Balls = [...next.last6Balls, ballText].slice(-6);
  next.runRate = round(next.score / Math.max(1, (next.overs * 6 + next.balls) / 6));
  next.requiredRunRate = round((Math.max(0, next.target - next.score) / Math.max(1, (20 - next.overs - next.balls / 6))) * 1.0);
  next.pressureScore = derivePressureScore(next);
  next.pressureLevel = pressureLevelFromScore(next.pressureScore);
  next.winProbability = calculateWinProbability(next);
  next.momentum = [...next.momentum.slice(1), clamp(next.pressureScore - 10 + Math.floor(Math.random() * 10), 0, 100)];
  next.runRateGraph = [...next.runRateGraph.slice(1), next.runRate];
  next.currentInsight = next.pressureScore >= 70
    ? 'The batting side is in a high-pressure phase and needs a boundary soon.'
    : next.pressureScore >= 35
      ? 'This is a balanced phase where a smart over can decide momentum.'
      : 'The chase is under control right now, but one wicket could still change the picture.';
  next.turningPoint = detectTurningPoint(next);
  if (isMatchComplete(next)) {
    next.status = 'Complete';
    next.requiredRunRate = 0;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

function getPlayerProfiles() {
  return samplePlayers.map((player) => ({
    ...player,
    strengthSummary: `${player.name} stands out for ${player.matchImpact > 90 ? 'elite match impact and clutch value' : 'reliable impact under pressure'}.`,
    weaknessSummary: player.dotBallPercent > 30 ? 'Can be slowed down by disciplined bowling.' : 'Needs a consistent support role to dominate.',
  }));
}

function buildFantasyPicks(state) {
  return {
    captain: [
      { name: 'Virat Kohli', reason: 'High control, stable run flow, and reliable chase management.' },
      { name: 'Shubman Gill', reason: 'Strong recent form and a calm batting base for fantasy points.' },
    ],
    viceCaptain: [
      { name: 'Rashid Khan', reason: 'Wicket-taking threat and pressure control in middle overs.' },
      { name: 'Jasprit Bumrah', reason: 'Death-over impact can create quick fantasy spikes.' },
    ],
    riskyPicks: [
      { name: 'Hardik Pandya', reason: 'Explosive ceiling if he gets both batting and bowling involvement.' },
      { name: 'Suryakumar Yadav', reason: 'Can win fantasy contests with a short, high-impact burst.' },
    ],
    pitchNote: state.requiredRunRate > state.runRate ? 'The pitch is asking for cleaner hitting, so all-rounders and finishers gain value.' : 'The pitch looks balanced, so anchors and strike bowlers remain useful fantasy picks.',
  };
}

module.exports = {
  createInitialMatchState,
  simulateNextBall,
  isMatchComplete,
  calculateWinProbability,
  derivePressureScore,
  pressureLevelFromScore,
  buildMomentumSeries,
  detectTurningPoint,
  getPlayerProfiles,
  buildFantasyPicks,
};
