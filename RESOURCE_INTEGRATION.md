# Resource integration record

The uploaded `resource.zip` contains 107 files across 17 directories. Every file was classified and compared by SHA-256 with the original repository commit `38635ec417ab6a651cb0b8d9f3e94fa5a0fe1863`.

- 60 files exactly match existing repository content.
- 46 files provide additional source or coursework evidence.
- One README has an unrelated basename collision and belongs to the raw dataset.

The archive flattens several website files, so its structure was mapped back to the working website rather than copied over the application. The existing Vincraft frontend files absent from the archive are retained.

| Source material | Integration |
| --- | --- |
| Existing HTML, stylesheets, JavaScript, images, CV, census presentation, and PDF.js | Preserved as the portfolio foundation; presentation and professional English updated. |
| Individual Data Visualization report, spreadsheets, and Tableau workbooks | Added Retail Sales Performance case study with three original dashboard/chart images, the original report, verified dashboard and presentation links, and a structured project summary. |
| Pizza Data Modelling report, workbook, and relational CSV tables | Added Pizza Restaurant Sales Analysis case study with three original aggregate charts, documented group attribution, and a structured project summary. Linked directly from the homepage, the Excel collection, and Quick View. |
| StSport project document | Expanded the original gallery with payment, partner confirmation, and class diagram evidence. Retained original interface and process images. |
| Original Vincraft PHP application and assets | Reviewed visitor, member, and administrator workflows. Retained the static frontend demonstration and added session-only reporting, optional video links, and source-backed form constraints. |
| Raw datasets, database seeds, local connection configuration, and full source archives | Retained in the extracted reference workspace. These inform the case studies and demonstration; they are not website downloads. |

The source reports contain inconsistent monetary totals, so the new case studies describe the verified analytical process and deliverables without repeating unsupported financial claims. The pizza report documents group output without assigning unverified individual responsibilities. RFM segmentation is not claimed because the submitted Data Visualization deliverable demonstrates retail sales analysis.

The complete private file-level classification is retained alongside the extracted resource reference in the task workspace. Original evidence visuals retain their source language and appearance; portfolio explanations use professional English.

## Tool icon attribution

The PHP mark in `dist/assets/php.svg` comes from the Simple Icons project and is provided under CC0. Existing uploaded tool logos are retained for Excel, MySQL, Tableau, Miro, draw.io, Figma, HTML, CSS, and JavaScript. Power Query and Power Pivot are identified with Excel’s icon and an accessible label.

## Pizza transaction-level interpretation

The pizza case study also explains monthly revenue and weekday/hour order activity using aggregate-only data verified against `orders.csv`, `order_details.csv`, and `pizzas.csv`. Revenue is calculated once per order line as quantity multiplied by pizza price; each order is counted once in the heatmap. The accessible chart and heatmap reproduce the supplied transaction-level view. The original coursework sales image remains clearly labelled as a different calculation context. Managerial suggestions are presented as recommendations to investigate, with no claim that they were implemented or caused business improvements.

## Connected workbook and subsequent project updates

The interactive pizza dashboard uses an anonymised basket-and-line snapshot whose inputs were checked against the connected workbook in bounded batches: all 21,350 orders, 48,620 order lines, 800 customer cohort records, 96 fixed menu prices, and 32 pizza types matched. Excel time fractions were rounded to seconds before deriving hours to avoid floating-point boundary errors. Original customer names, contact fields, and source IDs are excluded.

The public model uses matching line revenue, distinct qualifying baskets, distinct active anonymous customers, and matching revenue per qualifying order. All five filters are coordinated. The original worksheet and source files remain unchanged.

The supplied Data and Information Management markdown and Word documents contain equivalent project text and ERD evidence. The Solaria page presents an academic database design rather than a deployed client system. The user directly confirmed conceptual, logical, and physical design work and the learning exercise of mapping order journeys and receipt details to ERD entities. Original student IDs are not included in the public project evidence. Course descriptions for Data Modelling, Data Visualization, Database Fundamental, and Data and Information Management follow the supplied course information. HIMSISFO experience wording and dates are aligned with the original CV.
