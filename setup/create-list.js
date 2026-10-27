/*
 * One-time setup: creates the "Processes" list that the flow writes to and the Power App reads.
 *
 * How to run (no admin needed — it uses your own sign-in):
 *   1. Open any page of the SharePoint site in Edge or Chrome, e.g. https://<tenant>.sharepoint.com/sites/<site>
 *   2. Press F12 → Console tab
 *   3. Paste this whole file and press Enter. (If the browser asks, type "allow pasting" first.)
 *   4. Wait for "Done". Running it again is safe: existing list/columns are skipped.
 * If the console is blocked on your laptop, create the columns by hand — see README.md → "Create the list by hand".
 */
(async () => {
  const LIST = 'Processes'
  const site = (window._spPageContextInfo && _spPageContextInfo.webAbsoluteUrl) ||
    location.origin + (location.pathname.match(/^\/(sites|teams)\/[^/]+/) || [''])[0]
  const columns = [
    '<Field Type="Text" Name="Code" DisplayName="Code" MaxLength="50" />',
    '<Field Type="Text" Name="FileId" DisplayName="FileId" MaxLength="50" Indexed="TRUE" />',
    '<Field Type="Text" Name="FileName" DisplayName="FileName" MaxLength="255" />',
    '<Field Type="Note" Name="FileUrl" DisplayName="FileUrl" NumLines="2" RichText="FALSE" />',
    '<Field Type="Text" Name="Owner" DisplayName="Owner" MaxLength="255" />',
    '<Field Type="Note" Name="Summary" DisplayName="Summary" NumLines="4" RichText="FALSE" />',
    '<Field Type="Number" Name="StepCount" DisplayName="StepCount" Decimals="0" />',
    '<Field Type="Text" Name="Status" DisplayName="Status" MaxLength="20" />',
    '<Field Type="Note" Name="Message" DisplayName="Message" NumLines="3" RichText="FALSE" />',
    '<Field Type="Note" Name="Data" DisplayName="Data" NumLines="6" RichText="FALSE" UnlimitedLengthInDocumentLibrary="TRUE" />',
  ]

  const digest = (await (await fetch(`${site}/_api/contextinfo`, { method: 'POST', headers: { Accept: 'application/json;odata=nometadata' } })).json()).FormDigestValue
  const call = async (url, body) => {
    const res = await fetch(`${site}/_api/${url}`, {
      method: body ? 'POST' : 'GET',
      headers: { Accept: 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest },
      body: body && JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`)
    return res.status === 204 ? null : res.json()
  }
  const list = `web/lists/getbytitle('${LIST}')`

  try { await call(list); console.log(`List "${LIST}" already exists`) } catch {
    await call('web/lists', { __metadata: { type: 'SP.List' }, Title: LIST, BaseTemplate: 100, Description: 'Readable processes made from the Signavio BPMN files (filled by the "Sync processes" flow).' })
    console.log(`Created list "${LIST}"`)
  }
  const have = (await call(`${list}/fields?$select=InternalName`)).d.results.map((f) => f.InternalName)
  for (const xml of columns) {
    const name = xml.match(/Name="(\w+)"/)[1]
    if (have.includes(name)) { console.log(`  column ${name}: already there`); continue }
    // 8 = keep the internal name, 16 = add to the default view (not Data: it's a long JSON text)
    await call(`${list}/fields/CreateFieldAsXml`, { parameters: { __metadata: { type: 'SP.XmlSchemaFieldCreationInformation' }, SchemaXml: xml, Options: name === 'Data' ? 8 : 24 } })
    console.log(`  column ${name}: created`)
  }
  console.log(`Done — ${site}/Lists/${LIST}`)
})().catch((e) => console.error('Setup failed:', e.message))
