# Process Hub — SharePoint edition (no admin, no code to host)

Shows Signavio processes on a SharePoint page as a readable **timeline**: stages, steps, who does what, how to do it, documents, and which way at decisions.

Process owners only export from Signavio and drop the `.bpmn` file into a SharePoint folder. Everything after that happens by itself.

```
Signavio → BPMN 2.0 XML export
   │  drop into
   ▼
SharePoint library /Processes/*.bpmn
   │  Power Automate "Sync processes" (on add / change)
   ▼
Office Script parseBpmn (runs in Excel for the web) → readable JSON
   │
   ▼
SharePoint list "Processes" (one row per process)
   │
   ▼
Power Apps "Process Timeline" → Power Apps web part on your SharePoint page
```

**Why it's built this way:** SPFx, Script Editor and custom scripts all need an admin. Everything here uses tools that come with a normal Microsoft 365 licence and your own permissions: a SharePoint list, Power Automate with standard connectors, Office Scripts, and a Power Apps canvas app. **Deploying it only needs a browser.** No Node.js, no installs.

| Folder | What's in it |
| --- | --- |
| `office-script/parseBpmn.ts` | Office Script that turns BPMN XML into the timeline JSON |
| `setup/create-list.js` | One-time script that creates the **Processes** list (pasted into the browser console) |
| `flow/README.md` | How to build the two Power Automate flows, step by step |
| `powerapps/` | The timeline screen (`timeline-controls.pa.yaml`) and how to build and embed the app |
| `test/check.mjs` | Developer self-check of the parser (optional; needs Node 23.6+) |

BPMN files are **never** committed to this repo (`.gitignore`).

---

## Deploy (in this order)

### 0. Check nothing is blocked (5 minutes)
- Open Excel for the web. Is there an **Automate** tab? If yes, Office Scripts is available.
- Open <https://make.powerautomate.com> and <https://make.powerapps.com>. Can you create a flow and an app?
- In your SharePoint site, can you create a list? Try **+ New → List**, then cancel. If not, ask the site owner to run step 1 for you. That's a site-owner task, not an admin one.

### 1. Folder and list
1. In the document library, create a folder **Processes**. Upload a test `.bpmn` file later.
2. Create the **Processes** list: open the site, press **F12 → Console**, paste all of `setup/create-list.js` and press Enter. Wait for *Done*.

<details><summary>Create the list by hand (if the console is blocked)</summary>

**Site contents → + New → List → Blank list**, name it `Processes`. Then add these columns. The names must match exactly.

| Column | Type |
| --- | --- |
| Code | Single line of text |
| FileId | Single line of text (column settings → *Indexed*: yes, via List settings → Indexed columns) |
| FileName | Single line of text |
| FileUrl | Multiple lines of text (plain) |
| Owner | Single line of text |
| Summary | Multiple lines of text (plain) |
| StepCount | Number (0 decimals) |
| Status | Single line of text |
| Message | Multiple lines of text (plain) |
| Data | Multiple lines of text (**plain text**, not rich text) |
</details>

### 2. An empty workbook for the script
In the same library, create an empty Excel workbook named **ProcessParser.xlsx**. The flow's *Run script* action needs a workbook to open; the script doesn't change it.

### 3. The Office Script
1. Open **ProcessParser.xlsx** in Excel for the web → **Automate** → **New script**.
2. Delete the sample code, paste all of `office-script/parseBpmn.ts`, rename the script (click its name) to **parseBpmn**, and **Save**.

### 4. The flows
Follow `flow/README.md`: **Sync processes** (on file add/change) and **Remove deleted processes** (daily).
Test: upload a Signavio `.bpmn` file to `/Processes`. Within about a minute, a row appears in **Processes** with `Status = OK`.

### 5. The app and the page
Follow `powerapps/README.md`: create the canvas app, paste the timeline controls, publish, share, and add it to your page with the **Power Apps** web part.

---

## Day to day
| To… | Do this |
| --- | --- |
| Add a process | Export it from Signavio (**BPMN 2.0 XML**) and upload it to `/Processes` |
| Update a process | Export it again under the **same file name** and upload, replacing the old one |
| Remove a process | Delete the file. Its row is removed by the next daily cleanup |
| See why one isn't showing | Open the **Processes** list: `Status` and `Message` say what went wrong |

## How the diagram is read
| In Signavio | On the timeline |
| --- | --- |
| Lanes (or pools without lanes) | Who does each step |
| Tasks, call activities, collapsed sub-processes | Steps. Documentation → *How to do it*; linked text annotations → *Notes*; linked data objects → *Documents* (with links from Signavio's document link field) |
| Gateways that split (exclusive, inclusive, event-based) | Decisions, one branch per outgoing path, with the path's name as the label |
| Start / end events | *Starts when* / *Done when* |
| Groups or expanded sub-processes | Stages. Diagrams without them are split into stages of about 8 steps, at the widest gaps between columns |
| Boundary events | *What if…* on the step |
| Annotations "Process name: … / Process Owner: …" and "PROCESS DESCRIPTION: …" | Owner and summary |

**Tip for process owners:** add **groups** in Signavio around each phase. They become named stages, which read much better than the automatic ones.

## For developers
```bash
node test/check.mjs "/path/to/FS07 - ….bpmn" "/path/to/FS11 - ….bpmn"
```
This runs the Office Script against real files, which stay outside the repo, plus a built-in mini diagram. It prints the timeline as text and asserts the basics: roles, decisions, escaping, and size under the 60,000-character column limit.
