/**
 * True when MonEXP runs as the installed home-screen app (iPhone "Add to Home Screen",
 * Android "Install app") rather than in a browser tab. Some pages are web-only.
 */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
