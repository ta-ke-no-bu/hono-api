// これらのインターフェースに関する情報は https://svelte.dev/docs/kit/types#app.d.ts を参照してください
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user: {
        id: number;
        email: string;
      } | null;
      nonce: string;
      token?: string;
      apiBase: string;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
  interface ImportMetaEnv {
    ADMIN_BASE_URL?: string;
    ADMIN_PORT?: string;
    ADMIN_API_PROXY_URL?: string;
    WEB_BASE_URL?: string;
    WEB_BASE_PATH?: string;
    PUBLIC_ASSET_BASE_URL?: string;
  }
}

export {};
