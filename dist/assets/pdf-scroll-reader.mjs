import { getDocument, GlobalWorkerOptions } from './vendor/pdfjs/pdf.min.mjs';

GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const MAX_CANVAS_PIXELS = 5_000_000;
const MAX_CANVAS_SIDE = 8192;
const MAX_RENDER_TASKS = 2;
let readerSequence = 0;

document.querySelectorAll('[data-pdf-scroll-reader]').forEach(reader => {
  initialiseReader(reader).catch(() => {
    const status = reader.querySelector('[data-pdf-scroll-status]');
    if (status) status.textContent = 'The inline PDF reader is unavailable. Please use the PDF open or download link.';
    reader.querySelector('[data-pdf-scroll-viewport]')?.setAttribute('aria-busy', 'false');
  });
});

async function initialiseReader(reader) {
  const viewport = reader.querySelector('[data-pdf-scroll-viewport]');
  const pages = reader.querySelector('[data-pdf-scroll-pages]');
  const status = reader.querySelector('[data-pdf-scroll-status]');
  const numberInput = reader.querySelector('[data-pdf-scroll-number]');
  const count = reader.querySelector('[data-pdf-scroll-count]');
  const previous = reader.querySelector('[data-pdf-scroll-previous]');
  const next = reader.querySelector('[data-pdf-scroll-next]');
  const zoom = reader.querySelector('[data-pdf-scroll-zoom]');
  const source = reader.dataset.pdfScrollReader || reader.dataset.pdfUrl;
  if (!viewport || !pages || !status || !source || !viewport.contains(pages)) {
    if (status) status.textContent = 'The inline PDF reader could not be initialised. Please open or download the PDF.';
    return;
  }

  const prefix = `pdf-scroll-${++readerSequence}`;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const states = [];
  const queue = new Map();
  let documentPDF;
  let loadingTask;
  let generation = 0;
  let activeTasks = 0;
  let currentPage = 1;
  let nearObserver;
  let resizeObserver;
  let scrollFrame = 0;
  let resizeTimer = 0;
  let navigationTimer = 0;
  let navigationTarget = null;
  let destroyed = false;
  let lastWidth = 0;

  viewport.setAttribute('aria-busy', 'true');
  if (!viewport.hasAttribute('tabindex')) viewport.tabIndex = 0;
  if (!viewport.hasAttribute('role')) viewport.setAttribute('role', 'region');
  if (!viewport.hasAttribute('aria-label')) viewport.setAttribute('aria-label', 'Scrollable PDF pages');
  [numberInput, previous, next, zoom].forEach(control => { if (control) control.disabled = true; });
  status.textContent = 'Loading the PDF…';

  function zoomFactor() {
    const value = Number(zoom?.value || 1);
    return Number.isFinite(value) && value > 0 ? Math.min(3, Math.max(1, value)) : 1;
  }

  function availableWidth() {
    const style = getComputedStyle(viewport);
    return Math.max(120, viewport.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
  }

  function contentTop(element) {
    return element.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientTop + viewport.scrollTop;
  }

  function capturePosition() {
    if (!states.length) return null;
    const top = viewport.getBoundingClientRect().top + viewport.clientTop;
    const state = states.find(item => item.card.getBoundingClientRect().bottom > top + 1) || states[states.length - 1];
    const box = state.card.getBoundingClientRect();
    return {
      state,
      fraction: (top - box.top) / Math.max(1, box.height),
      horizontal: viewport.scrollLeft / Math.max(1, viewport.scrollWidth - viewport.clientWidth)
    };
  }

  function restorePosition(anchor) {
    if (!anchor || destroyed) return;
    viewport.scrollTop = contentTop(anchor.state.card) + anchor.fraction * anchor.state.card.getBoundingClientRect().height;
    viewport.scrollLeft = anchor.horizontal * Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  }

  function setGeometry(state) {
    const width = availableWidth() * zoomFactor();
    const height = width * state.base.height / state.base.width;
    state.width = width;
    state.height = height;
    state.card.style.width = `${width}px`;
    state.paper.style.width = `${width}px`;
    state.paper.style.height = `${height}px`;
    if (state.canvas) {
      state.canvas.style.width = `${width}px`;
      state.canvas.style.height = `${height}px`;
    }
  }

  function updateControls() {
    if (numberInput) {
      numberInput.disabled = !documentPDF;
      if (document.activeElement !== numberInput) numberInput.value = String(currentPage);
    }
    if (previous) previous.disabled = !documentPDF || currentPage <= 1;
    if (next) next.disabled = !documentPDF || currentPage >= documentPDF.numPages;
  }

  function updateStatus() {
    if (!documentPDF || destroyed) return;
    const state = states[currentPage - 1];
    status.textContent = state?.error
      ? `Page ${currentPage} could not be displayed. Please use the PDF open or download link.`
      : `Page ${currentPage} of ${documentPDF.numPages} · Scroll to continue reading`;
  }

  function clearNavigationTarget() {
    navigationTarget = null;
    clearTimeout(navigationTimer);
  }

  function visiblePage() {
    if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2) return states[states.length - 1];
    const top = viewport.getBoundingClientRect().top + viewport.clientTop;
    const reference = top + Math.min(70, viewport.clientHeight * .2);
    return states.find(state => {
      const box = state.card.getBoundingClientRect();
      return box.top <= reference && box.bottom > reference;
    }) || states.find(state => state.card.getBoundingClientRect().bottom > reference) || states[states.length - 1];
  }

  function updateFromScroll() {
    scrollFrame = 0;
    if (!documentPDF || destroyed) return;
    if (navigationTarget && Math.abs(contentTop(states[navigationTarget - 1].card) - viewport.scrollTop) < 3) clearNavigationTarget();
    const visible = visiblePage();
    const selected = navigationTarget || visible?.number || 1;
    if (selected !== currentPage) {
      currentPage = selected;
      updateControls();
      updateStatus();
    }
    if (!nearObserver) {
      const first = Math.max(0, (visible?.number || 1) - 2);
      const last = Math.min(states.length, first + 5);
      states.forEach((state, index) => { state.near = index >= first && index < last; });
      states.filter(state => state.near).forEach(state => enqueue(state));
    }
    releaseDistantPages();
  }

  function requestScrollUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateFromScroll);
  }

  function releaseCanvas(state) {
    if (!state.canvas || state.renderToken) return;
    state.canvas.width = 0;
    state.canvas.height = 0;
    state.canvas.remove();
    state.canvas = null;
    state.renderedGeneration = -1;
    state.placeholder.hidden = false;
    state.placeholder.textContent = `Page ${state.number} loads as you approach it.`;
    if (state.proxy && !state.textPromise) {
      try { state.proxy.cleanup(); } catch {}
    }
  }

  function releaseDistantPages() {
    const visible = visiblePage()?.number || currentPage;
    states.forEach(state => {
      if (!state.near && Math.abs(state.number - visible) > 3 && !state.textDetails.open && !state.card.contains(document.activeElement)) releaseCanvas(state);
    });
  }

  async function ensureText(state) {
    if (state.textLoaded || destroyed) return;
    if (state.textPromise) return state.textPromise;
    state.text.textContent = 'Loading this page’s text…';
    state.textPromise = (async () => {
      try {
        const page = state.proxy || await documentPDF.getPage(state.number);
        if (destroyed) return;
        state.proxy = page;
        const textContent = await page.getTextContent();
        if (destroyed) return;
        const text = textContent.items.map(item => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`).join('').trim();
        state.text.textContent = text || 'This page does not contain extractable text. Please use the full PDF to view its visual content.';
        state.textLoaded = true;
      } catch {
        if (!destroyed) state.text.textContent = 'The text version of this page is unavailable. Please use the full PDF.';
      } finally {
        state.textPromise = null;
      }
    })();
    return state.textPromise;
  }

  function enqueue(state, priority = false) {
    if (!state || destroyed || state.renderedGeneration === generation) return;
    const existing = queue.get(state.number);
    queue.set(state.number, {state, generation, priority: priority || Boolean(existing?.priority)});
    pumpQueue();
  }

  function pumpQueue() {
    if (destroyed || !documentPDF) return;
    const candidates = [...queue.values()].filter(ticket => {
      if (ticket.generation !== generation || ticket.state.renderedGeneration === generation || (!ticket.state.near && !ticket.priority)) {
        queue.delete(ticket.state.number);
        return false;
      }
      return !ticket.state.renderToken;
    }).sort((a, b) => Number(b.priority) - Number(a.priority) || Math.abs(a.state.number - currentPage) - Math.abs(b.state.number - currentPage));
    while (activeTasks < MAX_RENDER_TASKS && candidates.length) {
      const ticket = candidates.shift();
      queue.delete(ticket.state.number);
      renderPage(ticket.state, ticket.generation);
    }
  }

  async function renderPage(state, requestGeneration) {
    const token = Symbol('pdf-render');
    state.renderToken = token;
    activeTasks += 1;
    let canvas;
    let task;
    let attached = false;
    try {
      state.paper.setAttribute('aria-busy', 'true');
      if (!state.canvas) state.placeholder.textContent = `Loading page ${state.number}…`;
      const page = state.proxy || await documentPDF.getPage(state.number);
      if (destroyed || requestGeneration !== generation) return;
      state.proxy = page;
      const original = page.getViewport({scale: 1});
      if (original.width !== state.base.width || original.height !== state.base.height) {
        const anchor = capturePosition();
        state.base = {width: original.width, height: original.height};
        setGeometry(state);
        restorePosition(anchor);
      }
      const renderViewport = page.getViewport({scale: state.width / original.width});
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, renderViewport.width * renderViewport.height)),
        MAX_CANVAS_SIDE / Math.max(renderViewport.width, renderViewport.height)
      );
      canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(renderViewport.width * ratio));
      canvas.height = Math.max(1, Math.floor(renderViewport.height * ratio));
      canvas.style.width = `${state.width}px`;
      canvas.style.height = `${state.height}px`;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `PDF page ${state.number} of ${documentPDF.numPages}. An accessible text disclosure follows this page.`);
      const context = canvas.getContext('2d', {alpha: false});
      if (!context) throw new Error('Canvas rendering is unavailable.');
      task = page.render({canvasContext: context, viewport: renderViewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0], background: '#ffffff'});
      state.task = task;
      await task.promise;
      if (destroyed || requestGeneration !== generation || state.renderToken !== token) return;
      if (state.canvas) {
        state.canvas.width = 0;
        state.canvas.height = 0;
        state.canvas.remove();
      }
      state.paper.append(canvas);
      state.canvas = canvas;
      attached = true;
      state.placeholder.hidden = true;
      state.renderedGeneration = requestGeneration;
      state.error = false;
      if (state.number === currentPage) updateStatus();
      if (state.textDetails.open) ensureText(state);
    } catch (error) {
      if (destroyed || requestGeneration !== generation || error?.name === 'RenderingCancelledException') return;
      state.error = true;
      if (!state.canvas) {
        state.placeholder.hidden = false;
        state.placeholder.textContent = `Page ${state.number} could not be displayed. Please use the PDF open or download link.`;
      }
      if (state.number === currentPage) updateStatus();
    } finally {
      if (canvas && !attached) { canvas.width = 0; canvas.height = 0; }
      if (state.task === task) state.task = null;
      if (state.renderToken === token) {
        state.renderToken = null;
        state.paper.setAttribute('aria-busy', 'false');
      }
      activeTasks -= 1;
      pumpQueue();
    }
  }

  function connectNearObserver() {
    nearObserver?.disconnect();
    if (!('IntersectionObserver' in window)) {
      nearObserver = null;
      updateFromScroll();
      return;
    }
    const margin = Math.max(160, Math.round(viewport.clientHeight * .7));
    nearObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const state = states[Number(entry.target.dataset.pdfScrollPage) - 1];
        state.near = entry.isIntersecting;
        if (state.near) enqueue(state);
      });
      releaseDistantPages();
    }, {root: viewport, rootMargin: `${margin}px 0px`, threshold: 0});
    states.forEach(state => nearObserver.observe(state.card));
  }

  function relayout() {
    resizeTimer = 0;
    if (!documentPDF || destroyed) return;
    const anchor = capturePosition();
    clearNavigationTarget();
    generation += 1;
    queue.clear();
    states.forEach(state => {
      state.task?.cancel();
      setGeometry(state);
    });
    restorePosition(anchor);
    currentPage = visiblePage()?.number || currentPage;
    connectNearObserver();
    states.filter(state => state.near).forEach(state => enqueue(state));
    enqueue(states[currentPage - 1], true);
    updateControls();
    updateStatus();
  }

  function goToPage(value) {
    if (!documentPDF || destroyed) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) { updateControls(); return; }
    const target = Math.min(documentPDF.numPages, Math.max(1, Math.round(parsed)));
    currentPage = target;
    navigationTarget = target;
    updateControls();
    if (numberInput) numberInput.value = String(target);
    updateStatus();
    enqueue(states[target - 1], true);
    viewport.scrollTo({top: contentTop(states[target - 1].card), behavior: motion.matches || document.documentElement.dataset.motion === 'off' ? 'auto' : 'smooth'});
    clearTimeout(navigationTimer);
    navigationTimer = setTimeout(() => { navigationTarget = null; requestScrollUpdate(); }, 1000);
  }

  previous?.addEventListener('click', () => goToPage((navigationTarget || currentPage) - 1));
  next?.addEventListener('click', () => goToPage((navigationTarget || currentPage) + 1));
  numberInput?.addEventListener('change', () => goToPage(numberInput.value));
  numberInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); goToPage(numberInput.value); }
  });
  numberInput?.addEventListener('blur', updateControls);
  zoom?.addEventListener('change', relayout);
  viewport.addEventListener('scroll', requestScrollUpdate, {passive: true});
  ['wheel', 'touchstart', 'pointerdown'].forEach(type => viewport.addEventListener(type, clearNavigationTarget, {passive: true}));
  viewport.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) clearNavigationTarget();
  });

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    queue.clear();
    clearTimeout(resizeTimer);
    clearTimeout(navigationTimer);
    cancelAnimationFrame(scrollFrame);
    nearObserver?.disconnect();
    resizeObserver?.disconnect();
    states.forEach(state => {
      state.task?.cancel();
      if (state.canvas) { state.canvas.width = 0; state.canvas.height = 0; }
    });
    loadingTask?.destroy()?.catch?.(() => {});
  }

  window.addEventListener('pagehide', event => { if (!event.persisted) destroy(); });
  window.addEventListener('pageshow', event => { if (event.persisted && documentPDF && !destroyed) relayout(); });

  try {
    loadingTask = getDocument({url: source, isEvalSupported: false, useWasm: false});
    documentPDF = await loadingTask.promise;
    if (destroyed) return;
    const firstPage = await documentPDF.getPage(1);
    if (destroyed) return;
    const firstSize = firstPage.getViewport({scale: 1});
    const fragment = document.createDocumentFragment();
    for (let pageNumber = 1; pageNumber <= documentPDF.numPages; pageNumber += 1) {
      const card = document.createElement('section');
      card.className = 'pdf-scroll-page';
      card.dataset.pdfScrollPage = String(pageNumber);
      const title = document.createElement('h3');
      title.className = 'pdf-scroll-page-title';
      title.id = `${prefix}-page-${pageNumber}`;
      title.textContent = `Page ${pageNumber}`;
      card.setAttribute('aria-labelledby', title.id);
      const paper = document.createElement('div');
      paper.className = 'pdf-scroll-paper';
      const placeholder = document.createElement('p');
      placeholder.className = 'pdf-scroll-placeholder';
      placeholder.textContent = `Page ${pageNumber} loads as you approach it.`;
      paper.append(placeholder);
      const textDetails = document.createElement('details');
      textDetails.className = 'pdf-scroll-page-text';
      const textSummary = document.createElement('summary');
      textSummary.textContent = `Read the text of page ${pageNumber}`;
      const text = document.createElement('pre');
      text.className = 'pdf-scroll-text-content';
      text.tabIndex = 0;
      text.setAttribute('aria-label', `Extracted text of PDF page ${pageNumber}`);
      text.textContent = 'Open this disclosure to load an accessible text version of the page.';
      textDetails.append(textSummary, text);
      card.append(title, paper, textDetails);
      const state = {number: pageNumber, card, paper, placeholder, textDetails, text, base: {width: firstSize.width, height: firstSize.height}, proxy: pageNumber === 1 ? firstPage : null, canvas: null, near: pageNumber === 1, task: null, renderToken: null, renderedGeneration: -1, textPromise: null, textLoaded: false, error: false};
      textDetails.addEventListener('toggle', () => { if (textDetails.open) ensureText(state); });
      states.push(state);
      fragment.append(card);
    }
    pages.replaceChildren(fragment);
    if (count) count.textContent = String(documentPDF.numPages);
    if (numberInput) { numberInput.min = '1'; numberInput.max = String(documentPDF.numPages); numberInput.value = '1'; numberInput.disabled = false; }
    if (zoom) zoom.disabled = false;
    states.forEach(setGeometry);
    lastWidth = Math.round(viewport.clientWidth);
    connectNearObserver();
    updateControls();
    updateStatus();
    enqueue(states[0], true);
    viewport.setAttribute('aria-busy', 'false');
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        const width = Math.round(viewport.clientWidth);
        if (Math.abs(width - lastWidth) < 2) return;
        lastWidth = width;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(relayout, 120);
      });
      resizeObserver.observe(viewport);
    } else {
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(relayout, 120);
      });
    }
  } catch {
    if (!destroyed) {
      documentPDF = null;
      status.textContent = 'The inline PDF reader is unavailable. Please use the PDF open or download link.';
      viewport.setAttribute('aria-busy', 'false');
      [numberInput, previous, next, zoom].forEach(control => { if (control) control.disabled = true; });
    }
  }
}
