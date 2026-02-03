import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ReleasesSection from "@/components/ReleasesSection";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const Index = () => {
  usePageMeta({ title: "Início" });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <ReleasesSection />
      <Footer />
    </div>
  );
};

export default Index;
