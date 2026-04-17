import { useTextQrCode } from "@/hooks/use-text-qr-code";
import { buildStaticPixPayload } from "@/lib/pix";
import { useMemo } from "react";

type UsePixQrCodeParams = {
  pixKey: string;
  pixNote?: string;
  pixCity?: string;
  qrCustomUrl?: string;
  merchantName: string;
};

export const usePixQrCode = ({
  pixKey,
  pixNote,
  pixCity,
  qrCustomUrl,
  merchantName,
}: UsePixQrCodeParams) => {
  const payload = useMemo(() => {
    const normalizedPixKey = String(pixKey || "").trim();
    if (!normalizedPixKey) {
      return "";
    }

    return (
      buildStaticPixPayload({
        pixKey: normalizedPixKey,
        merchantName,
        merchantCity: pixCity || "",
        additionalInfo: pixNote || "",
        txid: "***",
      }) || ""
    );
  }, [merchantName, pixCity, pixKey, pixNote]);

  return useTextQrCode({ value: payload, customUrl: qrCustomUrl });
};
