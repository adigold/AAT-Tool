/**
 * AAT (Admin Annotation Tool) settings. The only file you need to edit to fit your app.
 */
export const AAT_CONFIG = {
  /** Shown in the first line of every prompt: "Change request for <appName>". */
  appName: "my app",
  /** localStorage key prefix. Notes live in `${storagePrefix}.notes`, the admin hint in `${storagePrefix}.admin`. */
  storagePrefix: "aat",
  /**
   * Localhost only: where screenshots are POSTed so the prompt can point at a file in the project.
   * Set to "" to skip saving files; the prompt then asks you to paste the image instead.
   */
  shotEndpoint: "/api/dev/aat-shot",
};
