import * as React from "react";
import heroImageAvif from "@/assets/hero-illya.avif";
import heroImageWebp from "@/assets/hero-illya.webp";
import heroImageJpg from "@/assets/hero-illya.jpg";
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
import UploadPicture from "@/components/UploadPicture";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import type {
  PublicBootstrapProject,
  PublicBootstrapUpdate,
} from "@/types/public-bootstrap";

type HeroSlide = {
  id: string;
  title: string;
  description: string;
  updatedAt: string;
  image: string;
  projectId: string;
  trailerUrl?: string;
  format?: string;
  status?: string;
  optimizedImageSet?: {
    avif: string;
    webp: string;
    jpg: string;
  };
};

const heroSlidesSeed: HeroSlide[] = [
  {
    id: "prisma-illya",
    title: "Fate/Kaleid Liner Prisma Illya",
    description:
      "Illya (Illyasviel von Einzbern) é uma típica estudante do Instituto Homurabara que tem uma quedinha por seu cunhado. Certa noite, uma varinha de condão chamada Cajado Rubi cai do céu em sua banheira e a faz assinar um contrato...",
    updatedAt: "2024-01-28T12:00:00Z",
    image: heroImageJpg,
    projectId: "aurora-no-horizonte",
    trailerUrl: "",
    optimizedImageSet: {
      avif: heroImageAvif,
      webp: heroImageWebp,
      jpg: heroImageJpg,
    },
  },
  {
    id: "spy-family",
    title: "Spy x Family",
    description:
      "Loid precisa montar uma família falsa para cumprir a missão mais delicada de sua carreira. Entre uma espiã e uma telepata, tudo pode dar errado e ficar ainda mais divertido.",
    updatedAt: "2024-01-25T12:00:00Z",
    image: heroImageJpg,
    projectId: "rainbow-pulse",
    trailerUrl: "",
    optimizedImageSet: {
      avif: heroImageAvif,
      webp: heroImageWebp,
      jpg: heroImageJpg,
    },
  },
  {
    id: "jujutsu-kaisen",
    title: "Jujutsu Kaisen",
    description:
      "Yuji Itadori se envolve com maldições perigosas e encontra novos aliados na Escola Jujutsu. Cada episódio é uma luta intensa, cheia de energia e emoção.",
    updatedAt: "2024-01-22T12:00:00Z",
    image: heroImageJpg,
    projectId: "iris-black",
    trailerUrl: "",
    optimizedImageSet: {
      avif: heroImageAvif,
      webp: heroImageWebp,
      jpg: heroImageJpg,
    },
  },
  {
    id: "frieren",
    title: "Frieren",
    description:
      "Após a derrota do Rei Demônio, Frieren parte em uma jornada que combina nostalgia e descobertas sobre a vida humana. Um roteiro sensível e contemplativo a cada episódio.",
    updatedAt: "2024-01-20T12:00:00Z",
    image: heroImageJpg,
    projectId: "jardim-das-marés",
    trailerUrl: "",
    optimizedImageSet: {
      avif: heroImageAvif,
      webp: heroImageWebp,
      jpg: heroImageJpg,
    },
  },
  {
    id: "oshi-no-ko",
    title: "Oshi no Ko",
    description:
      "Nos bastidores do entretenimento, a história mistura idol, fama e mistérios. Cada episódio revela mais sobre o brilho e as sombras do estrelato.",
    updatedAt: "2024-01-18T12:00:00Z",
    image: heroImageJpg,
    projectId: "nova-primavera",
    trailerUrl: "",
    optimizedImageSet: {
      avif: heroImageAvif,
      webp: heroImageWebp,
      jpg: heroImageJpg,
    },
  },
];

const sortLaunchUpdates = (updates: PublicBootstrapUpdate[]) =>
  [...updates]
    .filter((update) => {
      const kind = String(update.kind || "").toLowerCase();
      return kind === "lançamento" || kind === "lancamento";
    })
    .sort(
      (a, b) =>
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
    );

