# Process Hub

A prototype that explains business processes in plain words, with a **3D story view** people can click through, a **drag-and-drop Builder** for Process Owners, and an **AI assistant (Groq)** that drafts and edits processes from a description.

No server and no database to set up: the app is a static site (GitHub Pages) and keeps its data in the browser (IndexedDB).

## What's inside

| Screen | Who | What it does |
| --- | --- | --- |
| Find a process | Everyone | Search, filter by area, "I work as" highlights your processes |
| Process (3D) | Everyone | Islands generated from the process: one per stage, plus start (triggers) and finish (outcomes). Click an island for details, "Show me as" fades stages you're not in, "I am here" avatar follows the journey. Tabs: Overview, My role, Owner |
| Builder | Process Owner, Global Admin | Lanes = roles, columns = stages. Drag in steps, decisions, triggers, outcomes, systems and documents; connect steps; edit details; live 3D preview; AI assistant |
| Admin | Global Admin | Groq key and model, people & personas, import / export / reset processes |

Personas (from the RBAC slides): Process Performer, People Leader, Process Owner, Executive, Global Admin. There is no sign-in in this prototype — the **"I am"** switch in the header picks the persona.

## Starter processes

Only processes from the original mockups are included (`src/data/seed.ts`):

- **FS25 · Client Specific Training** — complete
- New Employee Onboarding, Employee Exit & Offboarding, Leave Request & Approval, Purchase Requisition to Payment — only partial information existed, so they are marked **"Being completed"** for their owners to finish in the Builder.

Edits and new processes are saved in each browser. To share them with everyone: **Admin → Processes → Export all**, then replace the processes in `src/data/seed.ts` (or ask Claude to merge the exported file) and push.

## AI assistant (Groq) and its limits

- **Shared key for everyone (GitHub secret):** in the repo, add a secret named `GROQ_API_KEY` — either under **Settings → Environments → github-pages → Environment secrets** (the workflow builds inside that environment) or under **Settings → Secrets and variables → Actions → Repository secrets** — paste the key, and publish with the GitHub Actions workflow (Option B below). The workflow passes it to the build as `VITE_GROQ_API_KEY`, so every visitor can use the AI without adding a key. **Admin → AI assistant** shows "Shared key: on" when it worked.
  - The key is built into the site's JavaScript, so anyone who opens the published site can find it. Use a key you can limit or replace, keep the repo/site private where you can, and rotate the key in the Groq console if it leaks.
  - Building on your own computer: copy `.env.example` to `.env.local` and fill in `VITE_GROQ_API_KEY` (`.env.local` is never committed). `npm run deploy` (Option A) builds with whatever is in `.env.local`.
- **Key for one browser:** the Global Admin can also paste a key in **Admin → AI assistant**. It is stored only in that browser and wins over the shared key.
- **Never commit a key to this repo** — use the secret or `.env.local`.
- Requests are kept small for the free tier (about 8k tokens/minute on some models):
  - the process is sent as a compact text outline, not the diagram
  - only the last 6 chat messages are sent in full; older ones are folded into a short summary
  - each request is measured and trimmed to a 6k-token budget
  - the AI replies with small edit operations (`src/ai/ops.ts`) that the user previews (dashed on the canvas) and then **Applies** or **Discards**
  - on HTTP 429 the app waits for the time Groq asks and retries once
- Logic: `src/ai/groq.ts`. Default model `openai/gpt-oss-120b` — change it in Admin to any model your Groq account offers.

## Tech

Vite + React + TypeScript · Tailwind CSS v4 with Material 3 colour roles · shadcn-style components (Radix + cva) · React Flow (`@xyflow/react`) for the Builder · React Three Fiber + drei for the 3D view · Zustand + idb-keyval for in-browser storage · lucide icons.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Publish on GitHub Pages

**Option A — one command (simplest)**

1. Create an empty GitHub repo called `process-hub` and push this folder to it (see below).
2. Run `npm run deploy`. This builds the site and pushes it to a `gh-pages` branch.
3. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `gh-pages` / root**.
4. The site appears at `https://<your-user>.github.io/process-hub/`. Run `npm run deploy` again whenever you want to publish changes.

**Option B — automatic on every push**

Move `setup/github-pages-workflow.yml` to `.github/workflows/deploy.yml`, push, and set **Settings → Pages → Source: GitHub Actions**. If the repository secret `GROQ_API_KEY` exists, the AI is switched on for everyone.

**First push**

```bash
git init -b main
git add .
git commit -m "Process Hub prototype"
git remote add origin https://github.com/<your-user>/process-hub.git
git push -u origin main
```

The app uses hash URLs (`#/process/...`) so it works from any Pages path without extra configuration. The mockup images in this folder are listed in `.gitignore`, so they are not uploaded.
