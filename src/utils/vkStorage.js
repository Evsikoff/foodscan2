import bridge from '@vkontakte/vk-bridge';

const HISTORY_KEY = 'scan_history';
const FITNESS_KEY = 'fitness_data';
const MAX_ITEMS = 90;

const isVK = bridge.supports('VKWebAppStorageGet');

async function storageGet(key) {
  if (isVK) {
    const { keys } = await bridge.send('VKWebAppStorageGet', { keys: [key] });
    return keys.find((k) => k.key === key)?.value || '';
  }
  return localStorage.getItem(key) || '';
}

async function storageSet(key, value) {
  if (isVK) {
    await bridge.send('VKWebAppStorageSet', { key, value });
  } else {
    localStorage.setItem(key, value);
  }
}

export async function loadHistory() {
  try {
    const raw = await storageGet(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveToHistory(entry) {
  const history = await loadHistory();
  const entryWithMetadata = {
    ...entry,
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    date: entry.date || new Date().toISOString()
  };
  history.unshift(entryWithMetadata);
  if (history.length > MAX_ITEMS) history.length = MAX_ITEMS;
  await storageSet(HISTORY_KEY, JSON.stringify(history));
  return history;
}

export async function updateHistoryItem(id, updates) {
  const history = await loadHistory();
  const index = history.findIndex(item => item.id === id);
  if (index === -1) return history;
  history[index] = { ...history[index], ...updates };
  await storageSet(HISTORY_KEY, JSON.stringify(history));
  return history;
}

export async function loadFitnessData() {
  try {
    const raw = await storageGet(FITNESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveFitnessData(data) {
  await storageSet(FITNESS_KEY, JSON.stringify(data));
  return data;
}

export async function removeFromHistory(id) {
  const history = await loadHistory();
  const updatedHistory = history.filter(item => item.id !== id);
  await storageSet(HISTORY_KEY, JSON.stringify(updatedHistory));
  return updatedHistory;
}