const HeroSection = () => {
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  const autoplayRef = React.useRef<number | null>(null);
  const resumeTimeoutRef = React.useRef<number | null>(null);
  const [heroSlides, setHeroSlides] = React.useState<HeroSlide[]>([]);
  const [projectsCount, setProjectsCount] = React.useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [loadedSlideIds, setLoadedSlideIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const { data: bootstrapData, isFetched } = usePublicBootstrap();
  const { effectiveMode } = useThemeMode();
  const mediaVariants = bootstrapData?.mediaVariants || {};

  const visibleSlides = React.useMemo(() => {
    if (heroSlides.length > 0) {
      return heroSlides;
    }
    if (!hasLoaded || projectsCount === null) {
      return [];
    }
    return projectsCount === 0 ? heroSlidesSeed : [];
  }, [hasLoaded, heroSlides, projectsCount]);

  const latestSlideId = React.useMemo(() => {
    if (!visibleSlides.length) {
      return "";
    }
    return visibleSlides.reduce((latest, current) => {
      if (!latest) {
        return current;
      }
      return new Date(current.updatedAt).getTime() > new Date(latest.updatedAt).getTime()
        ? current
        : latest;
    }, visibleSlides[0])?.id;
  }, [visibleSlides]);

  React.useEffect(() => {
    if (!api) {
      setActiveIndex(0);
      return;
    }
    const syncSelectedIndex = () => {
      setActiveIndex(api.selectedScrollSnap());
    };
    syncSelectedIndex();
    api.on("select", syncSelectedIndex);
    api.on("reInit", syncSelectedIndex);
    return () => {
      api.off("select", syncSelectedIndex);
      api.off("reInit", syncSelectedIndex);
    };
  }, [api]);

  React.useEffect(() => {
    if (!visibleSlides.length) {
      setLoadedSlideIds(new Set());
      return;
    }
    const activeSlide = visibleSlides[activeIndex] || visibleSlides[0];
    if (!activeSlide) {
      return;
    }
    setLoadedSlideIds((previous) => {
      if (previous.has(activeSlide.id)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(activeSlide.id);
      return next;
    });
  }, [activeIndex, visibleSlides]);

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
    if (typeof document !== "undefined" && document.hidden) {
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
    }, 3000);
  }, [startAutoplay, stopAutoplay]);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAutoplay();
        if (resumeTimeoutRef.current !== null) {
          window.clearTimeout(resumeTimeoutRef.current);
          resumeTimeoutRef.current = null;
        }
        return;
      }
      startAutoplay();
    };

    startAutoplay();
    api.on("pointerDown", scheduleAutoplayResume);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      api.off("pointerDown", scheduleAutoplayResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopAutoplay();
      if (resumeTimeoutRef.current !== null) {
        window.clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
    };
  }, [api, scheduleAutoplayResume, startAutoplay, stopAutoplay]);

  React.useEffect(() => {
    if (!isFetched) {
      return;
    }

    const projects = Array.isArray(bootstrapData?.projects)
      ? (bootstrapData.projects as PublicBootstrapProject[])
      : [];
    const updates = Array.isArray(bootstrapData?.updates)
      ? (bootstrapData.updates as PublicBootstrapUpdate[])
      : [];
    const launchUpdates = sortLaunchUpdates(updates);
    const latestLaunchByProject = new Map<string, string>();
    launchUpdates.forEach((update) => {
      const projectId = String(update.projectId || "");
      if (!projectId || latestLaunchByProject.has(projectId)) {
        return;
      }
      latestLaunchByProject.set(projectId, update.updatedAt || "");
    });

    const projectsById = new Map(projects.map((project) => [project.id, project]));
    const resultIds = new Set<string>();
    const slides: HeroSlide[] = [];
    const maxSlides = 5;
    const epoch = "1970-01-01T00:00:00.000Z";
    const createSlide = (project: PublicBootstrapProject, updatedAt?: string) => {
      if (resultIds.has(project.id)) {
        return null;
      }
      const image = project.heroImageUrl || project.banner || project.cover || "";
      if (!image) {
        return null;
      }
      return {
        id: project.id,
        title: project.title,
        description: project.synopsis || project.description || "",
        updatedAt: updatedAt || epoch,
        image,
        projectId: project.id,
        trailerUrl: project.trailerUrl || "",
        format: project.type || "",
        status: project.status || "",
      };
    };

    const orderedProjects = projects
      .map((project, index) => {
        const updatedAt = latestLaunchByProject.get(project.id) || "";
        const time = updatedAt ? new Date(updatedAt).getTime() : 0;
        return { project, index, updatedAt, time };
      })
      .sort((a, b) => {
        if (b.time !== a.time) {
          return b.time - a.time;
        }
        return a.index - b.index;
      });

    orderedProjects.forEach((item) => {
      const slide = createSlide(item.project, item.updatedAt);
      if (!slide) {
        return;
      }
      if (slides.length < maxSlides) {
        slides.push(slide);
        resultIds.add(slide.id);
        return;
      }
      if (!item.project.forceHero) {
        return;
      }
      slides.push(slide);
      resultIds.add(slide.id);
      const removeIndexFromEnd = [...slides]
        .reverse()
        .findIndex((candidate) => !projectsById.get(candidate.id)?.forceHero);
      if (removeIndexFromEnd === -1) {
        const removed = slides.shift();
        if (removed) {
          resultIds.delete(removed.id);
        }
        return;
      }
      const removeIndex = slides.length - 1 - removeIndexFromEnd;
      const [removed] = slides.splice(removeIndex, 1);
      if (removed) {
        resultIds.delete(removed.id);
      }
    });

    setProjectsCount(projects.length);
    if (!slides.length && projects.length === 0) {
      setHeroSlides(heroSlidesSeed);
    } else {
      setHeroSlides(slides);
    }
    setHasLoaded(true);
  }, [bootstrapData, isFetched]);

  const clampSynopsis = React.useCallback((text: string, limit = 100) => {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();
    if (cleaned.length <= limit) {
      return cleaned;
    }
    const nextSpace = cleaned.indexOf(" ", limit);
    const upperBound = limit + 12;
    if (nextSpace > -1 && nextSpace <= upperBound) {
      return `${cleaned.slice(0, nextSpace)}...`;
    }
    const slice = cleaned.slice(0, limit);
    const lastSpace = slice.lastIndexOf(" ");
    const trimmed = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
    return `${trimmed}...`;
  }, []);

  const heroViewportClass = "min-h-[78vh] md:min-h-screen";
  const shouldRenderNavbarOverlay = effectiveMode === "light";
  const navbarOverlayClass =
    "pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-background/95 via-background/70 to-transparent md:h-36";
  const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

  return (
    <section className={`relative overflow-hidden ${heroViewportClass}`}>
      <Carousel opts={{ loop: true }} setApi={setApi} className={heroViewportClass}>
        <CarouselContent className="ml-0">
          {visibleSlides.map((slide, index) => {
            const isActive = index === activeIndex;
            const shouldLoadImage =
              loadedSlideIds.has(slide.id) || isActive || (!api && index === 0);
            const loading = isActive ? "eager" : "lazy";
            const imagePriorityProps = {
              fetchpriority: isActive ? "high" : "auto",
            } as const;
            return (
              <CarouselItem key={slide.id} className="pl-0">
                <div className={`relative flex items-end overflow-hidden ${heroViewportClass}`}>
                  <div className="absolute inset-0">
                    {slide.optimizedImageSet ? (
                      <picture>
                        <source
                          type="image/avif"
                          srcSet={shouldLoadImage ? slide.optimizedImageSet.avif : undefined}
                        />
                        <source
                          type="image/webp"
                          srcSet={shouldLoadImage ? slide.optimizedImageSet.webp : undefined}
                        />
                        <img
                          src={shouldLoadImage ? slide.optimizedImageSet.jpg : transparentPixel}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-cover object-center"
                          loading={loading}
                          decoding="async"
                          {...imagePriorityProps}
                        />
                      </picture>
                    ) : (
                      <UploadPicture
                        src={shouldLoadImage ? slide.image : transparentPixel}
                        alt=""
                        preset="hero"
                        mediaVariants={shouldLoadImage ? mediaVariants : undefined}
                        applyFocalObjectPosition
                        className="h-full w-full"
                        imgClassName="h-full w-full object-cover object-center"
                        aria-hidden="true"
                        loading={loading}
                        decoding="async"
                        {...imagePriorityProps}
                      />
                    )}
                  </div>

                  <div className="absolute inset-0 bg-linear-to-r from-background via-background/80 to-transparent" />
                  <div className="absolute inset-0 bg-linear-to-t from-background via-background/30 to-transparent" />

                  {shouldRenderNavbarOverlay ? (
                    <div data-testid="hero-navbar-overlay" className={navbarOverlayClass} />
                  ) : null}

                  <div className="relative z-10 w-full px-6 md:px-12 pb-16 md:pb-24">
                    <div className="max-w-3xl">
                      <div
                        data-testid={`hero-slide-meta-${slide.id}`}
                        className="mb-3 flex flex-col items-start gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:flex-row md:flex-wrap md:items-center md:gap-3"
                      >
                        {slide.id === latestSlideId ? (
                          <span
                            data-testid={`hero-slide-latest-${slide.id}`}
                            className="inline-block px-3 py-1 rounded-full animate-fade-in border bg-(--hero-badge-bg,hsl(var(--primary)/0.2)) text-(--hero-badge-text,hsl(var(--primary))) border-(--hero-badge-border,hsl(var(--primary)/0.3))"
                          >
                            Último Lançamento
                          </span>
                        ) : null}
                        {slide.format || slide.status ? (
                          <div
                            data-testid={`hero-slide-type-status-${slide.id}`}
                            className="flex flex-wrap items-center gap-3"
                          >
                            {slide.format ? <span>{slide.format}</span> : null}
                            {slide.format && slide.status ? <span className="opacity-50">•</span> : null}
                            {slide.status ? <span>{slide.status}</span> : null}
                          </div>
                        ) : null}
                      </div>

                      <h1 className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-black mb-6 animate-slide-up text-foreground leading-tight">
                        {slide.title}
                      </h1>

                      <p
                        className="text-base md:text-lg xl:text-xl 2xl:text-2xl text-muted-foreground leading-relaxed max-w-2xl animate-slide-up opacity-0"
                        style={{ animationDelay: "0.2s" }}
                      >
                        {clampSynopsis(slide.description)}
                      </p>

                      <div
                        className="mt-8 flex flex-wrap gap-4 animate-slide-up opacity-0"
                        style={{ animationDelay: "0.4s" }}
                      >
                        <Link
                          to={`/projeto/${slide.projectId}`}
                          className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all hover:scale-105 hover:brightness-110 bg-(--hero-accent,hsl(var(--primary))) text-(--hero-accent-foreground,hsl(var(--primary-foreground)))"
                        >
                          <Globe className="h-4 w-4" />
                          Acessar Página
                        </Link>
                        {slide.trailerUrl ? (
                          <a
                            href={slide.trailerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all hover:scale-105 border border-border/40 bg-background/70 text-foreground hover:bg-background/90"
                          >
                            <Play className="h-4 w-4" />
                            Assistir Trailer
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            );
          })}
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
