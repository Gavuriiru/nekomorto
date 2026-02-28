type BuildStaticPixPayloadParams = {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  additionalInfo?: string;
  txid?: string;
};

const GUI = "br.gov.bcb.pix";
const DEFAULT_TXID = "***";
const MERCHANT_ACCOUNT_TEMPLATE_MAX_LENGTH = 99;

const encodeField = (id: string, value: string) => {
  if (!id || value.length > 99) {
    return "";
  }

  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
};

const sanitizeAsciiText = (value: string, maxLength: number) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeTxid = (value: string | undefined) => {
  const normalized = sanitizeAsciiText(value || DEFAULT_TXID, 25);
  return normalized || DEFAULT_TXID;
};

const crc16CcittFalse = (value: string) => {
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

export const buildStaticPixPayload = ({
  pixKey,
  merchantName,
  merchantCity,
  additionalInfo,
  txid,
}: BuildStaticPixPayloadParams) => {
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
