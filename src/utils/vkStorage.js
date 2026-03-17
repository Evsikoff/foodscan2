import bridge from '@vkontakte/vk-bridge';

const HISTORY_KEY = 'scan_history';
const MAX_ITEMS = 30;

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
  history.unshift(entry);
  if (history.length > MAX_ITEMS) history.length = MAX_ITEMS;
  await bridge.send('VKWebAppStorageSet', {
    key: HISTORY_KEY,
    value: JSON.stringify(history),
  });
  return history;
}
