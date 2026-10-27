# Power Automate flows (step by step, new designer)

You'll build two flows at <https://make.powerautomate.com>. Both use only standard connectors (SharePoint, Excel Online (Business), Notifications), so you don't need a premium licence or an admin.

| Flow | Type | What it does |
| --- | --- | --- |
| **Sync processes** | Automated | When a `.bpmn` file is added or changed in the folder, it reads the file and creates or updates its row in the **Processes** list |
| **Remove deleted processes** | Scheduled, daily | Deletes rows whose BPMN file is gone |

> **Why daily cleanup instead of a "deleted" trigger?** SharePoint's *When a file is deleted* trigger "can only be used by site collection admins".

**Before you start**, finish steps 1–3 of the main README: the **Processes** list, the **Processes** folder, the **ProcessParser.xlsx** workbook, and the **parseBpmn** script.

---

## How the designer works (read once)

These instructions use the **new designer**. If your screen looks different, check the **New designer** toggle at the top right and turn it **on**.

| To… | Do this |
| --- | --- |
| Add a step | Click **+** under a card → **Add an action** → type the action name in the search box → click it |
| Fill a field | Click the card. The **Parameters** tab opens in the pane on the left |
| Find hidden fields | In the Parameters tab, open **Advanced parameters** → **Show all**, or tick the one you need |
| Type an expression | Click in the field → type **/** → **Insert expression** → paste the expression → **Add** |
| Use a value from an earlier step | Click in the field → type **/** → **Insert dynamic content** → pick it |
| Rename a step | Click the card, then click its **name at the top of the pane** and type the new name |
| Find settings | Click the card → **Settings** tab (next to Parameters) |

> **Rename every step exactly as shown** (e.g. `BPMN text`). The expressions refer to steps by name, with spaces replaced by `_` (`BPMN text` → `BPMN_text`). If you see "The template validation failed", a name doesn't match.

---

## Flow 1: Sync processes

1. In the left menu click **Create** → **Automated cloud flow**.
2. **Flow name:** `Sync processes`. In **Choose your flow's trigger**, search for `When a file is created or modified (properties only)`, select the **SharePoint** one, then click **Create**.

### Step 1: trigger, *When a file is created or modified (properties only)*
**Parameters** tab:

| Field | Value |
| --- | --- |
| Site Address | pick your site from the list |
| Library Name | pick your document library (usually **Documents**) |
| Folder | click the folder icon and choose **/Processes** (it may show as `/Shared Documents/Processes`) |

**Settings** tab:
- **Trigger conditions** → **+ Add** → paste:
  ```
  @endsWith(toLower(triggerBody()?['{FilenameWithExtension}']), '.bpmn')
  ```
- **Concurrency control** → turn **On** → set **Degree of parallelism** to **1**. Files are then handled one at a time, so two uploads never create duplicate rows. (Microsoft notes this can't be turned off later without re-adding the trigger. That's fine here.)

### Step 2: *Scope*, renamed `Parse and save`
**+** → **Add an action** → search `Scope` → **Scope** (Control). Rename it to `Parse and save`.
**Add steps 3–8 inside the scope.** Use the **+** that appears *inside* the Scope box.

### Step 3: SharePoint *Get file content* (keep the name `Get file content`)
| Field | Value |
| --- | --- |
| Site Address | your site |
| File Identifier | **/** → **Insert dynamic content** → **Identifier** (under the trigger) |
| Infer content type *(Advanced parameters)* | **No** |

### Step 4: *Compose*, renamed `BPMN text`
Search `Compose` → **Compose** (Data Operation). **Inputs** → **/** → **Insert expression**:
```
base64ToString(body('Get_file_content')?['$content'])
```

### Step 5: Excel Online (Business) *Run script* (keep the name `Run script`)
Search `Run script` → **Run script** (Excel Online (Business)). Sign in if asked.

| Field | Value |
| --- | --- |
| Location | your SharePoint site (the site where ProcessParser.xlsx is) |
| Document Library | **Documents** (the library with ProcessParser.xlsx) |
| File | click the folder icon → **ProcessParser.xlsx** |
| Script | **parseBpmn** |

