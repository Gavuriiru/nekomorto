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
import { scheduleOnBrowserIdle } from "@/lib/browser-idle";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import type { PublicBootstrapProject, PublicBootstrapUpdate } from "@/types/public-bootstrap";

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
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

const buildHeroSlides = (
  projects: PublicBootstrapProject[],
  updates: PublicBootstrapUpdate[],
): HeroSlide[] => {
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
    } satisfies HeroSlide;
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

  if (slides.length > 0) {
    return slides;
  }
  return projects.length === 0 ? heroSlidesSeed : [];
};

const heroEntryDelayMs = {
  type: 120,
  separator: 120,
  status: 120,
  title: 240,
  synopsis: 360,
  actions: 520,
} as const;

const heroEntryDelayStyles = {
  type: { animationDelay: `${heroEntryDelayMs.type}ms` },
  separator: { animationDelay: `${heroEntryDelayMs.separator}ms` },
  status: { animationDelay: `${heroEntryDelayMs.status}ms` },
  title: { animationDelay: `${heroEntryDelayMs.title}ms` },
  synopsis: { animationDelay: `${heroEntryDelayMs.synopsis}ms` },
  actions: { animationDelay: `${heroEntryDelayMs.actions}ms` },
} as const satisfies Record<keyof typeof heroEntryDelayMs, React.CSSProperties>;

type HeroSlideFrameProps = {
  slide: HeroSlide;
  index: number;
  activeIndex: number;
  latestSlideId: string;
  loadedSlideIds: Set<string>;
  mediaVariants: UploadMediaVariantsMap;
  heroViewportClass: string;
  shouldRenderNavbarOverlay: boolean;
  shouldRenderFullBleedOverlays: boolean;
  shouldRenderCopyOverlay: boolean;
  shouldRenderBottomOverlay: boolean;
  fullBleedOverlayHorizontalClass: string;
  fullBleedOverlayVerticalClass: string;
  navbarOverlayClass: string;
  copyOverlayClass: string;
  bottomOverlayClass: string;
  transparentPixel: string;
  clampSynopsis: (text: string, limit?: number) => string;
};

