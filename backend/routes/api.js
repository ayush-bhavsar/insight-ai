const express = require('express');
const analytics = require('../api/analytics');
const aiService = require('../api/aiService');

function createApiRouter(getState) {
  const router = express.Router();

  router.get('/state', (req, res) => {
    res.json(getState());
  });

  router.get('/players', (req, res) => {
    res.json({ players: analytics.getPlayerProfiles() });
  });

  router.get('/fantasy', (req, res) => {
    const state = getState();
    res.json({ picks: analytics.buildFantasyPicks(state) });
  });

  router.post('/ai/match', async (req, res) => {
    const state = req.body?.state || getState();
    const insight = await aiService.generateInsightFromMatch(state);
    res.json({ insight });
  });

  router.post('/ai/player', async (req, res) => {
    const player = req.body?.player;
    if (!player) {
      return res.status(400).json({ error: 'player is required' });
    }

    const insight = await aiService.generatePlayerInsight(player);
    res.json({ insight });
  });

  router.post('/ai/fantasy', async (req, res) => {
    const context = req.body?.context || getState();
    const insight = await aiService.generateFantasyInsight(context);
    res.json({ insight });
  });

  router.post('/ai/turning-point', async (req, res) => {
    const context = req.body?.context || getState();
    const insight = await aiService.generateTurningPointInsight(context);
    res.json({ insight });
  });

  router.post('/ai/commentary', async (req, res) => {
    const language = req.body?.language || 'english';
    const context = req.body?.context || getState();
    const commentary = await aiService.generateCommentary(language, context);
    res.json({ commentary });
  });

  return router;
}

module.exports = createApiRouter;
