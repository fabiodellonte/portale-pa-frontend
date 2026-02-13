/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_BUILD_COMMIT?: string;
  readonly VITE_APP_BUILD_DATE?: string;
}

declare const __APP_VERSION__: string;
declare const __APP_BUILD_COMMIT__: string;
declare const __APP_BUILD_DATE__: string;
