/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPS_SCRIPT_URL?: string;
  readonly VITE_GOOGLE_SPREADSHEET_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
