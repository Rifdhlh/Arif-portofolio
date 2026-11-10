# Muhammad Arif Fadhilah — Portfolio

Personal portfolio of an Information Systems student at BINUS University, Jakarta, Indonesia.

## GitHub Pages

Published address after Pages is enabled: https://rifdhlh.github.io/Arif-portofolio/

The `main` branch stores the source in `dist`. The `gh-pages` branch serves the static website from its root. Update the source and publish the contents of `dist` to `gh-pages` when making changes.

Every requested website update must be published to GitHub Pages after validation. Keep the existing URL above and confirm the deployment workflow succeeds before reporting the update as live.

## Project Pages

- `dist/index.html`: profile, skills, and contact details
- `dist/business-intelligence-projects.html`: Excel project collection
- `dist/dashboard-data-modelling.html`: Adult Census Income project, embedded presentation, and full PDF download
- `dist/pizza-sales-analysis.html`: pizza restaurant sales modelling, monthly revenue and order-timing storytelling, charts, and documented group attribution
- `dist/pizza-dashboard.html`: interactive workbook dashboard with coordinated filters and question-led insights
- `dist/data-information-management.html`: Solaria database design, course context, order/receipt mapping, and verified individual contribution
- `dist/tableau-sales-performance.html`: retail sales preparation, Tableau dashboard, original report, and presentation
- `dist/database-projects.html`: Long-Life Shoe Factory
- `dist/figma-projects.html`: Figma coursework collection
- `dist/system-analysis-projects.html`: Information System Analysis and Design — StSport
- `dist/creativity-and-innovation.html`: Creativity and Innovation, awaiting project materials
- `dist/web-development-projects.html`: Vincraft
- `dist/vincraft-preview/`: embedded interactive frontend demonstration
- `dist/assets/`: images and tool logos

Open `dist/index.html` or serve the `dist` folder with a local static server. No build step is required.

## Project Writing Standard

Every existing and future project follows **What → Why → Goal → My Role → How → Challenges → Target Users → Results** in formal English. Aim for 100–180 words per project summary, with supporting evidence available separately. Follow [PROJECT_TEMPLATE.md](PROJECT_TEMPLATE.md) when adding or updating projects; keep detail pages and Quick View consistent, and never invent outcomes or individual responsibilities.

## Portfolio Interactions

The homepage highlights seven course projects directly, with live project search, discipline filters, quick views, and tool icons at the bottom-right of every card. Each card opens its case study. The existing dark palette, lime accents, hero, About section, experience, technology highlights, contact details, and original CV are retained. StSport, Long-Life, Tableau, and pizza project pages include image galleries with navigation, zoom, and keyboard controls. The Data Modelling page retains its PDF reader and download links. These interactions run in the browser and remain compatible with GitHub Pages.

## Vincraft Preview

Course: COSC6050003 — Programming for Business. The original application uses PHP and MySQL through XAMPP. GitHub Pages hosts a frontend preview with sample content; it does not run PHP or connect to the local MySQL database. Preview interactions—including posts, comments, likes, reports, and optional video links—stay in memory and reset when refreshed. No credentials or database configuration are included.

## Resource integration

The supplied `resource.zip` was checked file by file against the original repository. Its additional coursework supports the Tableau and pizza case studies, expanded StSport evidence, and the source-backed Vincraft preview. See [RESOURCE_INTEGRATION.md](RESOURCE_INTEGRATION.md) for the integration record. Raw customer records, seeded accounts, and local database configuration are kept outside the public website.

## Interactive workbook dashboard

The pizza dashboard runs entirely in the visitor’s browser from an anonymised snapshot verified against the connected `BE11_Project_11.xlsx` workbook on 9 November 2026. It does not keep a live connection to the desktop workbook. Date, city, customer segment, pizza category, and revenue-band filters update every KPI, chart, table, and explanation together. Visitors can choose which analytical question to explore. Original customer names, contact details, and source record identifiers are excluded from the public data.

Run `node --test tests/pizza-dashboard-model.test.cjs` to verify the numerical model and filter combinations. The shared Back control follows browser history, with a relevant parent-page fallback for direct visits. Same-origin navigation uses native document transitions where available, respects reduced motion, and preserves normal scroll restoration.