const HeroSlideFrame = ({
  slide,
  index,
  activeIndex,
  latestSlideId,
  loadedSlideIds,
  mediaVariants,
  heroViewportClass,
  shouldRenderNavbarOverlay,
  shouldRenderFullBleedOverlays,
  shouldRenderCopyOverlay,
  shouldRenderBottomOverlay,
  fullBleedOverlayHorizontalClass,
  fullBleedOverlayVerticalClass,
  navbarOverlayClass,
  copyOverlayClass,
  bottomOverlayClass,
  transparentPixel,
  clampSynopsis,
}: HeroSlideFrameProps) => {
  const isActive = index === activeIndex;
  const isPrioritySlide = index === 0 || isActive;
  const shouldLoadImage = loadedSlideIds.has(slide.id) || isPrioritySlide;
  const loading = isPrioritySlide ? "eager" : "lazy";
  const imagePriorityProps = {
    fetchPriority: isPrioritySlide ? "high" : "auto",
  } as const;

  return (
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

      {shouldRenderFullBleedOverlays ? (
        <>
          <div
            data-testid="hero-full-bleed-overlay-horizontal"
            className={fullBleedOverlayHorizontalClass}
          />
          <div
            data-testid="hero-full-bleed-overlay-vertical"
            className={fullBleedOverlayVerticalClass}
          />
        </>
      ) : null}

      {shouldRenderNavbarOverlay ? (
        <div data-testid="hero-navbar-overlay" className={navbarOverlayClass} />
      ) : null}

      {shouldRenderBottomOverlay ? (
        <div data-testid="hero-bottom-overlay" className={bottomOverlayClass} />
      ) : null}

      <div className="relative z-10 w-full px-6 pb-16 md:px-12 md:pb-24">
        <div className="relative max-w-3xl">
          {shouldRenderCopyOverlay ? (
            <div data-testid="hero-copy-overlay" className={copyOverlayClass} />
          ) : null}
          <div
            data-testid={`hero-slide-meta-${slide.id}`}
            className="relative z-10 mb-3 flex flex-col items-start gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:flex-row md:flex-wrap md:items-center md:gap-3"
          >
            {slide.id === latestSlideId ? (
              <span
                data-testid={`hero-slide-latest-${slide.id}`}
                className="inline-block rounded-full border bg-(--hero-badge-bg,hsl(var(--primary)/0.2)) px-3 py-1 text-(--hero-badge-text,hsl(var(--primary))) border-(--hero-badge-border,hsl(var(--primary)/0.3)) animate-slide-up opacity-0"
                style={heroEntryDelayStyles.type}
              >
                Último Lançamento
              </span>
            ) : null}
            {slide.format || slide.status ? (
              <div
                data-testid={`hero-slide-type-status-${slide.id}`}
                className="flex flex-wrap items-center gap-3"
              >
                {slide.format ? (
                  <span className="animate-slide-up opacity-0" style={heroEntryDelayStyles.type}>
                    {slide.format}
                  </span>
                ) : null}
                {slide.format && slide.status ? (
                  <span
                    className="animate-slide-up text-muted-foreground/50 opacity-0"
                    style={heroEntryDelayStyles.separator}
                  >
                    •
                  </span>
                ) : null}
                {slide.status ? (
                  <span className="animate-slide-up opacity-0" style={heroEntryDelayStyles.status}>
                    {slide.status}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <h1
            className="relative z-10 mb-6 text-2xl font-black leading-tight text-foreground animate-slide-up opacity-0 md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl"
            style={heroEntryDelayStyles.title}
          >
            {slide.title}
          </h1>

          <p
            className="relative z-10 max-w-2xl text-base leading-relaxed text-muted-foreground animate-slide-up opacity-0 md:text-lg xl:text-xl 2xl:text-2xl"
            style={heroEntryDelayStyles.synopsis}
          >
            {clampSynopsis(slide.description)}
          </p>

          <div
            className="relative z-10 mt-8 flex flex-wrap gap-4 animate-slide-up opacity-0"
            style={heroEntryDelayStyles.actions}
          >
            <Link
              to={`/projeto/${slide.projectId}`}
              aria-label={`Acessar página de ${slide.title}`}
              className="inline-flex items-center gap-2 rounded-lg bg-(--hero-accent,hsl(var(--primary))) px-6 py-3 font-semibold text-(--hero-accent-foreground,hsl(var(--primary-foreground))) transition-all hover:scale-105 hover:brightness-110"
            >
              <Globe className="h-4 w-4" />
              Acessar Página
            </Link>
            {slide.trailerUrl ? (
              <a
                href={slide.trailerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-background/70 px-6 py-3 font-semibold text-foreground transition-all hover:scale-105 hover:bg-background/90"
              >
                <Play className="h-4 w-4" />
                Assistir Trailer
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const HeroSection = () => {
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  const autoplayRef = React.useRef<number | null>(null);
  const resumeTimeoutRef = React.useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isCarouselEnhanced, setIsCarouselEnhanced] = React.useState(false);
  const [loadedSlideIds, setLoadedSlideIds] = React.useState<Set<string>>(() => new Set());
  const { data: bootstrapData, isFetched } = usePublicBootstrap();
  const { effectiveMode } = useThemeMode();
  const mediaVariants = bootstrapData?.mediaVariants || {};

  const visibleSlides = React.useMemo(() => {
    if (!bootstrapData && !isFetched) {
      return [];
    }
    const projects = Array.isArray(bootstrapData?.projects)
      ? (bootstrapData.projects as PublicBootstrapProject[])
      : [];
    const updates = Array.isArray(bootstrapData?.updates)
      ? (bootstrapData.updates as PublicBootstrapUpdate[])
      : [];
    return buildHeroSlides(projects, updates);
  }, [bootstrapData, isFetched]);

  React.useEffect(() => {
    if (visibleSlides.length <= 1) {
      setIsCarouselEnhanced(false);
      return;
    }
    const cancelIdle = scheduleOnBrowserIdle(() => {
      setIsCarouselEnhanced(true);
    });
    return cancelIdle;
  }, [visibleSlides.length]);

  const renderedSlides = React.useMemo(
    () => (isCarouselEnhanced ? visibleSlides : visibleSlides.slice(0, 1)),
    [isCarouselEnhanced, visibleSlides],
  );

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
    if (!api || !isCarouselEnhanced) {
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
  }, [api, isCarouselEnhanced]);

  React.useEffect(() => {
    if (!renderedSlides.length) {
      setLoadedSlideIds(new Set());
      return;
    }
    const activeSlide = renderedSlides[activeIndex] || renderedSlides[0];
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
  }, [activeIndex, renderedSlides]);

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
    if (!api || !isCarouselEnhanced || renderedSlides.length <= 1) {
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
  }, [
    api,
    isCarouselEnhanced,
    renderedSlides.length,
    scheduleAutoplayResume,
    startAutoplay,
    stopAutoplay,
  ]);

  const clampSynopsis = React.useCallback((text: string, limit = 100) => {
    const cleaned = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
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
  const isLightTheme = effectiveMode === "light";
  const shouldRenderNavbarOverlay = isLightTheme;
  const shouldRenderFullBleedOverlays = true;
  const shouldRenderCopyOverlay = isLightTheme;
  const shouldRenderBottomOverlay = isLightTheme;
  const fullBleedOverlayHorizontalClass = isLightTheme
    ? "absolute inset-0 bg-[linear-gradient(90deg,hsl(220_12%_7%/_0.9)_0%,hsl(220_12%_7%/_0.76)_34%,hsl(220_12%_7%/_0.5)_58%,hsl(220_12%_7%/_0.2)_78%,transparent_100%)]"
    : "absolute inset-0 bg-linear-to-r from-background via-background/80 to-transparent";
  const fullBleedOverlayVerticalClass = isLightTheme
    ? "absolute inset-0 bg-[linear-gradient(180deg,hsl(220_12%_7%/_0.18)_0%,hsl(220_12%_7%/_0.28)_18%,hsl(220_12%_7%/_0.44)_44%,hsl(220_12%_7%/_0.7)_72%,hsl(220_12%_7%/_0.9)_100%)]"
    : "absolute inset-0 bg-linear-to-t from-background via-background/30 to-transparent";
  const navbarOverlayClass =
    "pointer-events-none absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,hsl(210_33%_98%/_0.98)_0%,hsl(210_33%_98%/_0.9)_20%,hsl(210_33%_98%/_0.7)_42%,hsl(210_33%_98%/_0.38)_68%,transparent_100%)] md:h-44";
  const copyOverlayClass =
    "pointer-events-none absolute -bottom-20 -left-8 -right-20 -top-12 rounded-[3rem] bg-[radial-gradient(ellipse_at_24%_24%,hsl(0_0%_100%/_0.95)_0%,hsl(210_33%_98%/_0.84)_14%,hsl(210_33%_98%/_0.62)_30%,hsl(210_33%_98%/_0.34)_48%,hsl(220_12%_7%/_0.18)_66%,transparent_86%)] md:-bottom-24 md:-left-12 md:-right-28 md:-top-16";
  const bottomOverlayClass =
    "pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent_0%,hsl(210_33%_98%/_0.12)_18%,hsl(210_33%_98%/_0.32)_40%,hsl(210_33%_98%/_0.58)_66%,hsl(210_33%_98%/_0.88)_88%,hsl(210_33%_98%/_0.98)_100%)] md:h-44";
  const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  const shouldRenderCarousel = renderedSlides.length > 0;
  const shouldRenderCarouselControls = isCarouselEnhanced && renderedSlides.length > 1;

  return (
    <section className={`relative overflow-hidden ${heroViewportClass}`}>
      {shouldRenderCarousel ? (
        <Carousel opts={{ loop: true }} setApi={setApi} className={heroViewportClass}>
          <CarouselContent className="ml-0">
            {renderedSlides.map((slide, index) => (
              <CarouselItem key={slide.id} className="pl-0">
                <HeroSlideFrame
                  slide={slide}
                  index={index}
                  activeIndex={activeIndex}
                  latestSlideId={latestSlideId}
                  loadedSlideIds={loadedSlideIds}
                  mediaVariants={mediaVariants}
                  heroViewportClass={heroViewportClass}
                  shouldRenderNavbarOverlay={shouldRenderNavbarOverlay}
                  shouldRenderFullBleedOverlays={shouldRenderFullBleedOverlays}
                  shouldRenderCopyOverlay={shouldRenderCopyOverlay}
                  shouldRenderBottomOverlay={shouldRenderBottomOverlay}
                  fullBleedOverlayHorizontalClass={fullBleedOverlayHorizontalClass}
                  fullBleedOverlayVerticalClass={fullBleedOverlayVerticalClass}
                  navbarOverlayClass={navbarOverlayClass}
                  copyOverlayClass={copyOverlayClass}
                  bottomOverlayClass={bottomOverlayClass}
                  transparentPixel={transparentPixel}
                  clampSynopsis={clampSynopsis}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {shouldRenderCarouselControls ? (
            <CarouselPrevious
              className="hidden md:flex left-auto right-20 bottom-8 top-auto h-9 w-9 translate-y-0 bg-background/50 hover:bg-background/70 border border-border/30 text-muted-foreground"
              onClick={scheduleAutoplayResume}
            />
          ) : null}
          {shouldRenderCarouselControls ? (
            <CarouselNext
              className="hidden md:flex right-8 bottom-8 top-auto h-9 w-9 translate-y-0 bg-background/50 hover:bg-background/70 border border-border/30 text-muted-foreground"
              onClick={scheduleAutoplayResume}
            />
          ) : null}
        </Carousel>
      ) : renderedSlides[0] ? (
        <HeroSlideFrame
          slide={renderedSlides[0]}
          index={0}
          activeIndex={0}
          latestSlideId={latestSlideId}
          loadedSlideIds={loadedSlideIds}
          mediaVariants={mediaVariants}
          heroViewportClass={heroViewportClass}
          shouldRenderNavbarOverlay={shouldRenderNavbarOverlay}
          shouldRenderFullBleedOverlays={shouldRenderFullBleedOverlays}
          shouldRenderCopyOverlay={shouldRenderCopyOverlay}
          shouldRenderBottomOverlay={shouldRenderBottomOverlay}
          fullBleedOverlayHorizontalClass={fullBleedOverlayHorizontalClass}
          fullBleedOverlayVerticalClass={fullBleedOverlayVerticalClass}
          navbarOverlayClass={navbarOverlayClass}
          copyOverlayClass={copyOverlayClass}
          bottomOverlayClass={bottomOverlayClass}
          transparentPixel={transparentPixel}
          clampSynopsis={clampSynopsis}
        />
      ) : null}
    </section>
  );
};

export default HeroSection;
