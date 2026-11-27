import { useEffect, useSyncExternalStore } from 'react';

// Whether a lesson sidebar (LAB 0–8 rail + lesson list) is on screen. The header only switches to the
// learning-page layout (offset for the sidebar, no logo) while one is mounted; a learning URL that is
// still loading or failed keeps the site's standard header.
let mounted = 0;
const listeners = new Set();
const emit = () => listeners.forEach(listener => listener());
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };

export function usePlayerSidebarMounted() {
  return useSyncExternalStore(subscribe, () => mounted > 0, () => false);
}

export function useRegisterPlayerSidebar() {
  useEffect(() => {
    mounted += 1; emit();
    return () => { mounted -= 1; emit(); };
  }, []);
}
