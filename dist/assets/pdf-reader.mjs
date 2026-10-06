import { getDocument, GlobalWorkerOptions } from './vendor/pdfjs/pdf.min.mjs';

GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const reader = document.querySelector('[data-pdf-reader]');
const stage = reader.querySelector('.pdf-stage');
const status = reader.querySelector('[data-reader-status]');
const pageInput = reader.querySelector('[data-page-number]');
const pageCount = reader.querySelector('[data-page-count]');
const zoom = reader.querySelector('[data-zoom]');
const previous = reader.querySelector('[data-previous]');
const next = reader.querySelector('[data-next]');
const text = reader.querySelector('[data-page-text]');
let documentPDF, pageNumber = 1, revision = 0;

function updateControls() {
  pageInput.value = pageNumber;
  previous.disabled = !documentPDF || pageNumber <= 1;
  next.disabled = !documentPDF || pageNumber >= documentPDF.numPages;
}

async function renderPage() {
  if (!documentPDF) return;
  const request = ++revision;
  const requestedPage = pageNumber;
  status.textContent = `Loading page ${requestedPage}…`;
  stage.setAttribute('aria-busy', 'true');
  updateControls();
  try {
    const page = await documentPDF.getPage(requestedPage);
    const original = page.getViewport({scale: 1});
    const fittedScale = Math.max(200, stage.clientWidth - 40) / original.width;
    const scale = fittedScale * Number(zoom.value);
    const viewport = page.getViewport({scale});
    const canvas = document.createElement('canvas');
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(viewport.width * ratio);
    canvas.height = Math.ceil(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Presentation page ${requestedPage} of ${documentPDF.numPages}. A text version is available below.`);
    await page.render({canvasContext: canvas.getContext('2d'), viewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0]}).promise;
    const textContent = await page.getTextContent();
    if (request !== revision) return;
    stage.replaceChildren(canvas);
    text.textContent = textContent.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
    status.textContent = `Page ${requestedPage} of ${documentPDF.numPages}`;
    stage.setAttribute('aria-busy', 'false');
  } catch (error) {
    if (request !== revision) return;
    status.textContent = 'This page could not be displayed. Please open or download the full PDF.';
    stage.setAttribute('aria-busy', 'false');
    console.error('PDF page rendering failed:', error);
  }
}

function goToPage(value) {
  if (!documentPDF) return;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {updateControls(); return;}
  pageNumber = Math.min(documentPDF.numPages, Math.max(1, Math.round(parsed)));
  renderPage();
}
previous.addEventListener('click', () => goToPage(pageNumber - 1));
next.addEventListener('click', () => goToPage(pageNumber + 1));
pageInput.addEventListener('change', () => goToPage(pageInput.value));
pageInput.addEventListener('keydown', event => {if (event.key === 'Enter') {event.preventDefault(); goToPage(pageInput.value);}});
zoom.addEventListener('change', renderPage);
let resizeTimer, lastWidth = 0;
new ResizeObserver(entries => {
  const width = Math.round(entries[0].contentRect.width);
  if (width === lastWidth) return;
  lastWidth = width;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderPage, 120);
}).observe(stage);

try {
  documentPDF = await getDocument({url: reader.dataset.pdfReader, isEvalSupported: false, useWasm: false}).promise;
  pageCount.textContent = documentPDF.numPages;
  pageInput.max = documentPDF.numPages;
  pageInput.disabled = false;
  zoom.disabled = false;
  await renderPage();
} catch (error) {
  status.textContent = 'The embedded reader is unavailable. Please use Open PDF in New Tab or Download Full PDF.';
  stage.setAttribute('aria-busy', 'false');
  console.error('PDF loading failed:', error);
}
