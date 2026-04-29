import type { DonationsCryptoService } from "@/types/public-pages";

export const DEFAULT_DONATIONS_CRYPTO_ICON = "Coins";
export const DEFAULT_DONATIONS_CRYPTO_ACTION_LABEL = "Abrir carteira";
export const DEFAULT_DONATIONS_CRYPTO_SECTION_TITLE = "Criptomoedas";

export const emptyDonationsCryptoService: DonationsCryptoService = {
  name: "",
  ticker: "",
  network: "",
  address: "",
  qrValue: "",
  note: "",
  icon: DEFAULT_DONATIONS_CRYPTO_ICON,
  actionLabel: "",
  actionUrl: "",
};

const trimString = (value: string | undefined) => String(value || "").trim();

export const normalizeDonationsCryptoService = (
  service: Partial<DonationsCryptoService> | null | undefined,
): DonationsCryptoService => ({
  ...emptyDonationsCryptoService,
  ...service,
  name: trimString(service?.name),
  ticker: trimString(service?.ticker),
  network: trimString(service?.network),
  address: trimString(service?.address),
  qrValue: trimString(service?.qrValue),
  note: trimString(service?.note),
  icon: trimString(service?.icon) || DEFAULT_DONATIONS_CRYPTO_ICON,
  actionLabel: trimString(service?.actionLabel),
  actionUrl: trimString(service?.actionUrl),
});

export const normalizeDonationsCryptoServices = (
  services: Partial<DonationsCryptoService>[] | DonationsCryptoService[] | null | undefined,
) => {
  if (!Array.isArray(services)) {
    return [] as DonationsCryptoService[];
  }

  return services.map((service) => normalizeDonationsCryptoService(service));
};

export const isRenderableDonationsCryptoService = (
  service: Partial<DonationsCryptoService> | DonationsCryptoService | null | undefined,
) => {
  const normalized = normalizeDonationsCryptoService(service);
  return normalized.name.length > 0 && normalized.address.length > 0;
};

export const getDonationsCryptoQrValue = (
  service: Partial<DonationsCryptoService> | DonationsCryptoService | null | undefined,
) => {
  const normalized = normalizeDonationsCryptoService(service);
  return normalized.qrValue || normalized.address;
};

export const getDonationsCryptoMeta = (
  service: Partial<DonationsCryptoService> | DonationsCryptoService | null | undefined,
) => {
  const normalized = normalizeDonationsCryptoService(service);
  return [normalized.ticker, normalized.network].filter(Boolean).join(" / ");
};

export const getDonationsCryptoActionLabel = (
  service: Partial<DonationsCryptoService> | DonationsCryptoService | null | undefined,
) => {
  const normalized = normalizeDonationsCryptoService(service);
  return normalized.actionLabel || DEFAULT_DONATIONS_CRYPTO_ACTION_LABEL;
};
