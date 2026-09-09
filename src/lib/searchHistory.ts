const SEARCH_HISTORY_KEY = 'maltese_archive_search_history';

export const getSearchHistory = (): string[] => {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveSearchHistory = (query: string): string[] => {
  const trimmed = query.trim();
  if (!trimmed) return getSearchHistory();
  try {
    const current = getSearchHistory();
    const updated = [trimmed, ...current.filter(item => item.toLowerCase() !== trimmed.toLowerCase())];
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated.slice(0, 10)));
    return updated;
  } catch {
    return getSearchHistory();
  }
};

export const removeSearchHistoryItem = (query: string): string[] => {
  try {
    const current = getSearchHistory();
    const updated = current.filter(item => item !== query);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return getSearchHistory();
  }
};

export const clearSearchHistory = (): void => {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {}
};
