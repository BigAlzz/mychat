// Default LM Studio URL
const DEFAULT_URL = process.env.REACT_APP_LM_STUDIO_BASE_URL || 'http://localhost:1234';
const URL_STORAGE_KEY = 'lm_studio_url';

export function getServerUrl(): string {
  return localStorage.getItem(URL_STORAGE_KEY) || DEFAULT_URL;
}

export function setServerUrl(url: string): void {
  localStorage.setItem(URL_STORAGE_KEY, url);
}

export function resetServerUrl(): void {
  localStorage.removeItem(URL_STORAGE_KEY);
}
