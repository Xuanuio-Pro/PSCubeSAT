import { useEffect } from 'react';

export function useScrollRailToActive(activeLabRef, trigger) {
  useEffect(() => {
    const activeLab = activeLabRef.current;
    const rail = activeLab?.parentElement;
    if (!rail) return;
    const itemBounds = activeLab.getBoundingClientRect();
    const railBounds = rail.getBoundingClientRect();
    if (itemBounds.top < railBounds.top) rail.scrollTop -= railBounds.top - itemBounds.top + 4;
    else if (itemBounds.bottom > railBounds.bottom) rail.scrollTop += itemBounds.bottom - railBounds.bottom + 4;
  }, [activeLabRef, trigger]);
}
