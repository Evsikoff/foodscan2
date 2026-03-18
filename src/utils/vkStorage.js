import bridge from '@vkontakte/vk-bridge';

const HISTORY_KEY = 'scan_history';
const MAX_ITEMS = 90;

export async function loadHistory() {
  try {
    const { keys } = await bridge.send('VKWebAppStorageGet', {
      keys: [HISTORY_KEY],
    });
    const raw = keys.find((k) => k.key === HISTORY_KEY)?.value;
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveToHistory(entry) {
  const history = await loadHistory();
  // Ensure date and ID are set
  const entryWithMetadata = {
    ...entry,
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    date: entry.date || new Date().toISOString()
  };
  history.unshift(entryWithMetadata);
  if (history.length > MAX_ITEMS) history.length = MAX_ITEMS;
  await bridge.send('VKWebAppStorageSet', {
    key: HISTORY_KEY,
    value: JSON.stringify(history),
  });
  return history;
}

export async function removeFromHistory(id) {
  const history = await loadHistory();
  const updatedHistory = history.filter(item => item.id !== id);
  await bridge.send('VKWebAppStorageSet', {
    key: HISTORY_KEY,
    value: JSON.stringify(updatedHistory),
  });
  return updatedHistory;
}
