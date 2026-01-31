import * as React from "react";
import heroImage from "@/assets/hero-illya.jpg";
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
    image: heroImage,
  },
  {
    id: "spy-family",
    title: "Spy x Family",
    description:
      "Loid precisa montar uma família falsa para cumprir a missão mais delicada de sua carreira. Entre uma espiã e uma telepata, tudo pode dar errado — e ficar ainda mais divertido.",
    image: heroImage,
  },
  {
    id: "jujutsu-kaisen",
    title: "Jujutsu Kaisen",
    description:
      "Yuji Itadori se envolve com maldições perigosas e encontra novos aliados na Escola Jujutsu. Cada episódio é uma luta intensa, cheia de energia e emoção.",
    image: heroImage,
  },
];

const HeroSection = () => {
  const [api, setApi] = React.useState<CarouselApi | null>(null);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    const interval = window.setInterval(() => {
      api.scrollNext();
    }, 6000);

    return () => window.clearInterval(interval);
  }, [api]);

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
                    <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold uppercase tracking-wider rounded-full animate-fade-in border bg-[color:var(--hero-badge-bg,hsl(var(--primary)/0.2))] text-[color:var(--hero-badge-text,hsl(var(--primary)))] border-[color:var(--hero-badge-border,hsl(var(--primary)/0.3)))]">
                      Último Lançamento
                    </span>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 animate-slide-up text-foreground leading-tight">
                      {slide.title}
                    </h1>

                    <p
                      className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl animate-slide-up opacity-0"
                      style={{ animationDelay: "0.2s" }}
                    >
                      {slide.description}
                    </p>

                    <div
                      className="mt-8 flex flex-wrap gap-4 animate-slide-up opacity-0"
                      style={{ animationDelay: "0.4s" }}
                    >
                      <button className="px-6 py-3 font-semibold rounded-lg transition-all hover:scale-105 hover:brightness-110 bg-[color:var(--hero-accent,hsl(var(--primary)))] text-[color:var(--hero-accent-foreground,hsl(var(--primary-foreground)))]">
                        Acessar Página
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex left-auto right-20 bottom-8 top-auto h-9 w-9 translate-y-0 bg-background/50 hover:bg-background/70 border border-border/30 text-muted-foreground" />
        <CarouselNext className="hidden md:flex right-8 bottom-8 top-auto h-9 w-9 translate-y-0 bg-background/50 hover:bg-background/70 border border-border/30 text-muted-foreground" />
      </Carousel>
    </section>
  );
};

export default HeroSection;
