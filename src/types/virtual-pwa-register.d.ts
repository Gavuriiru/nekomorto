declare module "virtual:pwa-register" {
  export type RegisterSWOptions = {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  };

  export type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void> | void;

  export function registerSW(options?: RegisterSWOptions): UpdateServiceWorker;
}
