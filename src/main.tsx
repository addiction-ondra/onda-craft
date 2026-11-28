import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Zabránit zoomu gesty a dvojitým ťuknutím v Safari (iOS ignoruje user-scalable=no).
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker pro offline hraní (jen v produkčním buildu).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) =>
    registerSW({
      immediate: true,
      // Aplikace na ploše iPadu se často jen „probudí“ – při každém návratu se podíváme,
      // jestli není nová verze (stáhne se sama a stránka se obnoví).
      onRegisteredSW(_url, reg) {
        if (!reg) return;
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
        window.setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      },
    }),
  );
}
