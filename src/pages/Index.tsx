import { useEffect, useState } from "react";
import HeroSection from "@/components/HeroSection";
import ReleasesSection from "@/components/ReleasesSection";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

const Index = () => {
  const apiBase = getApiBase();
  const [shareImage, setShareImage] = useState("");
  const [shareImageAlt, setShareImageAlt] = useState("");
  const [pageMediaVariants, setPageMediaVariants] = useState<UploadMediaVariantsMap>({});

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/pages");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive) {
          setShareImage(String(data?.pages?.home?.shareImage || "").trim());
          setShareImageAlt(String(data?.pages?.home?.shareImageAlt || "").trim());
          setPageMediaVariants(
            data?.mediaVariants && typeof data.mediaVariants === "object" ? data.mediaVariants : {},
          );
        }
      } catch {
        // ignore
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  usePageMeta({
    title: "Início",
    image: shareImage || undefined,
    imageAlt: shareImageAlt || undefined,
    mediaVariants: pageMediaVariants,
  });

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <ReleasesSection />
    </div>
  );
};

export default Index;
