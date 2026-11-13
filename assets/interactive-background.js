/* Decorative, section-local motion. Reading and navigation never depend on it. */
(() => {
  'use strict';

  const body = document.body;
  if (!body?.classList.contains('portfolio-home') || body.dataset.ambientReady) return;
  body.dataset.ambientReady = 'true';

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const compact = window.matchMedia('(max-width: 700px)');
  const surfaces = [];
  const removals = [];
  const glowTargets = [];
  const FRAME_INTERVAL = 1000 / 30;
  const MAX_PIXELS = 2_400_000;
  const MAX_SIDE = 4096;
  let frame = 0;
  let glowFrame = 0;
  let pendingGlow = null;
  let lastPaint = 0;
  let clock = 0;
  let suspended = false;
  let destroyed = false;
  let nearObserver;
  let resizeObserver;

  function listen(target, name, handler, options) {
    target.addEventListener(name, handler, options);
    removals.push(() => target.removeEventListener(name, handler, options));
  }

  function enabled() {
    return !destroyed && !suspended && !document.hidden && !reducedMotion.matches && root.dataset.motion !== 'off';
  }

  function visible(element) {
    const bounds = element.getBoundingClientRect();
    return bounds.bottom > -80 && bounds.top < window.innerHeight + 80;
  }

  function createNodes(surface) {
    const mobile = compact.matches || !finePointer.matches;
    const count = Math.min(mobile ? 24 : 72, Math.max(mobile ? 12 : 30, Math.round(surface.width * surface.height / (mobile ? 36000 : 26000))));
    const clusters = Math.ceil(count / 5);
    const columns = Math.max(1, Math.round(Math.sqrt(clusters * surface.width / Math.max(1, surface.height))));
    const rows = Math.ceil(clusters / columns);
    surface.nodes = Array.from({length: count}, (_, index) => {
      const cluster = Math.floor(index / 5);
      return {
        x: Math.min(.98, Math.max(.02, ((cluster % columns) + .5) / columns + (Math.random() - .5) * Math.min(.18, 150 / surface.width))),
        y: Math.min(.98, Math.max(.02, (Math.floor(cluster / columns) + .5) / rows + (Math.random() - .5) * Math.min(.2, 150 / surface.height))),
        phase: Math.random() * Math.PI * 2,
        clusterPhase: cluster * 1.7,
        offsetX: 0,
        offsetY: 0,
        radius: .8 + Math.random() * .7
      };
    });
  }

  function resize(surface) {
    const width = Math.max(1, Math.round(surface.element.clientWidth));
    const height = Math.max(1, Math.round(surface.element.clientHeight));
    const mobile = compact.matches || !finePointer.matches;
    if (width === surface.width && height === surface.height && mobile === surface.mobile) return;
    surface.width = width;
    surface.height = height;
    surface.mobile = mobile;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(MAX_PIXELS / (width * height)), MAX_SIDE / Math.max(width, height));
    surface.canvas.width = Math.max(1, Math.floor(width * ratio));
    surface.canvas.height = Math.max(1, Math.floor(height * ratio));
    surface.ratio = ratio;
    createNodes(surface);
    paint(surface, 0, false);
  }

  function paint(surface, delta, moving) {
    const context = surface.context;
    const width = surface.width;
    const height = surface.height;
    context.setTransform(surface.ratio, 0, 0, surface.ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const glow = context.createRadialGradient(width * .82, height * .3, 0, width * .82, height * .3, Math.min(620, Math.max(width, height) * .6));
    glow.addColorStop(0, 'rgba(127,165,67,.09)');
    glow.addColorStop(1, 'rgba(127,165,67,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    const pointer = surface.pointer;
    const points = surface.nodes.map(node => {
      let targetX = 0;
      let targetY = 0;
      const x = node.x * width + Math.sin(clock * .16 + node.phase) * 13 + Math.sin(clock * .05 + node.clusterPhase) * 16;
      const y = node.y * height + Math.cos(clock * .14 + node.phase) * 13 + Math.sin(clock * .04 + node.clusterPhase) * 13 + surface.scrollShift;
      if (moving && pointer.active) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance > .1 && distance < 170) {
          const strength = (1 - distance / 170) * 26;
          targetX = dx / distance * strength;
          targetY = dy / distance * strength;
        }
      }
      const easing = moving ? Math.min(1, delta * 6) : 1;
      node.offsetX += (targetX - node.offsetX) * easing;
      node.offsetY += (targetY - node.offsetY) * easing;
      return {x: x + node.offsetX, y: y + node.offsetY, radius: node.radius};
    });

    const reach = surface.mobile ? 112 : 155;
    context.lineWidth = .75;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      for (let j = i + 1; j < points.length; j += 1) {
        const b = points[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance >= reach) continue;
        context.strokeStyle = `rgba(193,225,125,${.23 * (1 - distance / reach)})`;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
      context.fillStyle = 'rgba(213,246,107,.65)';
      context.beginPath();
      context.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      context.fill();
      if (moving && pointer.active) {
        const distance = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        if (distance < 160) {
          context.strokeStyle = `rgba(213,246,107,${.25 * (1 - distance / 160)})`;
          context.beginPath();
          context.moveTo(pointer.x, pointer.y);
          context.lineTo(a.x, a.y);
          context.stroke();
        }
      }
    }

    if (moving) {
      surface.ripples = surface.ripples.filter(ripple => clock - ripple.started < .9);
      surface.ripples.forEach(ripple => {
        const age = (clock - ripple.started) / .9;
        context.strokeStyle = `rgba(213,246,107,${.22 * (1 - age)})`;
        context.lineWidth = 1;
        context.beginPath();
        context.arc(ripple.x, ripple.y, 12 + age * 115, 0, Math.PI * 2);
        context.stroke();
      });
    }
  }

  function tick(now) {
    frame = 0;
    if (!enabled() || !surfaces.some(surface => surface.visible)) { lastPaint = 0; return; }
    if (!lastPaint || now - lastPaint >= FRAME_INTERVAL - .5) {
      const delta = lastPaint ? Math.min(.07, (now - lastPaint) / 1000) : 0;
      lastPaint = now;
      clock += delta;
      surfaces.forEach(surface => { if (surface.visible) paint(surface, delta, true); });
    }
    frame = requestAnimationFrame(tick);
  }

  function schedule() {
    if (!frame && enabled() && surfaces.some(surface => surface.visible)) frame = requestAnimationFrame(tick);
  }

  function clearGlow() {
    if (glowFrame) cancelAnimationFrame(glowFrame);
    glowFrame = 0;
    pendingGlow = null;
    glowTargets.forEach(target => { delete target.dataset.glowActive; });
  }

  function syncMotion() {
    if (!enabled()) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastPaint = 0;
      clearGlow();
      surfaces.forEach(surface => {
        surface.pointer.active = false;
        surface.ripples = [];
        if (!document.hidden && surface.visible) paint(surface, 0, false);
      });
      return;
    }
    schedule();
  }

  document.querySelectorAll('.hero-highlight, .current-project, #contact').forEach((element, index) => {
    const canvas = document.createElement('canvas');
    let context;
    try { context = canvas.getContext('2d', {alpha: true}); } catch { return; }
    if (!context) return;
    canvas.className = 'ambient-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    element.classList.add('ambient-surface');
    element.append(canvas);
    const surface = {element, canvas, context, index, width: 0, height: 0, ratio: 1, nodes: [], ripples: [], pointer: {active: false, x: 0, y: 0}, scrollShift: 0, visible: visible(element)};
    surfaces.push(surface);
    resize(surface);
    listen(element, 'pointermove', event => {
      if (!enabled() || !finePointer.matches || event.pointerType === 'touch') return;
      const bounds = element.getBoundingClientRect();
      surface.pointer = {active: true, x: event.clientX - bounds.left, y: event.clientY - bounds.top};
      schedule();
    }, {passive: true});
    listen(element, 'pointerleave', () => { surface.pointer.active = false; }, {passive: true});
    listen(element, 'pointerdown', event => {
      if (!enabled() || !finePointer.matches || event.pointerType === 'touch' || event.button !== 0) return;
      const bounds = element.getBoundingClientRect();
      surface.ripples.push({x: event.clientX - bounds.left, y: event.clientY - bounds.top, started: clock});
      surface.ripples = surface.ripples.slice(-2);
      schedule();
    }, {passive: true});
  });

  if ('IntersectionObserver' in window) {
    nearObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const surface = surfaces.find(item => item.element === entry.target);
        if (surface) surface.visible = entry.isIntersecting;
      });
      if (!surfaces.some(surface => surface.visible) && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastPaint = 0;
      }
      schedule();
    }, {rootMargin: '80px 0px', threshold: 0});
    surfaces.forEach(surface => nearObserver.observe(surface.element));
  }

  function onResize() {
    surfaces.forEach(resize);
    syncMotion();
  }

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(entries => {
      entries.forEach(entry => {
        const surface = surfaces.find(item => item.element === entry.target);
        if (surface) resize(surface);
      });
      schedule();
    });
    surfaces.forEach(surface => resizeObserver.observe(surface.element));
  } else listen(window, 'resize', onResize, {passive: true});

  listen(window, 'scroll', () => {
    surfaces.forEach(surface => {
      if (!nearObserver) surface.visible = visible(surface.element);
      surface.scrollShift = Math.sin(window.scrollY * .0018 + surface.index) * 12;
    });
    schedule();
  }, {passive: true});

  document.querySelectorAll('.course-project, .experience-design, .current-project-design').forEach(target => {
    target.classList.add('interactive-glow');
    glowTargets.push(target);
    listen(target, 'pointermove', event => {
      if (!enabled() || !finePointer.matches || event.pointerType === 'touch') return;
      pendingGlow = {target, x: event.clientX, y: event.clientY};
      target.dataset.glowActive = 'true';
      if (glowFrame) return;
      glowFrame = requestAnimationFrame(() => {
        glowFrame = 0;
        if (!pendingGlow || !enabled()) return;
        const {target: current, x, y} = pendingGlow;
        const bounds = current.getBoundingClientRect();
        current.style.setProperty('--glow-x', `${x - bounds.left}px`);
        current.style.setProperty('--glow-y', `${y - bounds.top}px`);
      });
    }, {passive: true});
    listen(target, 'pointerleave', () => {
      delete target.dataset.glowActive;
      if (pendingGlow?.target === target) pendingGlow = null;
    }, {passive: true});
  });

  const motionObserver = new MutationObserver(syncMotion);
  motionObserver.observe(root, {attributes: true, attributeFilter: ['data-motion']});
  listen(reducedMotion, 'change', syncMotion);
  listen(finePointer, 'change', () => { clearGlow(); onResize(); });
  listen(compact, 'change', onResize);
  listen(document, 'visibilitychange', syncMotion);
  listen(window, 'pageshow', event => {
    if (!event.persisted) return;
    suspended = false;
    surfaces.forEach(surface => { surface.visible = visible(surface.element); });
    onResize();
  });
  listen(window, 'pagehide', event => {
    suspended = true;
    syncMotion();
    if (event.persisted) return;
    destroyed = true;
    nearObserver?.disconnect();
    resizeObserver?.disconnect();
    motionObserver.disconnect();
    removals.forEach(remove => remove());
    surfaces.forEach(surface => { surface.canvas.width = 0; surface.canvas.height = 0; });
  });

  syncMotion();
})();
