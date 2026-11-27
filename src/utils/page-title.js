import { useEffect } from 'react';

export const APP_TITLE = 'CubeSAT — PTIT LMS';

// "Page name · CubeSAT" so several open tabs can be told apart; restores the app title on unmount.
export function pageTitle(name) {
  return name ? `${name} · CubeSAT` : APP_TITLE;
}

export function usePageTitle(name) {
  useEffect(() => {
    document.title = pageTitle(name);
    return () => { document.title = APP_TITLE; };
  }, [name]);
}
