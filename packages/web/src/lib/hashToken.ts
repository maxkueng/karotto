const TOKEN_KEY = 'token';

export function takeHashToken(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get(TOKEN_KEY);
  if (token === null) {
    return null;
  }
  params.delete(TOKEN_KEY);
  const rest = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ''}`,
  );
  return token || null;
}
