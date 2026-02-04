import HeroSection from "@/components/HeroSection";
import ReleasesSection from "@/components/ReleasesSection";
import { usePageMeta } from "@/hooks/use-page-meta";

const Index = () => {
  usePageMeta({ title: "InÃ­cio" });

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <ReleasesSection />
    </div>
  );
};

export default Index;


