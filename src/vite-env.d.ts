/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Groq key for everyone, added when the site is built — from the GitHub secret GROQ_API_KEY
   * (see setup/github-pages-workflow.yml), or from .env.local when building on your own computer.
   */
  readonly VITE_GROQ_API_KEY?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
