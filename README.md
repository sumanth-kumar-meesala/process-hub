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

Deploying takes about an hour. Each step has exact click paths; the labels match Microsoft's current UI (October 2026).

### 0. Check nothing is blocked (5 minutes)
| Check | How | If it fails |
| --- | --- | --- |
| Office Scripts | Open any workbook in Excel **in the browser**. Is there an **Automate** tab in the ribbon? | Enable **third-party cookies** for the site in your browser (Microsoft's documented fix). If it's still missing, your admin has turned off Office Scripts, and this design won't work |
| Power Automate | <https://make.powerautomate.com> → **Create**: can you see **Automated cloud flow**? | Your licence doesn't include Power Automate. Ask IT for a licence (not admin rights) |
| Power Apps | <https://make.powerapps.com> → **Create** → **Create from blank**: does it open? | Same as above |
| Create a list | On your SharePoint site: **+ New** → **List**. Does the *Create a list* dialog open? (Then close it) | Ask the **site owner** to do step 1.2 for you. It's a one-off site-owner task, not an admin one |

### 1. Folder and list
1. **Folder:** open your document library → **+ New** → **Folder** → name it `Processes` → **Create**.
2. **List:** open any page of the site in Edge or Chrome → press **F12** → **Console** tab → paste all of [`setup/create-list.js`](setup/create-list.js) → **Enter**. (If the console says pasting is blocked, type `allow pasting`, press Enter, then paste again.) Wait for **Done**, then refresh **Site contents**: a list called **Processes** is there.

<details><summary>Create the list by hand (if F12 / the console is blocked)</summary>

1. On the site: **+ New** → **List** → **Blank list** → **Name:** `Processes` → **Create**.
2. For each column below: click **+ Add column** → pick the type → **Next** → type the **Name** exactly as shown → **Save**.

| Name | Type | Notes |
| --- | --- | --- |
| Code | Single line of text | |
| FileId | Single line of text | |
| FileName | Single line of text | |
| FileUrl | Multiple lines of text | |
| Owner | Single line of text | |
| Summary | Multiple lines of text | |
| StepCount | Number | |
| Status | Single line of text | |
| Message | Multiple lines of text | |
| Data | Multiple lines of text | Leave **Use enhanced rich text** OFF (under *More options*). It must be plain text |

3. Index FileId: **Settings** (gear) → **List settings** → **Indexed columns** → **Create a new index** → **FileId** → **Create**.
</details>

### 2. The workbook the script runs in
In the same document library: **+ New** → **Excel workbook**. Rename it to `ProcessParser` (top of the Excel window, click the file name). The flow's *Run script* action needs a workbook to open; the script doesn't change it.

> **Create it from inside the library, not from Excel's own "New blank workbook" or onedrive.com.** Either of those saves the file to your personal OneDrive (`…-my.sharepoint.com/personal/…`) instead of the site, and the flow's *Run script* step then can't find it under **Location → SharePoint Site**. If that's already happened: move the file from OneDrive into this library (select it → **Move to** → pick the site and library), or change the step's **Location** to **OneDrive for Business** instead.

### 3. The Office Script
1. Open **ProcessParser.xlsx** in the browser → **Automate** tab → **New Script** → **Create in Code Editor**.
2. The Code Editor opens on the right with sample code. Select all of it (Ctrl+A) and delete it.
3. Open [`office-script/parseBpmn.ts`](office-script/parseBpmn.ts) on GitHub → **Raw** → Ctrl+A, Ctrl+C → paste into the Code Editor.
4. Click the script's name at the top of the Code Editor (e.g. *Script 1*) and rename it to `parseBpmn`.
5. Click **Save Script**. Excel saves it to your OneDrive (`Documents › Office Scripts`), which is where the flow's *Run script* action looks.

> Do this with the **same account** that will own the flows.

**If the Code Editor shows an error:** make sure you pasted the **latest** version of the file (from the Raw view, replacing *all* the sample code), then save again. The script follows Microsoft's [Office Scripts TypeScript restrictions](https://learn.microsoft.com/office/dev/scripts/develop/typescript-restrictions): arrow functions in array callbacks, no `any`, TypeScript 4.0.3 features only. If an error remains, note the line number shown in the editor and report it.

### 4. The flows
Follow [`flow/README.md`](flow/README.md): **Sync processes** (on file add/change) and **Remove deleted processes** (daily).
Test: upload a Signavio `.bpmn` file to **Processes**. Within about a minute, a row appears in the **Processes** list with `Status = OK`.

### 5. The app and the page
Follow [`powerapps/README.md`](powerapps/README.md): create the canvas app, paste the timeline controls, publish, share, and add it to your page with the **Power Apps** web part.

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

## Sources (Microsoft documentation the steps are based on)
- [Office Scripts tutorial: New Script › Create in Code Editor, Save Script, Run script action](https://learn.microsoft.com/office/dev/scripts/tutorials/excel-power-automate-manual)
- [Office Scripts platform limits and the missing Automate tab](https://learn.microsoft.com/office/dev/scripts/testing/platform-limits)
- [Power Automate cloud flows designer](https://learn.microsoft.com/power-automate/flows-designer) · [SharePoint connector](https://learn.microsoft.com/connectors/sharepointonline/)
- [Power Apps: create a blank canvas app](https://learn.microsoft.com/power-apps/maker/canvas-apps/create-blank-app) · [code view paste](https://learn.microsoft.com/power-apps/maker/canvas-apps/code-view) · [Power Apps web part](https://support.microsoft.com/office/use-the-power-apps-web-part-6285f05e-e441-408a-99d7-aa688195cd1c)
