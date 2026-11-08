declare module 'process-hub-app' {
  /** Draws Process Hub into the element (inside a shadow root); returns a function that removes it. */
  export function mount(host: HTMLElement): () => void;
}
