export const DISPLAY_PATH = '/display';

export function isDisplayPath(): boolean {
  return window.location.pathname === DISPLAY_PATH;
}
