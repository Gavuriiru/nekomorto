import QRCode from "qrcode";

const QR_PLACEHOLDER_URL = "/placeholder.svg";
const GUI = "br.gov.bcb.pix";
const DEFAULT_TXID = "***";
const MERCHANT_ACCOUNT_TEMPLATE_MAX_LENGTH = 99;

const encodeField = (id, value) => {
  if (!id || value.length > 99) {
    return "";
  }
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
};

const sanitizeAsciiText = (value, maxLength) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeTxid = (value) => {
  const normalized = sanitizeAsciiText(value || DEFAULT_TXID, 25);
  return normalized || DEFAULT_TXID;
};

const crc16CcittFalse = (value) => {
  let crc = 0xffff;
  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

const buildStaticPixPayload = ({
  pixKey,
  merchantName,
  merchantCity,
  additionalInfo,
  txid,
}) => {
  const normalizedPixKey = String(pixKey || "").trim();
  const normalizedMerchantName = sanitizeAsciiText(merchantName, 25);
  const normalizedMerchantCity = sanitizeAsciiText(merchantCity, 15);
  const normalizedAdditionalInfo = sanitizeAsciiText(additionalInfo || "", 99);
  const normalizedTxid = normalizeTxid(txid);

  if (!normalizedPixKey || !normalizedMerchantName || !normalizedMerchantCity) {
    return "";
  }

  const merchantAccountGuiField = encodeField("00", GUI);
  const merchantAccountPixKeyField = encodeField("01", normalizedPixKey);
  if (!merchantAccountGuiField || !merchantAccountPixKeyField) {
    return "";
  }

  const merchantAccountBase = merchantAccountGuiField + merchantAccountPixKeyField;
  if (!merchantAccountBase || merchantAccountBase.length > MERCHANT_ACCOUNT_TEMPLATE_MAX_LENGTH) {
    return "";
  }

  let merchantAccountInformation = merchantAccountBase;
  if (normalizedAdditionalInfo) {
    const maxAdditionalInfoLength = Math.min(
      normalizedAdditionalInfo.length,
      MERCHANT_ACCOUNT_TEMPLATE_MAX_LENGTH - merchantAccountBase.length - 4,
    );
    if (maxAdditionalInfoLength > 0) {
      const additionalInfoField = encodeField(
        "02",
        normalizedAdditionalInfo.slice(0, maxAdditionalInfoLength),
      );
      if (additionalInfoField) {
        merchantAccountInformation += additionalInfoField;
      }
    }
  }

  const additionalDataFieldTemplate = encodeField("62", encodeField("05", normalizedTxid));
  if (!additionalDataFieldTemplate) {
    return "";
  }

  const payloadWithoutCrc =
    encodeField("00", "01") +
    encodeField("26", merchantAccountInformation) +
    encodeField("52", "0000") +
    encodeField("53", "986") +
    encodeField("58", "BR") +
    encodeField("59", normalizedMerchantName) +
    encodeField("60", normalizedMerchantCity) +
    additionalDataFieldTemplate +
    "6304";

  if (!payloadWithoutCrc) {
    return "";
  }

  return `${payloadWithoutCrc}${crc16CcittFalse(payloadWithoutCrc)}`;
};

const toQrDataUrl = async (value, fallbackUrl = QR_PLACEHOLDER_URL) => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return fallbackUrl;
  }
  try {
    return await QRCode.toDataURL(normalizedValue, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch {
    return fallbackUrl;
  }
};

export const buildPublicDonationsRoutePayload = async ({
  donationsPage,
  merchantName,
} = {}) => {
  const donations = donationsPage && typeof donationsPage === "object" ? donationsPage : {};
  const pixQrCodeUrl =
    String(donations.qrCustomUrl || "").trim() ||
    (await toQrDataUrl(
      buildStaticPixPayload({
        pixKey: String(donations.pixKey || "").trim(),
        merchantName: String(merchantName || "").trim(),
        merchantCity: String(donations.pixCity || "").trim() || "CIDADE",
        additionalInfo: String(donations.pixNote || ""),
        txid: DEFAULT_TXID,
      }),
    ));

  const cryptoServices = Array.isArray(donations.cryptoServices) ? donations.cryptoServices : [];
  const cryptoQrCodeUrls = {};
  await Promise.all(
    cryptoServices.map(async (service, index) => {
      const normalizedCustomUrl = String(service?.qrValue || "").trim();
      const qrValue = normalizedCustomUrl || String(service?.address || "").trim();
      const qrCodeUrl = await toQrDataUrl(qrValue);
      if (qrCodeUrl) {
        cryptoQrCodeUrls[String(index)] = qrCodeUrl;
      }
    }),
  );

  return {
    pixQrCodeUrl,
    cryptoQrCodeUrls,
  };
};
