// Client-only: call from onMounted, never at module scope (SSG has no navigator).

// StackBlitz WebContainers never boot on iOS (every iOS browser is WebKit),
// even though iOS 16.4+ has SharedArrayBuffer — UA is the primary signal.
export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as macOS; touch support tells it apart.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// The site is crossOriginIsolated (_headers: COOP + COEP credentialless),
// so a missing SharedArrayBuffer means an engine too old for WebContainers.
export function webContainersSupported(): boolean {
  return !isIOS() && typeof SharedArrayBuffer !== 'undefined';
}
