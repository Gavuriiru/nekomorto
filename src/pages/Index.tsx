import { useEffect, useState } from "react";
import HeroSection from "@/components/HeroSection";
import ReleasesSection from "@/components/ReleasesSection";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";

const Index = () => {
  const apiBase = getApiBase();
  const [shareImage, setShareImage] = useState("");

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

  usePageMeta({ title: "Início", image: shareImage || undefined });

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <ReleasesSection />
    </div>
  );
};

export default Index;
