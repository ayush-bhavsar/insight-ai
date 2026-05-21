const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const statePath = path.join(dataDir, 'match-state.json');

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(statePath, JSON.stringify({ updatedAt: new Date().toISOString(), state: null }, null, 2));
  }
}

function loadState() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.state;
  } catch (error) {
    return null;
  }
}

function saveState(state) {
  ensureStorage();
  fs.writeFileSync(statePath, JSON.stringify({ updatedAt: new Date().toISOString(), state }, null, 2));
}

module.exports = {
  loadState,
  saveState,
};
