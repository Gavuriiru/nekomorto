type RegisterSwOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
};

type RegisterSwUpdate = (reloadPage?: boolean) => Promise<void>;

export const registerSW = (_options: RegisterSwOptions = {}): RegisterSwUpdate => {
  return async () => {};
};
