/// <reference types="vite/client" />

declare const __COMMIT_SHA__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  /** Optional URL of the anonymous feedback endpoint (see server/). Empty = feedback stays on the device. */
  readonly VITE_FEEDBACK_ENDPOINT?: string;
  /** Origin of the feedback endpoint, injected into the Content-Security-Policy of index.html. */
  readonly VITE_FEEDBACK_ORIGIN?: string;
  /** Public URL of the source repository shown in the footer and transparency page. */
  readonly VITE_REPO_URL?: string;
  /** Name of the data controller (responsable de traitement) shown in the privacy policy. */
  readonly VITE_OPERATOR_NAME?: string;
  /** Contact e-mail for data-protection requests. */
  readonly VITE_OPERATOR_CONTACT?: string;
  readonly VITE_BASE_PATH?: string;
}
