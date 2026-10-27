# Power Apps: the timeline screen

One canvas app with one screen. You pick a process and see every stage and step on the left (click a stage to open it). The selected step is shown on the right: who does it, how to do it, notes, documents, which way at decisions, and what happens next.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ [Find a process ▾ AB12 · Approve…]  [Show me as: Everyone ▾]  [Find a step…]  │
├────────────────────────────┬──────────────────────────────────────────────────┤
│ Starts when: …  [Open all] │ STAGE 2 · Check the request           Owner: …   │
│ ■1 STAGE 1  Receive req…   │ 2.2  Get manager's approval                      │
│ ■2 STAGE 2  Check the r… ⌃ │ Who: Purchasing Officer                          │
│   ○ 2.1 Check budget       │                                                  │
│   ● 2.2 Get manager's…     │ How to do it …                                   │
│   ? 2.3 Approve or Reject? │ Documents • Purchase policy (link)               │
│ ■3 STAGE 3  …              │ Which way? Approve → … · Reject → …              │
│ Done when: …               │ [‹ Previous]      [Open BPMN file]    [Next ›]   │
└────────────────────────────┴──────────────────────────────────────────────────┘
```

## Build it (about 15 minutes, in the browser)

1. Go to <https://make.powerapps.com> → **+ Create** → **Blank app** → **Blank canvas app**. Name it `Process Timeline`, format **Tablet**, then **Create**.
2. **Data** (left bar, cylinder icon) → **Add data** → **SharePoint** → your site → tick **Processes** → **Connect**.
3. **Settings → General → Data row limit**: set it to `2000`. The list is small, and this avoids warnings about filters that SharePoint can't run on its side.
4. Select **Screen1** in the tree view, then in the property bar set:
   - `Fill` → `RGBA(250, 250, 250, 1)`
   - `OnVisible` → `Select(btnLoad)`
5. Open `timeline-controls.pa.yaml`, copy **all** of it, click the empty screen in Studio and press **Ctrl+V**. The 19 controls appear with their names and formulas.
6. **Save**, then **Publish**. Then **Share** the app with the people who should see it (or with a group, e.g. everyone in the site's Members group). They also need **read** access to the Processes list.
7. Press **Play** (▶) and pick a process to check it works.

### If Studio doesn't accept the paste
Control versions change over time, and a paste can fail with a message about a control version. Either:
- change the version in the YAML to the one Studio expects (the error message names it) and paste again, or
- **build by hand:** add each control from the YAML with the same name and type (Button, Combo box, Drop down, Text input, Rectangle, Label, Gallery → *Blank vertical*, Icon, HTML text), then copy each property formula across. The YAML is the full spec.

## Put it on the SharePoint page
1. Copy the **App ID** or **web link** from make.powerapps.com → Apps → `Process Timeline` → **⋯ → Details**.
2. Edit your SharePoint page → **+** → **Power Apps** web part → paste the link → turn off **Show border** → set the **aspect ratio** to 16:9.
3. **Republish** the page.

To link straight to one process, add `&code=FS07` to the app's web link (the app reads `Param("code")`).

## How it works
- `btnLoad` (hidden) turns the selected row's `Data` JSON into the collection `colRows`: stage rows and step rows in display order, with `n, k, s, num, title, color, role, count, hint, detail`. The Office Script builds `detail` as safe HTML, so the app just shows it in `htmlDetail`.
- Variables: `varSel` (selected row), `varOpen` (open stage), `varAll` (all stages open), `varRole` (the "Show me as" role; other people's steps are greyed out).
- Search matches step titles, roles and the detail text (documents, notes).
- Colours: Fluent neutrals plus one colour per stage, which comes from the data.
