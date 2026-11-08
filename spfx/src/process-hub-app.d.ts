declare module 'process-hub-app' {
  export interface EmbedConfig {
    /** address of the SharePoint folder with the Signavio .bpmn files */
    folder?: string;
    /** show the demonstration processes next to the real ones */
    showSamples?: boolean;
    /** the signed-in viewer; files cached for someone else are dropped */
    user?: string;
  }
  /** Draws Process Hub into the element (inside a shadow root). */
  export function mount(host: HTMLElement, config?: EmbedConfig): { unmount: () => void; update: (c: EmbedConfig) => void };
}
