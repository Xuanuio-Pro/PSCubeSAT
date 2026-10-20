export const TOKEN_KEY = 'access_token';

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function clearAuthToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function saveAuthToken(token, remember = false) {
  clearAuthToken();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}
