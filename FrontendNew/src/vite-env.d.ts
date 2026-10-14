/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API
  readonly VITE_API_URL: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_PREVIEW_HOST: string
  readonly VITE_GROQ_API_KEY: string

  // Firebase
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID: string

  // Product admin access
  readonly VITE_PRODUCT_ADMIN_EMAILS: string
  readonly VITE_ENABLE_DEV_PRODUCT_ADMIN_FALLBACK: string
  readonly VITE_ENABLE_PROD_SUPERADMIN_HARDCODED_LOGIN: string

  // Dev test accounts (only active when VITE_ENABLE_DEV_TEST_ACCOUNTS=true in dev mode)
  readonly VITE_ENABLE_DEV_TEST_ACCOUNTS: string
  readonly VITE_DEV_ADMIN_EMAIL: string
  readonly VITE_DEV_ADMIN_PASSWORD: string
  readonly VITE_DEV_SUPER_ADMIN_EMAIL: string
  readonly VITE_DEV_SUPER_ADMIN_PASSWORD: string
  readonly VITE_DEV_SUPER_ADMIN_PASSWORD_ALT: string
  readonly VITE_DEV_INSPECTOR_EMAIL: string
  readonly VITE_DEV_INSPECTOR_PASSWORD: string
  readonly VITE_DEV_ENGINEER_EMAIL: string
  readonly VITE_DEV_ENGINEER_PASSWORD: string
  readonly VITE_DEV_WORKER_EMAIL: string
  readonly VITE_DEV_WORKER_PASSWORD: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}
