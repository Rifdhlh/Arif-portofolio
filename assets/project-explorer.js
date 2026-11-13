(() => {
  'use strict';

  const explorer = document.querySelector('[data-project-explorer]');
  if (!explorer) return;

  const projects = {
  "census": {
    "title": "Dashboard & Data Modelling",
    "keywords": "Adult Census Income 1994 Data Modelling Dashboard Microsoft Excel Power Query Power Pivot PivotTable LC11",
    "entries": [
      {
        "title": "Dashboard & Data Modelling",
        "description": "Preparing the Adult Census Income Dataset, building fact and dimension tables, and developing PivotTables and dashboards in Excel.",
        "facts": [
          [
            "Course",
            "Data Modelling"
          ],
          [
            "Tools",
            "Excel, Power Query, Power Pivot"
          ]
        ],
        "href": "dashboard-data-modelling.html"
      }
    ]
  },
  "pizza": {
    "title": "Pizza Restaurant Sales Analysis",
    "keywords": "Pizza Restaurant Sales Analysis 2015 Data Modelling ISYS6895003 BE11 Group 10 Excel Power Pivot formulas cube slicers",
    "entries": [
      {
        "title": "Pizza Restaurant Sales Analysis",
        "description": "Connecting restaurant records in Excel to explore 2015 sales trends, product mix, ordering patterns, and aggregate customer segments.",
        "facts": [
          [
            "Course",
            "Data Modelling"
          ],
          [
            "Course Code",
            "ISYS6895003"
          ],
          [
            "Class / Group",
            "Lab BE11 · Group 10"
          ],
          [
            "Tools",
            "Excel, Power Pivot"
          ]
        ],
        "href": "pizza-sales-analysis.html"
      }
    ]
  },
  "visualization": {
    "title": "Retail Sales Performance",
    "keywords": "Tableau Data Visualization Visualisation Retail Sales Performance Power Query Microsoft Excel Dashboard 2025 LB11",
    "entries": [
      {
        "title": "Retail Sales Performance",
        "description": "Cleaning retail sales records with Power Query and presenting product, category, and monthly performance in an interactive Tableau dashboard.",
        "facts": [
          [
            "Course",
            "Data Visualization"
          ],
          [
            "Tools",
            "Power Query, Excel, Tableau"
          ],
          [
            "Analysis Period",
            "January–June 2025"
          ]
        ],
        "href": "tableau-sales-performance.html"
      }
    ]
  },
  "database": {
    "title": "Long-Life Shoe Factory",
    "keywords": "Long-Life Shoe Factory Database Fundamental Group 8 ERD OLTP SQL MySQL aggregate JOIN subquery",
    "entries": [
      {
        "title": "Long-Life Shoe Factory",
        "description": "An academic database design covering production, orders, procurement, payments, and goods receipt through an ERD and SQL queries.",
        "facts": [
          [
            "Course",
            "Database Fundamental"
          ],
          [
            "Group",
            "8"
          ],
          [
            "Tools",
            "MySQL, SQL"
          ]
        ],
        "href": "database-projects.html"
      }
    ]
  },
  "figma": {
    "title": "StSport Information System",
    "keywords": "StSport Information System Analysis and Design ISYS6893003 Group 10 Figma Miro draw.io sports booking reservation UI design",
    "entries": [
      {
        "title": "StSport Information System",
        "description": "Designing a proposed sports reservation and equipment purchasing system through interface mock-ups, process diagrams, and system models.",
        "facts": [
          [
            "Course",
            "Information System Analysis and Design"
          ],
          [
            "Course Code",
            "ISYS6893003"
          ],
          [
            "Group",
            "10"
          ],
          [
            "Tools",
            "Miro, draw.io, Figma"
          ]
        ],
        "href": "system-analysis-projects.html"
      }
    ]
  },
  "web": {
    "title": "Vincraft Community Website",
    "keywords": "Vincraft Programming for Business COSC6050003 PHP MySQL HTML CSS JavaScript JS XAMPP Minecraft",
    "entries": [
      {
        "title": "Vincraft Community Website",
        "description": "A Minecraft community website developed with HTML, CSS, JavaScript, PHP, and MySQL, with an interactive frontend demonstration.",
        "facts": [
          [
            "Course",
            "Programming for Business"
          ],
          [
            "Course Code",
            "COSC6050003"
          ],
          [
            "Tools",
            "HTML, CSS, JavaScript, PHP, MySQL"
          ]
        ],
        "href": "web-development-projects.html",
        "note": "The interactive preview uses sample content. Changes last only for the current session and do not connect to the original PHP application or MySQL database."
      }
    ]
  },
  "dim": {
    "title": "Solaria Integrated Restaurant Operations Database",
    "keywords": "Data and Information Management DIM Solaria Oracle SQL PL SQL PL/SQL ERD conceptual logical physical database design receipt restaurant POS transaction inventory warehouse group 3",
    "entries": [
      {
        "title": "Solaria Integrated Restaurant Operations Database",
        "description": "An academic group database design using Solaria as a restaurant case study, from conceptual and logical models to an Oracle physical design.",
        "facts": [
          [
            "Course",
            "Data and Information Management"
          ],
          [
            "Group",
            "3"
          ],
          [
            "Tools",
            "Oracle SQL, PL/SQL"
          ]
        ],
        "href": "data-information-management.html"
      }
    ]
  },
  "research": {
    "title": "Student Acceptance of AI-Driven Learning Analytics System",
    "keywords": "Research Method Student Acceptance AI-Driven Learning Analytics System artificial intelligence AI university quantitative survey PLS SEM SmartPLS compatibility autonomy knowledge technological competence adoption intention actual usage",
    "entries": [
      {
        "title": "Student Acceptance of AI-Driven Learning Analytics System",
        "description": "A quantitative study exploring students’ acceptance and reported use of AI-driven learning analytics systems.",
        "facts": [
          [
            "Course",
            "Research Method"
          ],
          [
            "Method",
            "Quantitative Survey, PLS-SEM"
          ],
          [
            "Analysis Tool",
            "SmartPLS"
          ]
        ],
        "href": "research-method.html"
      }
    ]
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
  const searchText = new Map(cards.map(card => [card, normalize(`${card.textContent} ${projects[card.dataset.projectKey || card.dataset.projectCategory].keywords}`)]));

  function updateResults() {
    const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    let matches = 0;
    for (const card of cards) {
      const matchesCategory = category === 'all' || card.dataset.projectCategory === category;
      const matchesSearch = terms.every(term => searchText.get(card).includes(term));
      card.hidden = !(matchesCategory && matchesSearch);
      if (!card.hidden) matches += 1;
    }
    count.textContent = `${matches} ${matches === 1 ? 'project' : 'projects'} found.`;
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
