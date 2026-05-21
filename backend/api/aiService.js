const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function fallbackText(type, payload) {
  if (type === 'match') {
    return payload.pressureLevel === 'High'
      ? 'The batting side is under real pressure. A clean over can still turn the chase back in their favor.'
      : 'The chase is balanced. One strong scoring burst could swing the game quickly.';
  }

  if (type === 'player') {
    return `${payload.name} looks composed and useful in pressure moments, with a clear fantasy upside.`;
  }

  if (type === 'fantasy') {
    return 'Back stable top-order batters, one premium wicket-taker, and one high-ceiling all-rounder for balance.';
  }

  if (type === 'turningPoint') {
    return 'A wicket or a boundary-heavy over has shaped the match momentum.';
  }

  if (type === 'commentary') {
    return payload.language === 'hindi'
      ? 'Ab match ka pressure badh raha hai aur ek achha over sab kuch badal sakta hai.'
      : 'The match is tightening, and one good over could change everything.';
  }

  return 'The match is still developing, but the next few balls will matter a lot.';
}

function buildPrompt(type, payload) {
  const sharedInstructions = [
    'Explain cricket in very simple language for casual IPL fans.',
    'Keep the response short, vivid, and actionable.',
    'Avoid jargon unless it is immediately explained.',
  ].join(' ');

  if (type === 'match') {
    return `${sharedInstructions}\n\nTask: Analyze this IPL match situation for casual fans and explain the momentum, pressure, and likely next phase.\nMatch data: ${JSON.stringify(payload, null, 2)}`;
  }

  if (type === 'player') {
    return `${sharedInstructions}\n\nTask: Explain this IPL player profile with strengths, weaknesses, and a short performance summary.\nPlayer data: ${JSON.stringify(payload, null, 2)}`;
  }

  if (type === 'fantasy') {
    return `${sharedInstructions}\n\nTask: Suggest the best fantasy captain, vice-captain, and risky picks with very simple reasons.\nFantasy context: ${JSON.stringify(payload, null, 2)}`;
  }

  if (type === 'turningPoint') {
    return `${sharedInstructions}\n\nTask: Identify the turning point of this match and explain why it matters.\nContext: ${JSON.stringify(payload, null, 2)}`;
  }

  if (type === 'commentary') {
    return `${sharedInstructions}\n\nTask: Generate short live commentary in ${payload.language}. Write in a fan-friendly tone.\nContext: ${JSON.stringify(payload, null, 2)}`;
  }

  return `${sharedInstructions}\n\nContext: ${JSON.stringify(payload, null, 2)}`;
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const url = `${GEMINI_ENDPOINT}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 220,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join(' ');
  return text || null;
}

async function generateInsightFromMatch(matchState) {
  const prompt = buildPrompt('match', matchState);
  try {
    const aiText = await callGemini(prompt);
    return aiText || fallbackText('match', matchState);
  } catch (error) {
    return fallbackText('match', matchState);
  }
}

async function generatePlayerInsight(player) {
  const prompt = buildPrompt('player', player);
  try {
    const aiText = await callGemini(prompt);
    return aiText || fallbackText('player', player);
  } catch (error) {
    return fallbackText('player', player);
  }
}

async function generateFantasyInsight(context) {
  const prompt = buildPrompt('fantasy', context);
  try {
    const aiText = await callGemini(prompt);
    return aiText || fallbackText('fantasy', context);
  } catch (error) {
    return fallbackText('fantasy', context);
  }
}

async function generateTurningPointInsight(context) {
  const prompt = buildPrompt('turningPoint', context);
  try {
    const aiText = await callGemini(prompt);
    return aiText || fallbackText('turningPoint', context);
  } catch (error) {
    return fallbackText('turningPoint', context);
  }
}

async function generateCommentary(language, context) {
  const prompt = buildPrompt('commentary', { language, ...context });
  try {
    const aiText = await callGemini(prompt);
    return aiText || fallbackText('commentary', { language, ...context });
  } catch (error) {
    return fallbackText('commentary', { language, ...context });
  }
}

module.exports = {
  generateInsightFromMatch,
  generatePlayerInsight,
  generateFantasyInsight,
  generateTurningPointInsight,
  generateCommentary,
};
