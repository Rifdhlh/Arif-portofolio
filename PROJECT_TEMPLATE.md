# Portfolio project writing standard

Apply this standard to every existing and future project. Keep the public portfolio in formal English, accessible to recruiters, and concise enough to scan in approximately one minute.

## Required order

1. **What** — Name the deliverable and describe what it does.
2. **Why** — Identify the problem or need behind the project.
3. **Goal** — State the intended objective without claiming it has already been achieved.
4. **My Role** — State Muhammad Arif Fadhilah's verified individual responsibilities. Distinguish these from the group's scope.
5. **How** — Summarize the approach and relevant tools.
6. **Challenges** — Describe a documented challenge or a concrete design constraint supported by the materials. Do not invent obstacles or resolutions.
7. **Target Users** — Identify the intended client or users. Distinguish a hypothetical academic audience from an actual commissioned client.
8. **Results** — State the deliverables and verified outcomes. Use metrics only when supplied or supported. Do not imply deployment, adoption, testing, or business impact without evidence.

## Length and presentation

- Aim for 100–180 words across the eight fields, generally one sentence per field.
- Keep course name, course code, group, and tools in a separate compact metadata block.
- Show all eight summary fields in order on project detail pages and in Quick View.
- Keep collection cards to a short teaser linking to the structured summary.
- Preserve original project evidence: diagrams, screenshots, interactive previews, PDF readers, and downloads.
- Remove redundant narrative; place longer supporting explanations below the summary or inside clearly labelled disclosures.
- Highlight individual contributions without attributing the entire group project to one person.
- If project materials or personal responsibilities are unconfirmed, state this briefly. Do not fabricate a completed case study for a pending project.

## Implementation

Use the shared `dist/assets/project-brief.css` layout and the current project pages as markup examples. After editing a summary, run `node scripts/sync-project-briefs.cjs` from this project directory. This verifies the eight labels and word limit, then updates `dist/assets/project-briefs.js` so Quick View presents the same content. Verify working evidence links and mobile layout before publishing to both `main` and `gh-pages`.

## Draft template

**Project title:**
**Course / Code / Group:**

**What:**
**Why:**
**Goal:**
**My Role:**
**How:**
**Challenges:**
**Target Users:**
**Results:**

**Supporting evidence:**
