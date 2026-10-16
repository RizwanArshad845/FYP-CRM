// Type declarations for the Electron preload bridge (window.electronAPI)
// This lets TypeScript know what is safely exposed from electron/preload.cjs

export {};

declare global {
  interface Window {
    electronAPI?: {
      /** Returns the app version string from package.json */
      getAppVersion: () => string | undefined;

      /** Returns the backend port (null in current Vercel setup) */
      getBackendPort: () => Promise<number | null>;

      /**
       * Subscribe to auto-update status events from the main process.
       * @param callback Called with 'downloading' or 'ready'
       */
      onUpdateStatus: (callback: (status: 'downloading' | 'ready') => void) => void;

      /** Remove the update-status IPC listener (call on component unmount) */
      removeUpdateListener: () => void;
    };
  }
}
