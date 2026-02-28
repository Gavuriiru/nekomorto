import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildStaticPixPayload } from "@/lib/pix";

type UsePixQrCodeParams = {
  pixKey: string;
  pixNote?: string;
  pixCity?: string;
  qrCustomUrl?: string;
  merchantName: string;
};

const QR_PLACEHOLDER_URL = "/placeholder.svg";

export const usePixQrCode = ({
  pixKey,
  pixNote,
  pixCity,
  qrCustomUrl,
  merchantName,
}: UsePixQrCodeParams) => {
  const [qrCodeUrl, setQrCodeUrl] = useState(QR_PLACEHOLDER_URL);

  useEffect(() => {
    const customUrl = String(qrCustomUrl || "").trim();
    if (customUrl) {
      setQrCodeUrl(customUrl);
      return;
    }

    const normalizedPixKey = String(pixKey || "").trim();
    if (!normalizedPixKey) {
      setQrCodeUrl(QR_PLACEHOLDER_URL);
      return;
    }

    const payload = buildStaticPixPayload({
      pixKey: normalizedPixKey,
      merchantName,
      merchantCity: pixCity || "",
      additionalInfo: pixNote || "",
      txid: "***",
    });

    if (!payload) {
      setQrCodeUrl(QR_PLACEHOLDER_URL);
      return;
    }

    let active = true;

    void QRCode.toDataURL(payload, {
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
  }, [merchantName, pixCity, pixKey, pixNote, qrCustomUrl]);

  return qrCodeUrl;
};
