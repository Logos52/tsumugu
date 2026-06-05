/**
 * Browser host adapters for the engine ports: in-memory + File System Access
 * vault, Web Speech audio, and Anki `.apkg` export/download.
 */

export { MemoryVault, pickVaultFolder } from "./fsVault.js";
export { createHttpVault, devVaultAvailable } from "./httpVault.js";
export { createWebAudio } from "./webAudio.js";
export { exportAndDownloadApkg, downloadBytes } from "./anki.js";
