/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Account-level ByteFlow API key (UI GEN 2.0). Written to a gitignored .env
   *  at project creation; inlined into the build by Vite. */
  readonly VITE_BYTEFLOW_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
