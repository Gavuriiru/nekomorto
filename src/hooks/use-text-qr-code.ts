import { useEffect, useState } from "react";
import QRCode from "qrcode";

export const QR_PLACEHOLDER_URL = "/placeholder.svg";

type UseTextQrCodeParams = {
  value?: string;
  customUrl?: string;
};

export const useTextQrCode = ({ value, customUrl }: UseTextQrCodeParams) => {
  const [qrCodeUrl, setQrCodeUrl] = useState(QR_PLACEHOLDER_URL);

  useEffect(() => {
    const normalizedCustomUrl = String(customUrl || "").trim();
    if (normalizedCustomUrl) {
      setQrCodeUrl(normalizedCustomUrl);
      return;
    }

    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
      setQrCodeUrl(QR_PLACEHOLDER_URL);
      return;
    }

    let active = true;

    void QRCode.toDataURL(normalizedValue, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => {
        if (active) {
          setQrCodeUrl(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setQrCodeUrl(QR_PLACEHOLDER_URL);
        }
      });

    return () => {
      active = false;
    };
  }, [customUrl, value]);

  return qrCodeUrl;
};
