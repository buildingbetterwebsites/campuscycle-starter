# Campus Cycle starter: notes for coding agents

- **What this is:** the starter website of the course "Building better websites": Next.js 16 with
  Payload CMS 3 on Postgres (Neon), images in Vercel Blob, Tailwind CSS 4. Learners copy it and
  change it. `README.md` and `docs/guides/` explain it for people; read them first.
- **The look lives in one file:** every colour, font, size and space is a design token in
  `src/app/(site)/globals.css`. Take colours only from those tokens; never write a colour value in a
  component.
- **Run commands through the npm scripts** (`npm run dev`, `migrate`, `migrate:create`, `seed`). They
  go through `scripts/guard.mjs`, which refuses the live database. There is no `payload` script on
  purpose.
- **Fixed names:** `docs/COURSE-CHECK-CONTRACT.md` and the marker comments for the course's warm-ups
  (W4, W5, W6) are quoted by the course. Never change or reword them.
- **Words:** "user", never "visitor"; "record", never "document", for a stored item. Comments are
  plain English for first-term learners, and say why.

The block below is written by `next dev`; keep it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
