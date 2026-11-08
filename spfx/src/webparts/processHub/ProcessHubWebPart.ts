import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { type IPropertyPaneConfiguration, PropertyPaneTextField, PropertyPaneToggle } from '@microsoft/sp-property-pane';
import { mount } from 'process-hub-app';

export interface IProcessHubWebPartProps {
  bpmnFolder: string;
  showSamples: boolean;
}

// The app is a normal script file in the package (no inline script, no eval), so it runs under SharePoint's
// content security policy. It draws into a shadow root, so its styles can't leak into the page.
export default class ProcessHubWebPart extends BaseClientSideWebPart<IProcessHubWebPartProps> {
  private _app?: ReturnType<typeof mount>;

  private get _config(): { folder: string; showSamples: boolean; user: string } {
    return {
      folder: (this.properties.bpmnFolder || '').trim(),
      showSamples: this.properties.showSamples !== false,
      user: this.context.pageContext.user.loginName
    };
  }

  public render(): void {
    if (!this._app) this._app = mount(this.domElement, this._config);
  }

  // apply the edited properties when the editor leaves the field (not on every keystroke)
  protected get disableReactivePropertyChanges(): boolean { return true; }
  protected onPropertyPaneFieldChanged(): void { if (this._app) this._app.update(this._config); }

  protected onDispose(): void {
    if (this._app) this._app.unmount();
    this._app = undefined;
  }

  protected get dataVersion(): Version { return Version.parse('1.0'); }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [{
        header: { description: 'Process Hub' },
        groups: [{
          groupName: 'Signavio processes',
          groupFields: [
            PropertyPaneTextField('bpmnFolder', {
              label: 'Folder with the .bpmn files',
              description: 'Open the folder in SharePoint and paste its address. Everyone who opens this page reads it with their own access. Sub-folders are read too.',
              placeholder: 'https://contoso.sharepoint.com/sites/Ops/BPMN'
            }),
            PropertyPaneToggle('showSamples', { label: 'Show sample processes', onText: 'Shown, labelled "Sample"', offText: 'Hidden' })
          ]
        }]
      }]
    };
  }
}