After you pick the script, two more fields appear (they come from the script's parameters):

| Field | Value |
| --- | --- |
| xml | **/** → **Insert dynamic content** → **Outputs** (under *BPMN text*) |
| fileName | **/** → **Insert dynamic content** → **File name with extension** (under the trigger) |

> **Run script** only lists scripts saved in **your own** OneDrive (`Documents › Office Scripts`), which is where Excel saves them by default. If **parseBpmn** isn't listed, check you're signed in to Power Automate with the same account you used in Excel.

### Step 6: *Compose*, renamed `Parsed`
**Inputs** → **Insert expression**:
```
json(outputs('Run_script')?['body/result'])
```

### Step 7: SharePoint *Get items*, renamed `Find row`
| Field | Value |
| --- | --- |
| Site Address | your site |
| List Name | **Processes** |
| Filter Query *(Advanced parameters)* | type `FileId eq '` then **/** → **Insert dynamic content** → **ID** (under the trigger), then type `'`. The result looks like `FileId eq '[ID]'` |
| Top Count *(Advanced parameters)* | `1` |

### Step 8: *Condition*, renamed `Row exists`
Search `Condition` → **Condition** (Control). Fill in the single row:
- **Choose a value** (left) → **Insert expression**: `length(outputs('Find_row')?['body/value'])`
- operator → **is greater than**
- **Choose a value** (right) → `0`

**True** branch → **+** → SharePoint **Update item**, renamed `Update row`:
- Site Address: your site · List Name: **Processes**
- **Id** → Insert expression: `first(outputs('Find_row')?['body/value'])?['ID']`

**False** branch → **+** → SharePoint **Create item**, renamed `Create row`:
- Site Address: your site · List Name: **Processes**

In **both** actions, the list's columns appear as fields (open **Advanced parameters → Show all** if some are hidden). Fill each with **Insert expression**:

| Column | Expression |
| --- | --- |
| Title | `coalesce(outputs('Parsed')?['title'], triggerBody()?['{Name}'])` |
| Code | `coalesce(outputs('Parsed')?['code'], '')` |
| FileId | `string(triggerBody()?['ID'])` |
| FileName | `triggerBody()?['{FilenameWithExtension}']` |
| FileUrl | `triggerBody()?['{Link}']` |
| Owner | `coalesce(outputs('Parsed')?['owner'], '')` |
| Summary | `coalesce(outputs('Parsed')?['summary'], '')` |
| StepCount | `coalesce(outputs('Parsed')?['stepCount'], 0)` |
| Status | `if(empty(outputs('Parsed')?['error']), 'OK', 'Error')` |
| Message | `concat(coalesce(outputs('Parsed')?['error'], ''), join(coalesce(outputs('Parsed')?['warnings'], createArray()), ' '))` |
| Data, in **Update row** | `if(empty(outputs('Parsed')?['error']), outputs('Run_script')?['body/result'], first(outputs('Find_row')?['body/value'])?['Data'])` |
| Data, in **Create row** | `if(empty(outputs('Parsed')?['error']), outputs('Run_script')?['body/result'], '')` |

If a new export is broken, the row keeps the **last good** version in `Data` and shows `Status = Error` with the reason in `Message`, so the page keeps working.

### Step 9: Notifications *Send me an email notification*, renamed `Tell me it failed`
Add it **below the Scope**, not inside it.
- **Subject** → type `Process sync failed: ` then **Insert dynamic content** → **File name with extension**
- **Body** → `Open Power Automate → My flows → Sync processes → run history for details.`
- **Settings** tab → **Run after** → expand **Parse and save** → untick **Is successful**, tick **Has failed** and **Has timed out**.

### Save and test
Click **Save**. If it shows an error, the card with the problem has a red mark. A wrong step name in an expression is the usual cause.
Then upload a Signavio `.bpmn` file to **/Processes**. Within about a minute (the trigger checks for changes periodically), a row appears in the **Processes** list with **Status = OK**. To watch it, open **My flows → Sync processes**. The run history is at the bottom.

---

## Flow 2: Remove deleted processes

1. **Create** → **Scheduled cloud flow**. **Flow name:** `Remove deleted processes`. **Repeat every:** `1` **Day**. Click **Create**.

### Step 1: SharePoint *Get files (properties only)*, renamed `Get files`
| Field | Value |
| --- | --- |
| Site Address / Library Name | your site / your library |
| Limit Entries to Folder *(Advanced parameters)* | **/Processes** |
| Include Nested Items *(Advanced parameters)* | **Yes** |

**Settings** tab → **Pagination** → **On**, **Threshold** `5000`.

### Step 2: *Select*, renamed `File ids`
Search `Select` → **Select** (Data Operation).
- **From** → Insert expression: `outputs('Get_files')?['body/value']`
- **Map**: click the **Switch Map to text mode** button next to Map, then Insert expression: `string(item()?['ID'])`

### Step 3: SharePoint *Get items*, renamed `All rows`
List Name **Processes**. **Settings** tab → **Pagination** → **On**, **Threshold** `5000`.

### Step 4: *Filter array*, renamed `Orphans`
- **From** → Insert expression: `outputs('All_rows')?['body/value']`
- Condition row: left → Insert expression `body('File_ids')` · operator **does not contain** · right → Insert expression `item()?['FileId']`

### Step 5: SharePoint *Delete item*
Add **Delete item**. Site Address: your site, List Name: **Processes**, **Id** → Insert expression `item()?['ID']`.
The designer wraps it in an **Apply to each** automatically. If it asks what to loop over, choose **Body** of *Orphans*.

**Save.** Click **Test → Manually → Test** once to check it runs.

---

## Re-processing every file
The Sync flow only runs when a file changes. After the parser script is updated, refresh every process: in the library, select all the `.bpmn` files, **Download** them, then **Upload** them again and choose **Replace**.

## Limits worth knowing
- **Run script:** 1,600 calls a day per user, a 120-second timeout per call, and up to 28.6 MB of parameters. A 400 KB BPMN file takes about 1 second.
- **Data column:** the script keeps each process under 60,000 characters and shortens long texts if needed (with a warning in `Message`).

## Sources
- [SharePoint connector reference](https://learn.microsoft.com/connectors/sharepointonline/): trigger and action fields, deleted-file trigger limitation
- [Explore the cloud flows designer](https://learn.microsoft.com/power-automate/flows-designer): Parameters/Settings tabs, Insert expression, Run after
- [Run Office Scripts with Power Automate](https://learn.microsoft.com/office/dev/scripts/develop/power-automate-integration) and [platform limits](https://learn.microsoft.com/office/dev/scripts/testing/platform-limits)
