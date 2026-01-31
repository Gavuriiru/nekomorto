import * as React from "react";
import heroImage from "@/assets/hero-illya.jpg";
import { Globe, Play } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

const heroSlides = [
  {
    id: "prisma-illya",
    title: "Fate/Kaleid Liner Prisma Illya",
    description:
      "Illya (Illyasviel von Einzbern) é uma típica estudante do Instituto Homurabara que tem uma quedinha por seu cunhado. Certa noite, uma varinha de condão chamada Cajado Rubi cai do céu em sua banheira e a faz assinar um contrato...",
    updatedAt: "2024-01-28T12:00:00Z",
    image: heroImage,
    projectId: "aurora-no-horizonte",
  },
  {
    id: "spy-family",
    title: "Spy x Family",
    description:
      "Loid precisa montar uma família falsa para cumprir a missão mais delicada de sua carreira. Entre uma espiã e uma telepata, tudo pode dar errado — e ficar ainda mais divertido.",
    updatedAt: "2024-01-25T12:00:00Z",
    image: heroImage,
    projectId: "rainbow-pulse",
  },
  {
    id: "jujutsu-kaisen",
    title: "Jujutsu Kaisen",
    description:
      "Yuji Itadori se envolve com maldições perigosas e encontra novos aliados na Escola Jujutsu. Cada episódio é uma luta intensa, cheia de energia e emoção.",
    updatedAt: "2024-01-22T12:00:00Z",
    image: heroImage,
    projectId: "iris-black",
  },
  {
    id: "frieren",
    title: "Frieren",
    description:
      "Após a derrota do Rei Demônio, Frieren parte em uma jornada que combina nostalgia e descobertas sobre a vida humana. Um roteiro sensível e contemplativo a cada episódio.",
    updatedAt: "2024-01-20T12:00:00Z",
    image: heroImage,
    projectId: "jardim-das-marés",
  },
  {
    id: "oshi-no-ko",
    title: "Oshi no Ko",
    description:
      "Nos bastidores do entretenimento, a história mistura idol, fama e mistérios. Cada episódio revela mais sobre o brilho e as sombras do estrelato.",
    updatedAt: "2024-01-18T12:00:00Z",
    image: heroImage,
    projectId: "nova-primavera",
  },
];

const HeroSection = () => {
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  const autoplayRef = React.useRef<number | null>(null);
  const resumeTimeoutRef = React.useRef<number | null>(null);
  const latestSlideId = React.useMemo(() => {
    return heroSlides.reduce((latest, current) => {
      if (!latest) {
        return current;
      }
      return new Date(current.updatedAt).getTime() > new Date(latest.updatedAt).getTime()
        ? current
        : latest;
    }, heroSlides[0])?.id;
  }, []);

  const stopAutoplay = React.useCallback(() => {
    if (autoplayRef.current !== null) {
      window.clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  }, []);

  const startAutoplay = React.useCallback(() => {
    if (!api) {
      return;
    }
    stopAutoplay();
    autoplayRef.current = window.setInterval(() => {
      api.scrollNext();
    }, 6000);
  }, [api, stopAutoplay]);

  const scheduleAutoplayResume = React.useCallback(() => {
    stopAutoplay();
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
    }
    resumeTimeoutRef.current = window.setTimeout(() => {
      startAutoplay();
    }, 5000);
  }, [startAutoplay, stopAutoplay]);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    startAutoplay();

    return () => {
      stopAutoplay();
      if (resumeTimeoutRef.current !== null) {
        window.clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, [api, startAutoplay, stopAutoplay]);

  return (
    <section className="relative min-h-screen overflow-hidden">
      <Carousel opts={{ loop: true }} setApi={setApi} className="min-h-screen">
        <CarouselContent className="ml-0">
          {heroSlides.map((slide) => (
            <CarouselItem key={slide.id} className="pl-0">
              <div className="relative min-h-screen flex items-end overflow-hidden">
                {/* Background Image - positioned to show character on the right */}
                <div
                  className="absolute inset-0 bg-cover bg-right-top md:bg-center bg-no-repeat scale-105"
                  style={{ backgroundImage: `url(${slide.image})` }}
                />

                {/* Gradient Overlay - darker on the left for text readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />

                {/* Bottom gradient for smooth transition */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

                {/* Content */}
                <div className="relative z-10 w-full px-6 md:px-12 pb-16 md:pb-24">
                  <div className="max-w-3xl">
                    {/* Badge for latest release */}
                    {slide.id === latestSlideId ? (
                      <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold uppercase tracking-wider rounded-full animate-fade-in border bg-[color:var(--hero-badge-bg,hsl(var(--primary)/0.2))] text-[color:var(--hero-badge-text,hsl(var(--primary)))] border-[color:var(--hero-badge-border,hsl(var(--primary)/0.3)))]">
                        Último Lançamento
                      </span>
                    ) : null}

                    <h1 className="text-4xl md:text-6xl lg:text-7xl xl:text-8xl 2xl:text-9xl font-black mb-6 animate-slide-up text-foreground leading-tight">
                      {slide.title}
                    </h1>

                    <p
                      className="text-base md:text-lg xl:text-xl 2xl:text-2xl text-muted-foreground leading-relaxed max-w-2xl animate-slide-up opacity-0"
                      style={{ animationDelay: "0.2s" }}
                    >
                      {slide.description}
                    </p>

                    <div
                      className="mt-8 flex flex-wrap gap-4 animate-slide-up opacity-0"
                      style={{ animationDelay: "0.4s" }}
                    >
                      <Link
                        to={`/projeto/${slide.projectId}`}
                        className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all hover:scale-105 hover:brightness-110 bg-[color:var(--hero-accent,hsl(var(--primary)))] text-[color:var(--hero-accent-foreground,hsl(var(--primary-foreground)))]"
                      >
                        <Globe className="h-4 w-4" />
                        Acessar Página
                      </Link>
                      <button className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all hover:scale-105 border border-border/40 bg-background/70 text-foreground hover:bg-background/90">
                        <Play className="h-4 w-4" />
                        Assistir Trailer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious
          className="hidden md:flex left-auto right-20 bottom-8 top-auto h-9 w-9 translate-y-0 bg-background/50 hover:bg-background/70 border border-border/30 text-muted-foreground"
          onClick={scheduleAutoplayResume}
        />
        <CarouselNext
          className="hidden md:flex right-8 bottom-8 top-auto h-9 w-9 translate-y-0 bg-background/50 hover:bg-background/70 border border-border/30 text-muted-foreground"
          onClick={scheduleAutoplayResume}
        />
      </Carousel>
    </section>
  );
};

export default HeroSection;
