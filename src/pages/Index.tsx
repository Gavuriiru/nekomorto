import HeroSection from "@/components/HeroSection";
import ReleasesSection from "@/components/ReleasesSection";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useResolvedPublicBootstrap } from "@/hooks/public-bootstrap-provider";

const Index = () => {
  const bootstrap = useResolvedPublicBootstrap();
  const shareImage = bootstrap?.pages.home.shareImage || "";
  const shareImageAlt = bootstrap?.pages.home.shareImageAlt || "";
  const pageMediaVariants = bootstrap?.mediaVariants || {};

  usePageMeta({
    description:
      "Nekomata é uma fansub e scan feita por fãs, com traduções cuidadosas, carinho pela comunidade e respeito aos autores.",
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
