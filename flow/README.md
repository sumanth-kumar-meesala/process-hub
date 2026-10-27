# Power Automate flows

Two flows, both built at <https://make.powerautomate.com> with standard connectors only (SharePoint, Excel Online (Business), Notifications). No premium licence, no admin.

| Flow | Type | What it does |
| --- | --- | --- |
| **Sync processes** | Automated | A `.bpmn` file is added or changed in the folder → parse it → create or update its row in the **Processes** list |
| **Remove deleted processes** | Scheduled (daily) | Deletes rows whose BPMN file no longer exists |

> Names in `code font` are the action names used in the expressions. If you rename an action, update the expressions that use it (spaces become `_`, e.g. `Run script` → `Run_script`).

Before you start you need:
- the **Processes** list (`setup/create-list.js`)
- the folder for BPMN files, e.g. `Shared Documents/Processes`
- the Office Script **parseBpmn** saved in Excel (see the main README, step 3)
- an empty workbook **ProcessParser.xlsx** in the same library (the Run script action needs a workbook to open; the script doesn't touch it)

---

## Flow 1 — Sync processes

**Create → Automated cloud flow**, name it `Sync processes`. Trigger: **SharePoint – When a file is created or modified (properties only)**.

### 1. Trigger — `When a file is created or modified (properties only)`
| Field | Value |
| --- | --- |
| Site Address | your site |
| Library Name | your document library (e.g. Documents) |
| Folder | `/Processes` (pick it with the folder icon) |

Trigger **Settings**:
- **Trigger conditions** → add:
  ```
  @endsWith(toLower(triggerBody()?['{FilenameWithExtension}']), '.bpmn')
  ```
- **Concurrency control** → On, **Degree of parallelism 1**. Files are then processed one at a time, so two uploads can never create the same row twice.

### 2. Scope — `Parse and save`
Add a **Scope** action and put steps 3–8 inside it. Step 9 catches anything that fails inside it.

### 3. SharePoint – Get file content — `Get file content`
| Field | Value |
| --- | --- |
| Site Address | your site |
| File Identifier | `triggerBody()?['{Identifier}']` (dynamic content "Identifier") |
| Infer Content Type | **No** |

### 4. Data Operation – Compose — `BPMN text`
```
base64ToString(body('Get_file_content')?['$content'])
```

### 5. Excel Online (Business) – Run script — `Run script`
| Field | Value |
| --- | --- |
| Location | your SharePoint site (or OneDrive for Business) |
| Document Library | the library that holds `ProcessParser.xlsx` |
| File | `ProcessParser.xlsx` |
| Script | `parseBpmn` |
| xml | `outputs('BPMN_text')` |
| fileName | `triggerBody()?['{FilenameWithExtension}']` |

> The Run script action finds scripts in **the flow owner's** OneDrive (`Documents/Office Scripts`). If several people should maintain the flow, put `parseBpmn.osts` in a SharePoint library and use **Run script from SharePoint library** instead. The fields are the same.

### 6. Data Operation – Compose — `Parsed`
```
json(outputs('Run_script')?['body/result'])
```

### 7. SharePoint – Get items — `Find row`
| Field | Value |
| --- | --- |
| Site Address | your site |
| List Name | Processes |
| Filter Query | `FileId eq '@{triggerBody()?['ID']}'` |
| Top Count | 1 |

### 8. Condition — `Row exists`
`length(outputs('Find_row')?['body/value'])` **is greater than** `0`

**If yes → SharePoint – Update item** (`Update row`), Id = `first(outputs('Find_row')?['body/value'])?['ID']`
**If no → SharePoint – Create item** (`Create row`)

Fill in the same fields in both:

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
| Data | **Update row:** `if(empty(outputs('Parsed')?['error']), outputs('Run_script')?['body/result'], first(outputs('Find_row')?['body/value'])?['Data'])` <br> **Create row:** `if(empty(outputs('Parsed')?['error']), outputs('Run_script')?['body/result'], '')` |

If a new export of a file is broken, the row keeps the **last good** version in `Data` and shows `Status = Error` and the reason in `Message`. The page keeps working.

### 9. Notifications – Send me an email notification — `Tell me it failed`
Put it **after** the scope. Then **⋯ → Configure run after** and tick only **has failed** and **has timed out**.
| Field | Value |
| --- | --- |
| Subject | `Process sync failed: @{triggerBody()?['{FilenameWithExtension}']}` |
| Body | `See the flow run history for details.` |

**Save.** Test it by uploading a `.bpmn` file to the folder: a row appears in **Processes** with `Status = OK` within about a minute.

---

## Flow 2 — Remove deleted processes

**Create → Scheduled cloud flow**, name it `Remove deleted processes`, repeat every **1 day**.

(SharePoint's "When a file is deleted" trigger only works for site collection admins, so cleanup runs on a schedule instead.)

1. **SharePoint – Get files (properties only)** — `Get files`: Site Address, Library Name, **Limit Entries to Folder** = `/Processes`, **Include Nested Items** = Yes. Settings → **Pagination** On, threshold 5000.
2. **Data Operation – Select** — `File ids`: From `outputs('Get_files')?['body/value']`. Switch the map to text mode (the **T** icon) and enter `string(item()?['ID'])`
3. **SharePoint – Get items** — `All rows`: List Name `Processes`. Settings → Pagination On, threshold 5000.
4. **Data Operation – Filter array** — `Orphans`: From `outputs('All_rows')?['body/value']`, advanced mode:
   ```
   @not(contains(body('File_ids'), item()?['FileId']))
   ```
5. **Apply to each** over `body('Orphans')` → **SharePoint – Delete item**: List Name `Processes`, Id `items('Apply_to_each')?['ID']`

---

## Re-processing every file

The Sync flow only runs when a file changes. After the parser script is updated, refresh every process like this: in the library, select all the `.bpmn` files, **Download** them, then **Upload** them again with **Replace**. Each file changes, so the flow runs once for each.

## Limits worth knowing
- **Run script:** up to 1,600 calls a day per user, and 120 seconds per call. A 400 KB BPMN file takes about 1 second.
- **Data column:** the script keeps each process's JSON under 60,000 characters and shortens long texts (with a warning in `Message`) if needed.
