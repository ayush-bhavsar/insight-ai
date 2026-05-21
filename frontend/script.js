const socket = io();

const elements = {
  matchTitle: document.getElementById('match-title'),
  matchStatus: document.getElementById('match-status'),
  battingTeam: document.getElementById('batting-team'),
  score: document.getElementById('score'),
  wickets: document.getElementById('wickets'),
  overs: document.getElementById('overs'),
  runRate: document.getElementById('run-rate'),
  requiredRr: document.getElementById('required-rr'),
  targetScore: document.getElementById('target-score'),
  currentBowler: document.getElementById('current-bowler'),
  matchMode: document.getElementById('match-mode'),
  pressureFill: document.getElementById('pressure-fill'),
  pressureLevel: document.getElementById('pressure-level'),
  pressureScore: document.getElementById('pressure-score'),
  battersStrip: document.getElementById('batters-strip'),
  lastBallsStrip: document.getElementById('last-balls-strip'),
  aiCards: document.getElementById('ai-cards'),
  commentaryText: document.getElementById('commentary-text'),
  playerGrid: document.getElementById('player-grid'),
  fantasyGrid: document.getElementById('fantasy-grid'),
  pitchNote: document.getElementById('pitch-note'),
  teamAName: document.getElementById('team-a-name'),
  teamBName: document.getElementById('team-b-name'),
  teamAWin: document.getElementById('team-a-win'),
  teamBWin: document.getElementById('team-b-win'),
  teamABar: document.getElementById('team-a-bar'),
  teamBBar: document.getElementById('team-b-bar'),
  turningPoint: document.getElementById('turning-point'),
  refreshMatchAi: document.getElementById('refresh-match-ai'),
  refreshFantasyAi: document.getElementById('refresh-fantasy-ai'),
  languageSwitch: document.getElementById('language-switch'),
};

const chartState = {
  momentum: null,
  runRate: null,
};

