import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isPageScrollTarget, readScrollState, scrollPageToTop } from './scroll-top';

export default function ScrollToTopButton() {
  const { pathname, search } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const syncVisibility = () => {
      const next = readScrollState().visible;
      setVisible((prev) => (prev === next ? prev : next));
    };

    const handleCaptureScroll = (event) => {
      if (isPageScrollTarget(event.target)) {
        syncVisibility();
      }
    };

    const raf = window.requestAnimationFrame(syncVisibility);
    window.addEventListener('scroll', syncVisibility, { passive: true });
    window.addEventListener('resize', syncVisibility, { passive: true });
    document.addEventListener('scroll', handleCaptureScroll, { capture: true, passive: true });

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', syncVisibility);
      window.removeEventListener('resize', syncVisibility);
      document.removeEventListener('scroll', handleCaptureScroll, true);
    };
  }, [pathname, search]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="scroll-top-btn"
      onClick={() => scrollPageToTop()}
      aria-label="Cuộn lên đầu trang"
      title="Cuộn lên đầu trang"
    >
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path
          d="M4 9L12 3.5L20 9"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.95"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 14L12 8.5L20 14"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 19L12 13.5L20 19"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
