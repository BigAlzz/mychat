// Storage key for server history
const SERVER_HISTORY_KEY = 'lm_studio_url_history';
const MAX_HISTORY_ITEMS = 10;

// Default server URLs - only the specific complete URLs
const DEFAULT_SERVERS = [
  'http://192.168.50.89:1234',
  'http://172.31.160.1:3500'
] as const;

export function getServerHistory(): string[] {
  const history = localStorage.getItem(SERVER_HISTORY_KEY);
  if (!history) {
    // If no history exists, initialize with default servers
    localStorage.setItem(SERVER_HISTORY_KEY, JSON.stringify(DEFAULT_SERVERS));
    return [...DEFAULT_SERVERS];
  }
  
  // Ensure we only have complete URLs in the history
  const savedHistory: string[] = JSON.parse(history);
  const validUrls = savedHistory.filter((url: string) => 
    url === 'http://192.168.50.89:1234' || 
    url === 'http://172.31.160.1:3500' ||
    url.startsWith('http://') && url.includes(':') && !url.endsWith(':')
  );
  
  // If the history was invalid, reset it
  if (validUrls.length !== savedHistory.length) {
    localStorage.setItem(SERVER_HISTORY_KEY, JSON.stringify(DEFAULT_SERVERS));
    return [...DEFAULT_SERVERS];
  }
  
  return validUrls;
}

export function addServerToHistory(url: string): void {
  // Only add valid URLs
  if (!url.startsWith('http://') || !url.includes(':') || url.endsWith(':')) {
    return;
  }
  
  const history = getServerHistory();
  // Remove the URL if it already exists to avoid duplicates
  const filteredHistory = history.filter((item: string) => item !== url);
  // Add the new URL to the beginning of the array
  filteredHistory.unshift(url);
  // Keep only the last MAX_HISTORY_ITEMS items
  const trimmedHistory = filteredHistory.slice(0, MAX_HISTORY_ITEMS);
  localStorage.setItem(SERVER_HISTORY_KEY, JSON.stringify(trimmedHistory));
}

export function clearServerHistory(): void {
  // Reset to default servers
  localStorage.setItem(SERVER_HISTORY_KEY, JSON.stringify(DEFAULT_SERVERS));
}

// Force reset the history to defaults (call this once to clean up)
clearServerHistory();
