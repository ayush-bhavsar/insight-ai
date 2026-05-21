require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const analytics = require('./api/analytics');
const store = require('./api/matchStore');
const createApiRouter = require('./routes/api');
const aiService = require('./api/aiService');
const cricapiService = require('./api/cricapiService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;
const frontendPath = path.join(__dirname, '..', 'frontend');

async function initializeMatchState() {
  const storedState = store.loadState();
  const shouldResetState = !storedState || storedState.overs > 20 || storedState.wickets > 10 || storedState.score > storedState.target + 60;

  if (process.env.LIVE_DATA_PROVIDER === 'cricapi' && process.env.CRICAPI_KEY) {
    try {
      const liveMatch = await cricapiService.getCurrentIPLMatch();
      if (liveMatch) {
        return cricapiService.transformCricAPIToMatchState(liveMatch, storedState);
      }
      return cricapiService.createNoLiveIPLState(storedState);
    } catch (error) {
      console.warn('CricAPI fetch failed, falling back to simulator:', error.message);
      return cricapiService.createNoLiveIPLState(storedState);
    }
  }

  return shouldResetState ? analytics.createInitialMatchState() : storedState;
}

let currentState = null;

async function boot() {
  currentState = await initializeMatchState();
  store.saveState(currentState);
}

async function syncCricAPIState() {
  try {
    const liveState = await cricapiService.getLiveMatchState(currentState);
    if (liveState) {
      persistAndBroadcast(liveState);
      return;
    }

    if (currentState?.matchId !== 'no-live-ipl-match') {
      persistAndBroadcast(cricapiService.createNoLiveIPLState(currentState));
    }
  } catch (error) {
    console.warn('CricAPI sync failed, keeping current state:', error.message);
  }
}

app.use(cors());
app.use(express.json());
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});
app.use(express.static(frontendPath));
app.use('/api', createApiRouter(() => currentState));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'IPL Insight AI' });
});

function persistAndBroadcast(state) {
  currentState = state;
  store.saveState(currentState);
  io.emit('match:update', currentState);
}

async function refreshAIPanel(state) {
  const [matchInsight, turningPoint, commentaryEnglish] = await Promise.all([
    aiService.generateInsightFromMatch(state),
    aiService.generateTurningPointInsight(state),
    aiService.generateCommentary('english', state),
  ]);

  currentState = {
    ...state,
    currentInsight: matchInsight,
    turningPoint,
    commentary: {
      ...state.commentary,
      english: commentaryEnglish,
    },
    aiCards: [
      matchInsight,
      turningPoint,
      state.pressureLevel === 'High'
        ? 'The batting side is in a strong pressure phase.'
        : 'The match is evenly balanced and ready for a big swing.',
    ],
  };

  store.saveState(currentState);
  io.emit('match:update', currentState);
}

function simulateTick() {
  if (process.env.LIVE_DATA_PROVIDER === 'cricapi') {
    return;
  }

  if (analytics.isMatchComplete(currentState)) {
    currentState = analytics.simulateNextBall(currentState);
    persistAndBroadcast(currentState);
    return;
  }

  const nextState = analytics.simulateNextBall(currentState);
  persistAndBroadcast(nextState);

  if (nextState.balls === 0) {
    refreshAIPanel(nextState).catch(() => {
      io.emit('match:update', currentState);
    });
  }
}

io.on('connection', (socket) => {
  socket.emit('match:update', currentState);

  socket.on('request:state', () => {
    socket.emit('match:update', currentState);
  });

  socket.on('request:commentary', async (payload = {}) => {
    const language = payload.language || 'english';
    const commentary = await aiService.generateCommentary(language, currentState);
    socket.emit('commentary:update', { language, commentary });
  });
});

if (process.env.LIVE_DATA_PROVIDER === 'cricapi') {
  setInterval(() => {
    syncCricAPIState().catch(() => {});
  }, 15000);
} else {
  setInterval(simulateTick, 5000);
}

boot().then(() => {
  app.listen(PORT, () => {
    console.log(`IPL Insight AI running on http://localhost:${PORT}`);
    console.log(`Live data provider: ${process.env.LIVE_DATA_PROVIDER === 'cricapi' ? 'CricAPI' : 'Simulator'}`);
  });
}).catch((error) => {
  console.error('Failed to initialize:', error);
  process.exit(1);
});
