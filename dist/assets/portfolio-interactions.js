(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let savedMotion = null;
  try { savedMotion = localStorage.getItem('portfolio-motion'); } catch {}
  let motionEnabled = !reducedMotion.matches && savedMotion !== 'off';
  let revealObserver;
  const footer = document.querySelector('.closing');
  const motionButton = document.createElement('button');
  motionButton.type = 'button';
  motionButton.className = 'motion-toggle';
  footer?.append(motionButton);
  const setMotion = () => {
    root.dataset.motion = motionEnabled ? 'on' : 'off';
    motionButton.disabled = reducedMotion.matches;
    motionButton.setAttribute('aria-pressed', String(motionEnabled));
    motionButton.textContent = reducedMotion.matches ? 'Reduced Motion Enabled' : motionEnabled ? 'Pause Animations' : 'Resume Animations';
    if (!motionEnabled) {
      revealObserver?.disconnect();
      document.querySelectorAll('.reveal-pending, .reveal-complete').forEach(element => element.classList.remove('reveal-pending', 'reveal-complete'));
    }
  };
  setMotion();
  motionButton.addEventListener('click', () => {
    motionEnabled = !motionEnabled;
    try { localStorage.setItem('portfolio-motion', motionEnabled ? 'on' : 'off'); } catch {}
    setMotion();
  });
  reducedMotion.addEventListener('change', () => {
    let preference = null;
    try { preference = localStorage.getItem('portfolio-motion'); } catch {}
    motionEnabled = !reducedMotion.matches && preference !== 'off';
    setMotion();
  });

  // Real content remains visible without JavaScript and when motion is disabled.
  if (motionEnabled && 'IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('reveal-pending');
        entry.target.classList.add('reveal-complete');
        revealObserver.unobserve(entry.target);
      });
    }, {threshold: .05});
    document.querySelectorAll('.section-title, .about-copy, .experience-group, .project-collection, .collection-card, .feature-card, .pg-panel, .damod-focus').forEach(element => {
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.classList.add('reveal-pending');
        revealObserver.observe(element);
      }
    });
    document.addEventListener('focusin', event => {
      const pending = event.target.closest('.reveal-pending');
      if (pending) { pending.classList.remove('reveal-pending'); revealObserver.unobserve(pending); }
    });
  }

  const experience = document.querySelector('[data-experience]');
  if (experience) {
    const groups = [...experience.querySelectorAll('[data-experience-category]')];
    const buttons = [...experience.querySelectorAll('[data-experience-filter]')];
    const status = experience.querySelector('[data-experience-count]');
    buttons.forEach(button => button.addEventListener('click', () => {
      const filter = button.dataset.experienceFilter;
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      let count = 0, organizationCount = 0;
      groups.forEach(group => {
        group.hidden = filter !== 'all' && group.dataset.experienceCategory !== filter;
        if (!group.hidden) {
          group.classList.remove('reveal-pending');
          revealObserver?.unobserve(group);
          count += group.querySelectorAll('[data-experience-role]').length;
          organizationCount++;
        }
      });
      status.textContent = `${count} ${count === 1 ? 'role' : 'roles'} across ${organizationCount} ${organizationCount === 1 ? 'organization' : 'organizations'}.`;
    }));
    experience.querySelector('[data-experience-controls]').hidden = false;
  }

  const header = document.querySelector('header');
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);
  const links = [...document.querySelectorAll('.navlinks a[href^="#"]')].map(link => ({link, section: document.getElementById(link.hash.slice(1))})).filter(item => item.section);
  let frame = 0;
  const updateScrollState = () => {
    frame = 0;
    const maxScroll = root.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0})`;
    const offset = (header?.getBoundingClientRect().height || 0) + 35;
    let current = null;
    links.forEach(item => { if (item.section.getBoundingClientRect().top <= offset) current = item; });
    links.forEach(item => item === current ? item.link.setAttribute('aria-current', 'location') : item.link.removeAttribute('aria-current'));
  };
  const requestScrollUpdate = () => { if (!frame) frame = requestAnimationFrame(updateScrollState); };
  window.addEventListener('scroll', requestScrollUpdate, {passive:true});
  window.addEventListener('resize', requestScrollUpdate, {passive:true});
  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(() => {
      root.style.setProperty('--header-offset', `${Math.ceil(header?.getBoundingClientRect().height || 100) + 24}px`);
      requestScrollUpdate();
    });
    resizeObserver.observe(document.body);
    if (header) resizeObserver.observe(header);
  }
  updateScrollState();
})();
