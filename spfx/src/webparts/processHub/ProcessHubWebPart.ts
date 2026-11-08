import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { mount } from 'process-hub-app';

// The app is a normal script file in the package (no inline script, no eval), so it runs under SharePoint's
// content security policy. It draws into a shadow root, so its styles can't leak into the page.
export default class ProcessHubWebPart extends BaseClientSideWebPart<Record<string, never>> {
  private _unmount?: () => void;

  public render(): void {
    if (!this._unmount) this._unmount = mount(this.domElement);
  }

  protected onDispose(): void {
    if (this._unmount) this._unmount();
    this._unmount = undefined;
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }
}