let liveState = null;
let playerProfiles = [];
let fantasyData = null;
let activeLanguage = 'english';
let lastCommentaryOver = null;

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function normalizeState(state) {
  return {
    ...state,
    commentary: state.commentary || {},
    aiCards: state.aiCards || [],
    overHistory: state.overHistory || [],
    runRateGraph: state.runRateGraph || [],
    momentum: state.momentum || [],
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function renderHeader(state) {
  elements.matchTitle.textContent = `${state.battingTeam} vs ${state.bowlingTeam} • ${state.venue}`;
  elements.matchStatus.textContent = state.status;
  elements.battingTeam.textContent = state.battingShortName || state.battingTeam;
  elements.score.textContent = state.score;
  elements.wickets.textContent = state.wickets;
  elements.overs.textContent = `${state.overs}.${state.balls}`;
  elements.runRate.textContent = formatNumber(state.runRate || 0);
  elements.requiredRr.textContent = formatNumber(state.requiredRunRate || 0);
  elements.targetScore.textContent = state.target;
  elements.currentBowler.textContent = state.currentBowler?.name || '-';
  elements.matchMode.textContent = `${state.status} • ${state.pressureLevel} Pressure`;
}

function renderPressure(state) {
  const score = state.pressureScore || 0;
  const level = state.pressureLevel || 'Low';
  const degree = Math.min(360, (score / 100) * 360);
  elements.pressureLevel.textContent = level;
  elements.pressureScore.textContent = `${score}/100`;
  elements.pressureFill.style.background = `conic-gradient(var(--amber) 0deg, var(--teal) ${degree}deg, rgba(255,255,255,0.08) ${degree}deg)`;
}

function renderBatters(state) {
  elements.battersStrip.innerHTML = '';
  (state.currentBatters || []).forEach((batter) => {
    const pill = document.createElement('span');
    pill.className = 'chip';
    pill.textContent = `${batter.name} ${batter.runs}(${batter.balls})`;
    elements.battersStrip.appendChild(pill);
  });
}

function renderLastBalls(state) {
  elements.lastBallsStrip.innerHTML = '';
  (state.last6Balls || []).forEach((ball) => {
    const pill = document.createElement('span');
    pill.className = `chip ${ball === 'W' ? 'wicket' : ball === '0' ? 'dot' : ''}`.trim();
    pill.textContent = ball;
    elements.lastBallsStrip.appendChild(pill);
  });
}

function renderAiCards(state) {
  const cards = state.aiCards && state.aiCards.length ? state.aiCards : [state.currentInsight || 'The match is still developing.'];
  elements.aiCards.innerHTML = cards.map((card) => `<article class="ai-item"><p>${card}</p></article>`).join('');
}

function renderTurnPoint(state) {
  elements.turningPoint.textContent = state.turningPoint || 'The match is still waiting for a defining moment.';
}

function renderWinProbability(state) {
  const battingWin = state.winProbability?.battingTeam ?? 50;
  const bowlingWin = state.winProbability?.bowlingTeam ?? 50;
  elements.teamAName.textContent = state.battingTeam;
  elements.teamBName.textContent = state.bowlingTeam;
  elements.teamAWin.textContent = `${battingWin}%`;
  elements.teamBWin.textContent = `${bowlingWin}%`;
  elements.teamABar.style.width = `${battingWin}%`;
  elements.teamBBar.style.width = `${bowlingWin}%`;
}

function renderCommentary(state) {
  const commentary = state.commentary?.[activeLanguage] || state.commentary?.english || 'Live commentary will appear here.';
  elements.commentaryText.textContent = commentary;
}

function renderFantasy(picks) {
  if (!picks) {
    return;
  }

  const sections = [
    {
      title: 'Captain Picks',
      items: picks.captain || [],
    },
    {
      title: 'Vice-Captain Picks',
      items: picks.viceCaptain || [],
    },
    {
      title: 'Risky Picks',
      items: picks.riskyPicks || [],
    },
  ];

  elements.fantasyGrid.innerHTML = sections.map((section) => `
    <article class="fantasy-card">
      <strong>${section.title}</strong>
      <div class="pick-list">
        ${section.items.map((item) => `<div class="pick-item"><span>${item.name}</span><small>${item.reason}</small></div>`).join('')}
      </div>
    </article>
  `).join('');

  elements.pitchNote.textContent = picks.pitchNote || '';
}

function renderPlayers(players) {
  elements.playerGrid.innerHTML = players.map((player, index) => `
    <article class="player-card">
      <header>
        <div>
          <h3>${player.name}</h3>
          <span class="player-chip">${player.team} • ${player.role}</span>
        </div>
        <button class="player-btn" data-player-index="${index}">Ask Gemini</button>
      </header>
      <div class="player-stats">
        <div class="stat-pill"><span>Strike Rate</span><strong>${player.strikeRate}</strong></div>
        <div class="stat-pill"><span>Recent Form</span><strong>${player.recentForm}</strong></div>
        <div class="stat-pill"><span>Boundary %</span><strong>${player.boundaryPercent}%</strong></div>
        <div class="stat-pill"><span>Dot Ball %</span><strong>${player.dotBallPercent}%</strong></div>
        <div class="stat-pill"><span>Match Impact</span><strong>${player.matchImpact}</strong></div>
        <div class="stat-pill"><span>Venue</span><strong>${player.venuePerformance}</strong></div>
      </div>
      <div class="player-summary">${player.strengthSummary}</div>
      <div class="player-summary">${player.weaknessSummary}</div>
    </article>
  `).join('');
}

function initCharts(state) {
  const labels = (state.overHistory || []).map((entry) => `${entry.over}`);
  const momentumValues = state.momentum || [];
  const runRateValues = state.runRateGraph || [];

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false,
      },
      legend: {
        labels: {
          color: '#dbe7ff',
          usePointStyle: true,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#8b9bb8' },
      },
      y: {
        beginAtZero: true,
        suggestedMax: 100,
        ticks: { color: '#8b9bb8' },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
    },
  };

  chartState.momentum = new Chart(document.getElementById('momentumChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Momentum',
          data: momentumValues,
          borderColor: '#2ef2c2',
          backgroundColor: 'rgba(46, 242, 194, 0.14)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: sharedOptions,
  });

  chartState.runRate = new Chart(document.getElementById('runRateChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Run Rate',
          data: runRateValues,
          borderColor: '#ffb44c',
          backgroundColor: 'rgba(255, 180, 76, 0.14)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: sharedOptions,
  });
}

function updateCharts(state) {
  const labels = (state.overHistory || []).map((entry) => `${entry.over}`);
  const momentumValues = state.momentum || [];
  const runRateValues = state.runRateGraph || [];

  if (!chartState.momentum || !chartState.runRate) {
    initCharts(state);
    return;
  }

  chartState.momentum.data.labels = labels;
  chartState.momentum.data.datasets[0].data = momentumValues;
  chartState.runRate.data.labels = labels;
  chartState.runRate.data.datasets[0].data = runRateValues;
  chartState.momentum.update();
  chartState.runRate.update();
}

async function refreshCommentary(state, language = activeLanguage) {
  try {
    const { commentary } = await fetchJson('/api/ai/commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, context: state }),
    });
    state.commentary = state.commentary || {};
    state.commentary[language] = commentary;
    if (language === activeLanguage) {
      renderCommentary(state);
    }
  } catch (error) {
    if (language === activeLanguage) {
      renderCommentary(state);
    }
  }
}

