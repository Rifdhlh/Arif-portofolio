(() => {
  'use strict';
  if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;

  document.querySelectorAll('[data-project-gallery]').forEach((gallery, galleryIndex) => {
    const sources = [...gallery.querySelectorAll('[data-pg-image]')];
    if (!sources.length) return;
    const items = sources.map((link) => ({
      src: link.href,
      title: link.dataset.pgTitle || 'Project Image',
      caption: link.dataset.pgCaption || '',
      alt: link.dataset.pgAlt || link.dataset.pgTitle || 'Project documentation'
    }));
    const unique = `project-gallery-${galleryIndex + 1}`;
    const dialog = document.createElement('dialog');
    dialog.className = 'pg-dialog';
    dialog.setAttribute('aria-labelledby', `${unique}-title`);
    dialog.setAttribute('aria-describedby', `${unique}-caption ${unique}-help`);
    dialog.innerHTML = `
      <div class="pg-dialog-header"><h2 class="pg-dialog-title" id="${unique}-title"></h2><button class="pg-control pg-close" type="button" aria-label="Close gallery">Close ×</button></div>
      <div class="pg-controls">
        <div class="pg-navigation" role="group" aria-label="Gallery navigation"><button class="pg-control" type="button" data-pg-previous aria-label="Previous image">← Previous</button><span class="pg-counter" role="status" aria-live="polite"></span><button class="pg-control" type="button" data-pg-next aria-label="Next image">Next →</button></div>
        <div class="pg-zoom-controls" role="group" aria-label="Image zoom"><button class="pg-control" type="button" data-pg-zoom-out aria-label="Zoom out">−</button><output class="pg-zoom-value" aria-live="polite" aria-label="Zoom relative to fitted image">100%</output><button class="pg-control" type="button" data-pg-zoom-in aria-label="Zoom in">+</button><button class="pg-control" type="button" data-pg-reset>Reset Zoom</button></div>
      </div>
      <p class="pg-load-status" role="status" hidden></p>
      <div class="pg-viewport" tabindex="0" aria-label="Image viewport. Scroll to inspect an enlarged image."><div class="pg-stage"><img class="pg-image" alt="" draggable="false"></div></div>
      <div class="pg-dialog-footer"><p class="pg-caption" id="${unique}-caption"></p><div class="pg-footer-actions"><p class="pg-help" id="${unique}-help">Use the arrow keys to change images at 100% zoom. Enlarge an image, then scroll or drag to inspect it. Press Escape to close.</p><a class="pg-control pg-original" target="_blank" rel="noopener">Open Original Image ↗</a></div></div>`;
    document.body.append(dialog);

    const get = (selector) => dialog.querySelector(selector);
    const title = get('.pg-dialog-title');
    const caption = get('.pg-caption');
    const image = get('.pg-image');
    const stage = get('.pg-stage');
    const viewport = get('.pg-viewport');
    const previous = get('[data-pg-previous]');
    const next = get('[data-pg-next]');
    const zoomIn = get('[data-pg-zoom-in]');
    const zoomOut = get('[data-pg-zoom-out]');
    const reset = get('[data-pg-reset]');
    const status = get('.pg-load-status');
    const zoomValue = get('.pg-zoom-value');
    const original = get('.pg-original');
    let current = 0;
    let zoom = 1;
    let opener = null;
    let previousOverflow = '';
    let drag = null;
    let fittedWidth = 0;
    let fittedHeight = 0;

    function sizeImage(preserveCenter = false) {
      if (!dialog.open || !image.complete || !image.naturalWidth) return;
      const viewWidth = viewport.clientWidth;
      const viewHeight = viewport.clientHeight;
      const oldWidth = stage.offsetWidth;
      const oldHeight = stage.offsetHeight;
      const centerX = oldWidth ? (viewport.scrollLeft + viewWidth / 2) / oldWidth : .5;
      const centerY = oldHeight ? (viewport.scrollTop + viewHeight / 2) / oldHeight : .5;
      const fit = Math.min((viewWidth - 32) / image.naturalWidth, (viewHeight - 32) / image.naturalHeight, 1);
      fittedWidth = Math.max(1, image.naturalWidth * fit);
      fittedHeight = Math.max(1, image.naturalHeight * fit);
      const width = fittedWidth * zoom;
      const height = fittedHeight * zoom;
      const stageWidth = Math.max(viewWidth, width + 32);
      const stageHeight = Math.max(viewHeight, height + 32);
      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      stage.style.width = `${stageWidth}px`;
      stage.style.height = `${stageHeight}px`;
      viewport.classList.toggle('pg-can-pan', zoom > 1);
      viewport.scrollLeft = preserveCenter ? centerX * stageWidth - viewWidth / 2 : (stageWidth - viewWidth) / 2;
      viewport.scrollTop = preserveCenter ? centerY * stageHeight - viewHeight / 2 : (stageHeight - viewHeight) / 2;
    }

    function updateZoom(value) {
      zoom = Math.max(1, Math.min(4, value));
      zoomValue.value = `${Math.round(zoom * 100)}%`;
      zoomOut.disabled = zoom <= 1;
      zoomIn.disabled = zoom >= 4;
      reset.disabled = zoom === 1;
      sizeImage(zoom !== 1);
    }

    function showImage(index) {
      current = Math.max(0, Math.min(items.length - 1, index));
      const item = items[current];
      title.textContent = item.title;
      caption.textContent = item.caption;
      image.alt = item.alt;
      original.href = item.src;
      get('.pg-counter').textContent = `${current + 1} of ${items.length}`;
      previous.disabled = current === 0;
      next.disabled = current === items.length - 1;
      status.hidden = false;
      status.textContent = 'Loading image…';
      viewport.setAttribute('aria-busy', 'true');
      image.style.visibility = 'hidden';
      image.style.width = '1px';
      image.style.height = '1px';
      stage.style.width = '100%';
      stage.style.height = '100%';
      zoom = 1;
      zoomValue.value = '100%';
      zoomOut.disabled = true;
      reset.disabled = true;
      zoomIn.disabled = false;
      viewport.classList.remove('pg-can-pan');
      image.src = item.src;
    }

    image.addEventListener('load', () => {
      status.hidden = true;
      viewport.setAttribute('aria-busy', 'false');
      image.style.visibility = 'visible';
      sizeImage();
    });
    image.addEventListener('error', () => {
      status.hidden = false;
      status.textContent = 'This image could not be loaded. Select Open Original Image to view the source file.';
      viewport.setAttribute('aria-busy', 'false');
      zoomIn.disabled = true;
      zoomOut.disabled = true;
      reset.disabled = true;
    });
    sources.forEach((link, index) => {
      link.addEventListener('click', (event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        opener = link;
        previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        dialog.showModal();
        showImage(index);
        get('.pg-close').focus();
      });
    });
    get('.pg-close').addEventListener('click', () => dialog.close());
    previous.addEventListener('click', () => showImage(current - 1));
    next.addEventListener('click', () => showImage(current + 1));
    zoomIn.addEventListener('click', () => updateZoom(zoom + .25));
    zoomOut.addEventListener('click', () => updateZoom(zoom - .25));
    reset.addEventListener('click', () => updateZoom(1));
    dialog.addEventListener('close', () => {
      document.documentElement.style.overflow = previousOverflow;
      drag = null;
      viewport.classList.remove('pg-is-panning');
      opener?.focus({ preventScroll: true });
    });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('keydown', (event) => {
      if (zoom !== 1 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft' && current > 0) { event.preventDefault(); showImage(current - 1); }
      if (event.key === 'ArrowRight' && current < items.length - 1) { event.preventDefault(); showImage(current + 1); }
    });
    viewport.addEventListener('pointerdown', (event) => {
      if (zoom <= 1 || event.button !== 0 || event.pointerType === 'touch') return;
      drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('pg-is-panning');
      viewport.focus({ preventScroll: true });
      event.preventDefault();
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
    });
    const stopDragging = () => { drag = null; viewport.classList.remove('pg-is-panning'); };
    viewport.addEventListener('pointerup', stopDragging);
    viewport.addEventListener('pointercancel', stopDragging);
    viewport.addEventListener('lostpointercapture', stopDragging);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => sizeImage(true)).observe(viewport);
    else window.addEventListener('resize', () => sizeImage(true));
  });
})();
