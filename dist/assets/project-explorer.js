(() => {
  'use strict';

  const explorer = document.querySelector('[data-project-explorer]');
  if (!explorer) return;

  const projects = {
    excel: {
      title: 'Excel Project',
      keywords: 'Data Modelling Dashboard Microsoft Excel Power Query Power Pivot PivotTable Adult Census Income',
      entries: [{
        title: 'Dashboard & Data Modelling',
        description: 'A Data Modelling course project using Microsoft Excel to explore income patterns in the Adult Census Income Dataset through data preparation, a data model, PivotTables, and dashboards.',
        facts: [['Course', 'Data Modelling'], ['Tools', 'Excel, Power Query, Power Pivot']],
        href: 'dashboard-data-modelling.html'
      }]
    },
    database: {
      title: 'Database Project',
      keywords: 'Long-Life Shoe Factory Database Fundamental ERD OLTP SQL MySQL aggregate JOIN joins subquery subqueries MongoDB',
      entries: [{
        title: 'Long-Life Shoe Factory',
        description: 'An OLTP database design for a shoe factory, covering production, orders, procurement, payments, and goods receipt.',
        facts: [['Course', 'Database Fundamental'], ['Group', '8']],
        href: 'database-projects.html'
      }]
    },
    web: {
      title: 'Web Development',
      keywords: 'Vincraft Programming for Business COSC6050003 PHP MySQL HTML CSS JavaScript JS XAMPP Minecraft',
      entries: [{
        title: 'Vincraft',
        description: 'A Minecraft community website designed for the Programming for Business course. The portfolio includes an interactive preview with sample content.',
        facts: [['Course', 'Programming for Business'], ['Course Code', 'COSC6050003'], ['Server-side Language', 'PHP'], ['Database', 'MySQL']],
        note: 'The embedded preview is a temporary demonstration and does not connect to the original PHP application or MySQL database.',
        href: 'web-development-projects.html'
      }]
    },
    figma: {
      title: 'Figma Project',
      keywords: 'StSport Information System Analysis and Design ISYS6893003 Group 10 Creativity and Innovation Figma Miro draw.io diagrams booking sports',
      entries: [{
        title: 'Information System StSport',
        description: 'Group coursework analyzing and designing a proposed mobile information system for sports facility reservations and sports equipment purchases.',
        facts: [['Course', 'Information System Analysis and Design'], ['Course Code', 'ISYS6893003'], ['Group', '10'], ['Tools', 'Miro, draw.io, Figma']],
        href: 'system-analysis-projects.html'
      }, {
        title: 'Creativity and Innovation',
        description: 'Project details will be added when the supporting materials are available.',
        status: 'Supporting materials pending',
        facts: [['Course', 'Creativity and Innovation']],
        href: 'creativity-and-innovation.html'
      }]
    }
  };

  const controls = explorer.querySelector('[data-explorer-controls]');
  const search = explorer.querySelector('[data-project-search]');
  const filters = [...explorer.querySelectorAll('[data-project-filter]')];
  const cards = [...explorer.querySelectorAll('[data-project-category]')];
  const count = explorer.querySelector('[data-project-count]');
  const empty = explorer.querySelector('[data-project-empty]');
  const dialog = document.querySelector('[data-project-dialog]');
  const dialogTitle = dialog.querySelector('[data-dialog-title]');
  const dialogContent = dialog.querySelector('[data-dialog-content]');
  const closeButton = dialog.querySelector('[data-dialog-close]');
  let category = 'all';
  let returnFocus = null;
  let originalBodyOverflow = '';
  let scrollLocked = false;

  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const searchText = new Map(cards.map(card => [card, normalize(`${card.textContent} ${projects[card.dataset.projectCategory].keywords}`)]));

  function updateResults() {
    const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    let matches = 0;
    for (const card of cards) {
      const matchesCategory = category === 'all' || card.dataset.projectCategory === category;
      const matchesSearch = terms.every(term => searchText.get(card).includes(term));
      card.hidden = !(matchesCategory && matchesSearch);
      if (!card.hidden) matches += 1;
    }
    count.textContent = `${matches} project ${matches === 1 ? 'collection' : 'collections'} found.`;
    empty.hidden = matches !== 0;
    for (const button of filters) {
      button.setAttribute('aria-pressed', String(button.dataset.projectFilter === category));
    }
  }

  function resetResults() {
    search.value = '';
    category = 'all';
    updateResults();
    search.focus();
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function renderEntry(entry) {
    const article = element('article', '', 'project-quick-project');
    article.append(element('h3', entry.title));
    if (entry.status) article.append(element('span', entry.status, 'project-quick-status'));
    const brief = window.portfolioProjectBriefs?.[entry.href];
    if (!brief) article.append(element('p', entry.description));
    const facts = element('dl');
    for (const [label, value] of entry.facts) {
      const item = element('div');
      item.append(element('dt', label), element('dd', value));
      facts.append(item);
    }
    article.append(facts);
    if (brief) {
      const list = element('ol', '', 'quick-brief');
      brief.forEach(([label, text]) => {
        const item = element('li');
        item.append(element('h4', label), element('p', text));
        list.append(item);
      });
      article.append(list);
    }
    if (entry.note) article.append(element('p', entry.note));
    const link = element('a', 'Open Project ↗', 'button');
    link.href = entry.href;
    link.setAttribute('aria-label', `Open Project: ${entry.title}`);
    article.append(link);
    return article;
  }

  function cleanUpDialog() {
    if (scrollLocked) {
      document.body.style.overflow = originalBodyOverflow;
      scrollLocked = false;
    }
    if (returnFocus && returnFocus.isConnected && !returnFocus.closest('[hidden]')) {
      returnFocus.focus({ preventScroll: true });
    }
    returnFocus = null;
  }

  function openQuickView(key, trigger) {
    if (dialog.open) return;
    const project = projects[key];
    dialogTitle.textContent = project.title;
    dialogContent.replaceChildren(...project.entries.map(renderEntry));
    returnFocus = trigger;
    dialog.showModal();
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    scrollLocked = true;
    dialog.scrollTop = 0;
    closeButton.focus({ preventScroll: true });
  }

  search.addEventListener('input', updateResults);
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.projectFilter;
    updateResults();
  }));
  explorer.querySelectorAll('[data-project-clear]').forEach(button => button.addEventListener('click', resetResults));
  if (typeof dialog.showModal === 'function') {
    explorer.querySelectorAll('[data-project-quick-view]').forEach(button => {
      button.addEventListener('click', () => openQuickView(button.dataset.projectQuickView, button));
      button.hidden = false;
    });
    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      dialog.close();
    });
    dialog.addEventListener('close', cleanUpDialog);
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    window.addEventListener('pagehide', () => {
      if (dialog.open) dialog.close();
      cleanUpDialog();
    });
  }
  updateResults();
  controls.hidden = false;
})();
