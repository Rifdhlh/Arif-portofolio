(() => {
  'use strict';

  document.documentElement.dataset.courseNavigation = 'CSSViewTransitionRule' in window ? 'native' : 'fallback';

  // Let the browser retain scroll positions, including restored BFCache pages.
  try {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'auto';
  } catch {}

  document.querySelectorAll('.course-back-button').forEach(link => {
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    });
  });
})();
