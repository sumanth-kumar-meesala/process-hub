# Power Apps: the timeline screen (step by step)

One canvas app with one screen. Pick a process and you see every stage and step on the left (click a stage to open it). The selected step is shown on the right: who does it, how to do it, notes, documents, which way at decisions, and what happens next.

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

**Before you start:** the **Processes** list should already have at least one row (upload a `.bpmn` file and let the flow run), so you can see the app working as you build it.

## A. Create the app
1. Go to <https://make.powerapps.com>. Check the **environment** name at the top right: use the default one (usually your company's name) unless you've been told otherwise.
2. In the left menu click **Create** → **Create from blank**.
3. In **Start with a blank canvas**, choose **Tablet size**. Name it `Process Timeline` and click **Create**. Power Apps Studio opens.

## B. Connect the list
1. In Studio's left bar, click the **Data** icon (cylinder) → **Add data**.
2. In the search box type `SharePoint` → click **SharePoint**. Choose your connection, or **Add a connection → Connect directly (cloud services) → Connect**.
3. Pick your site (or paste its address), tick **Processes**, click **Connect**.

## C. Raise the row limit
**Settings** (gear icon in the top bar) → **General** → **Data row limit** → `2000` → close the dialog.
(The app only filters a small list, so this just avoids warnings about filters SharePoint can't run on its side.)

## D. Set up the screen
1. In the **Tree view** (left bar, layers icon), click **Screen1**.
2. In the **property dropdown** at the top left of the formula bar, choose **Fill** and type: `RGBA(250, 250, 250, 1)`
3. Choose **OnVisible** in the same dropdown and type: `Select(btnLoad)`

## E. Paste the controls
1. Open [`timeline-controls.pa.yaml`](timeline-controls.pa.yaml) on GitHub, click **Raw**, then select all (Ctrl+A) and copy (Ctrl+C).
2. In Studio, click **Screen1** in the Tree view and press **Ctrl+V**. Or right-click **Screen1** → **Paste**.
   - The first time, the browser asks for **clipboard access**. Click **Allow**.
3. 19 controls appear: `btnLoad`, `cmbProcess`, `drpRole`, `txtSearch`, `galTimeline` and so on.
4. Click **Play** (▶, top right) or press **F5**, and pick a process. Press **Esc** to return.

> The YAML deliberately has **no control versions**, so Studio uses the current version of each control.

### If the paste doesn't work
| Problem | Fix |
| --- | --- |
| Nothing happens | Allow clipboard access for `make.powerapps.com` in your browser's site settings, then try again |
| "Can't paste" / validation error naming a property | Delete that property line from the YAML (Studio says which one) and paste again |
| Formulas show red errors in a non-English region | Your region uses `;` instead of `,` in formulas. Studio usually converts automatically; if not, set your browser/Power Apps language to English (US) while building |
| Still stuck | Build by hand: add each control from the YAML with the **same name** and type (Classic/Button → **Button**, Label → **Text label**, Classic/TextInput → **Text input**, Classic/ComboBox → **Combo box**, Classic/DropDown → **Drop down**, Rectangle, Gallery (variant Vertical) → **Blank vertical gallery**, Classic/Icon → an **Icon**, HtmlViewer → **HTML text**). Then copy each property from the YAML into the formula bar. Controls listed under `Children:` go *inside* the gallery |

## F. Publish and share
1. **Save** (disk icon, top right) → then **Publish** (the icon next to Save) → **Publish this version**.
2. Back on make.powerapps.com → **Apps** → select **Process Timeline** → **Share** (top bar). Add the people or a group (e.g. your team's Microsoft 365 group) and click **Share**.
3. They also need **read** access to the **Processes** list. Everyone with access to the site usually already has it.

## G. Put it on your SharePoint page
1. On make.powerapps.com → **Apps** → select **Process Timeline** → **Details** tab → copy the **Web link** (or the **App ID**).
2. Open your SharePoint page → **Edit** (top right) → **+** where you want it (or the **Toolbox** → **See all web parts**) → **Power Apps**.
3. Click **Add an app**. In the pane on the right, paste into **App web link or ID**.
4. Drag the resize handle (bottom right of the web part) to fit. The app is landscape, so put it in a **full-width / one-column** section.
5. **Republish** the page.

**Link to one process:** add `&code=FS07` to the web link (or `?code=FS07` if the link has no `?` yet). The app reads it with `Param("code")`.

## How it works (for whoever maintains it)
- `btnLoad` (hidden) turns the selected row's `Data` JSON into the collection `colRows`: stage rows and step rows in display order, with `n, k, s, num, title, color, role, count, hint, detail`. The Office Script builds `detail` as safe HTML, so the app just shows it in `htmlDetail`.
- Variables: `varSel` (selected row; 0 shows the process overview), `varOpen` (open stage), `varAll` (all stages open), `varRole` (the "Show me as" role; other people's steps are greyed out).
- Search matches step titles, roles and the detail text (documents, notes).

## Sources
- [Create a blank canvas app](https://learn.microsoft.com/power-apps/maker/canvas-apps/create-blank-app)
- [Code view: copy and paste code](https://learn.microsoft.com/power-apps/maker/canvas-apps/code-view) and [pa.yaml format](https://learn.microsoft.com/power-apps/maker/canvas-apps/power-apps-yaml): versions are optional; without one, the current control is used
- [Data row limit](https://learn.microsoft.com/power-apps/maker/canvas-apps/delegation-overview#changing-the-limit)
- [Use the Power Apps web part](https://support.microsoft.com/office/use-the-power-apps-web-part-6285f05e-e441-408a-99d7-aa688195cd1c)