async function refreshMatchAi(state) {
  const { insight } = await fetchJson('/api/ai/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  state.currentInsight = insight;
  const secondary = state.pressureLevel === 'High'
    ? 'The batting team is in a danger zone and needs a quick release shot.'
    : 'The chase still has room, but one over can change the feel completely.';
  state.aiCards = [insight, secondary, state.turningPoint || 'The turning point is still forming.'];
  renderAiCards(state);
}

async function refreshFantasyAi(state) {
  const { insight } = await fetchJson('/api/ai/fantasy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: state }),
  });
  fantasyData.pitchNote = insight;
  elements.pitchNote.textContent = insight;
}

async function refreshPlayerInsight(player, card) {
  const response = await fetchJson('/api/ai/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player }),
  });
  const summary = card.querySelector('.player-summary');
  if (summary) {
    summary.textContent = response.insight;
  }
}

function setLanguage(language) {
  activeLanguage = language;
  document.querySelectorAll('.lang-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === language);
  });
  if (liveState) {
    renderCommentary(liveState);
    refreshCommentary(liveState, language);
  }
}

function updateFromState(nextState, isInitial = false) {
  const previousOver = liveState?.overs;
  liveState = normalizeState(nextState);
  renderHeader(liveState);
  renderPressure(liveState);
  renderBatters(liveState);
  renderLastBalls(liveState);
  renderAiCards(liveState);
  renderWinProbability(liveState);
  renderTurnPoint(liveState);
  renderCommentary(liveState);
  updateCharts(liveState);

  if (isInitial || previousOver !== liveState.overs) {
    refreshCommentary(liveState, activeLanguage);
  }
}

async function bootstrap() {
  const [stateResponse, playersResponse, fantasyResponse] = await Promise.all([
    fetchJson('/api/state'),
    fetchJson('/api/players'),
    fetchJson('/api/fantasy'),
  ]);

  playerProfiles = playersResponse.players || [];
  fantasyData = fantasyResponse.picks || null;
  renderPlayers(playerProfiles);
  renderFantasy(fantasyData);
  updateFromState(stateResponse, true);

  elements.refreshMatchAi.addEventListener('click', () => {
    if (liveState) {
      refreshMatchAi(liveState);
    }
  });

  elements.refreshFantasyAi.addEventListener('click', () => {
    if (liveState) {
      refreshFantasyAi(liveState);
    }
  });

  elements.languageSwitch.addEventListener('click', (event) => {
    const button = event.target.closest('.lang-btn');
    if (!button) {
      return;
    }
    setLanguage(button.dataset.lang);
  });

  elements.playerGrid.addEventListener('click', (event) => {
    const button = event.target.closest('.player-btn');
    if (!button) {
      return;
    }
    const index = Number(button.dataset.playerIndex);
    const card = button.closest('.player-card');
    const player = playerProfiles[index];
    if (player) {
      refreshPlayerInsight(player, card);
    }
  });
}

socket.on('match:update', (state) => {
  updateFromState(state);
});

socket.on('commentary:update', ({ language, commentary }) => {
  if (!liveState) {
    return;
  }
  liveState.commentary = liveState.commentary || {};
  liveState.commentary[language] = commentary;
  if (language === activeLanguage) {
    renderCommentary(liveState);
  }
});

bootstrap().catch((error) => {
  elements.matchTitle.textContent = 'Unable to load match data';
  elements.commentaryText.textContent = 'The dashboard could not load live data.';
  console.error(error);
});
