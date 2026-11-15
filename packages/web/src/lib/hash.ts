export function takeHashParam(key: string): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const value = params.get(key);
  if (value === null) {
    return null;
  }
  params.delete(key);
  const rest = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ''}`,
  );
  return value;
}
