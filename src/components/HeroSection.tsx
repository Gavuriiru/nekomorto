import heroImageAvif from "@/assets/hero-illya.avif";
import heroImageJpg from "@/assets/hero-illya.jpg";
import heroImageWebp from "@/assets/hero-illya.webp";
import UploadPicture from "@/components/UploadPicture";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { scheduleOnBrowserIdle } from "@/lib/browser-idle";
import { HOME_HERO_READY_EVENT, PUBLIC_HOME_HERO_VIEWPORT_CLASS } from "@/lib/home-hero";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import type {
  PublicBootstrapHomeHeroSlide,
  PublicBootstrapProject,
  PublicBootstrapUpdate,
} from "@/types/public-bootstrap";
import { Globe, Play } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";

type HeroSlide = PublicBootstrapHomeHeroSlide & {
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
    format: "Anime",
    status: "Em andamento",
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
    format: "Anime",
    status: "Em andamento",
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
    format: "Anime",
    status: "Em andamento",
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
    format: "Anime",
    status: "Em andamento",
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
    format: "Anime",
    status: "Em andamento",
    optimizedImageSet: {
      avif: heroImageAvif,
      webp: heroImageWebp,
      jpg: heroImageJpg,
    },
  },
];

const sortLaunchUpdates = (updates: PublicBootstrapUpdate[]) =>
  updates
    .filter((update) => {
      const kind = String(update.kind || "").toLowerCase();
      return kind === "lançamento" || kind === "lancamento";
    })
    // ⚡ Bolt: Precompute timestamps in O(N) map to avoid redundant parsing in O(N log N) sort
    .map((update) => ({
      update,
      time: update.updatedAt ? new Date(update.updatedAt).getTime() : 0,
    }))
    .sort((a, b) => b.time - a.time)
    .map(({ update }) => update);

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

const composeHeroEntryClassName = (baseClassName: string, shouldAnimateEntry: boolean) =>
  shouldAnimateEntry ? `${baseClassName} animate-slide-up opacity-0` : baseClassName;

const resolveHeroEntryStyle = (
  key: keyof typeof heroEntryDelayStyles,
  shouldAnimateEntry: boolean,
) => (shouldAnimateEntry ? heroEntryDelayStyles[key] : undefined);

const heroPrimaryButtonClassName = buttonVariants({
  className:
    "border-[color:var(--hero-primary-border-rest)] bg-[color:var(--hero-primary-bg-rest)] px-6 text-foreground hover:border-[color:var(--hero-primary-border-hover)] hover:bg-[color:var(--hero-primary-bg-hover)] hover:text-(--hero-accent-foreground,hsl(var(--primary-foreground))) focus-visible:border-[color:var(--hero-primary-border-hover)] focus-visible:bg-[color:var(--hero-primary-bg-hover)] focus-visible:text-(--hero-accent-foreground,hsl(var(--primary-foreground)))",
});

const heroPrimaryButtonStyle = {
  "--hero-primary-bg-rest":
    "color-mix(in srgb, var(--hero-accent, hsl(var(--primary))) 10%, transparent)",
  "--hero-primary-border-rest":
    "color-mix(in srgb, var(--hero-accent, hsl(var(--primary))) 70%, transparent)",
  "--hero-primary-bg-hover": "var(--hero-accent, hsl(var(--primary)))",
  "--hero-primary-border-hover":
    "color-mix(in srgb, var(--hero-accent, hsl(var(--primary))) 100%, transparent)",
} as React.CSSProperties;

type HeroSlideFrameProps = {
  slide: HeroSlide;
  index: number;
  activeIndex: number;
  latestSlideId: string;
  loadedSlideIds: Set<string>;
  mediaVariants: UploadMediaVariantsMap;
  heroViewportClass: string;
  shouldRenderNavbarOverlay: boolean;
  navbarOverlayClass: string;
  transparentPixel: string;
  clampSynopsis: (text: string, limit?: number) => string;
  shouldAnimateEntry?: boolean;
  isReadyCandidate?: boolean;
  priorityImageRef?: React.Ref<HTMLImageElement>;
  onPriorityImageLoad?: React.ReactEventHandler<HTMLImageElement>;
  onPriorityImageError?: React.ReactEventHandler<HTMLImageElement>;
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
  navbarOverlayClass,
  transparentPixel,
  clampSynopsis,
  shouldAnimateEntry = true,
  isReadyCandidate = false,
  priorityImageRef,
  onPriorityImageLoad,
  onPriorityImageError,
}: HeroSlideFrameProps) => {
  const isActive = index === activeIndex;
  const isPrioritySlide = index === 0 || isActive;
  const shouldLoadImage = loadedSlideIds.has(slide.id) || isPrioritySlide;
  const loading = isPrioritySlide ? "eager" : "lazy";
  const imagePriorityProps = {
    fetchPriority: isPrioritySlide ? "high" : "auto",
  } as const;
  const readyImageRef = isReadyCandidate ? priorityImageRef : undefined;
  const readyImageProps = isReadyCandidate
    ? {
        onLoad: onPriorityImageLoad,
        onError: onPriorityImageError,
      }
    : {};

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
              ref={readyImageRef}
              src={shouldLoadImage ? slide.optimizedImageSet.jpg : transparentPixel}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover object-center"
              loading={loading}
              decoding="async"
              {...readyImageProps}
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
            imgRef={readyImageRef}
            aria-hidden="true"
            loading={loading}
            decoding="async"
            {...readyImageProps}
            {...imagePriorityProps}
          />
        )}
      </div>

      <div className="absolute inset-0 bg-linear-to-r from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-background via-background/30 to-transparent" />

      {shouldRenderNavbarOverlay ? (
        <div data-testid="hero-navbar-overlay" className={navbarOverlayClass} />
      ) : null}

      <div className="relative z-10 w-full px-6 pb-16 md:px-12 md:pb-24">
        <div className="max-w-3xl">
          <div
            data-testid={`hero-slide-meta-${slide.id}`}
            className="mb-3 flex flex-col items-start gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:flex-row md:flex-wrap md:items-center md:gap-3"
          >
            {slide.id === latestSlideId ? (
              <span
                data-testid={`hero-slide-latest-${slide.id}`}
                className={composeHeroEntryClassName(
                  "inline-block rounded-full border bg-(--hero-badge-bg,hsl(var(--primary)/0.2)) px-3 py-1 text-(--hero-badge-text,hsl(var(--primary))) border-(--hero-badge-border,hsl(var(--primary)/0.3))",
                  shouldAnimateEntry,
                )}
                style={resolveHeroEntryStyle("type", shouldAnimateEntry)}
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
                  <span
                    className={composeHeroEntryClassName("", shouldAnimateEntry).trim()}
                    style={resolveHeroEntryStyle("type", shouldAnimateEntry)}
                  >
                    {slide.format}
                  </span>
                ) : null}
                {slide.format && slide.status ? (
                  <span
                    className={composeHeroEntryClassName(
                      "text-muted-foreground/50",
                      shouldAnimateEntry,
                    )}
                    style={resolveHeroEntryStyle("separator", shouldAnimateEntry)}
                  >
                    •
                  </span>
                ) : null}
                {slide.status ? (
                  <span
                    className={composeHeroEntryClassName("", shouldAnimateEntry).trim()}
                    style={resolveHeroEntryStyle("status", shouldAnimateEntry)}
                  >
                    {slide.status}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <h1
            className={composeHeroEntryClassName(
              "mb-6 text-2xl font-black leading-tight text-foreground md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl",
              shouldAnimateEntry,
            )}
            style={resolveHeroEntryStyle("title", shouldAnimateEntry)}
          >
            {slide.title}
          </h1>

          <p
            className={composeHeroEntryClassName(
              "max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg xl:text-xl 2xl:text-2xl",
              shouldAnimateEntry,
            )}
            style={resolveHeroEntryStyle("synopsis", shouldAnimateEntry)}
          >
            {clampSynopsis(slide.description)}
          </p>

          <div
            className={composeHeroEntryClassName("mt-8 flex flex-wrap gap-4", shouldAnimateEntry)}
            style={resolveHeroEntryStyle("actions", shouldAnimateEntry)}
          >
            <Link
              to={`/projeto/${slide.projectId}`}
              aria-label={`Acessar página de ${slide.title}`}
              className={heroPrimaryButtonClassName}
              style={heroPrimaryButtonStyle}
            >
              <Globe className="h-4 w-4" />
              Acessar Página
            </Link>
            {slide.trailerUrl ? (
              <a
                href={slide.trailerUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({
                  variant: "outline",
                  className:
                    "border-border/40 bg-background/70 px-6 text-foreground hover:bg-background/90",
                })}
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
  const [isCarouselAutoplayReady, setIsCarouselAutoplayReady] = React.useState(false);
  const [loadedSlideIds, setLoadedSlideIds] = React.useState<Set<string>>(() => new Set());
  const [isHeroMounted, setIsHeroMounted] = React.useState(false);
  const primaryHeroImageRef = React.useRef<HTMLImageElement | null>(null);
  const heroReadyDispatchedRef = React.useRef(false);
  const heroReadyFrameRef = React.useRef<number | null>(null);
  const initialHomeShellSnapshotRef = React.useRef(
    typeof document !== "undefined" &&
      typeof window !== "undefined" &&
      window.location.pathname === "/" &&
      document.getElementById("home-hero-shell") !== null,
  );
  const { data: bootstrapData, isFetched } = usePublicBootstrap();
  const { effectiveMode } = useThemeMode();
  const mediaVariants = bootstrapData?.mediaVariants || {};

  const visibleSlides = React.useMemo(() => {
    if (!bootstrapData && !isFetched) {
      return [];
    }
    if (
      Array.isArray(bootstrapData?.homeHero?.slides) &&
      bootstrapData.homeHero.slides.length > 0
    ) {
      return bootstrapData.homeHero.slides as HeroSlide[];
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
      setIsCarouselAutoplayReady(false);
      return;
    }
    const cancelIdle = scheduleOnBrowserIdle(() => {
      setIsCarouselAutoplayReady(true);
    });
    return cancelIdle;
  }, [visibleSlides.length]);

  const latestSlideId = React.useMemo(() => {
    if (bootstrapData?.homeHero?.latestSlideId) {
      return bootstrapData.homeHero.latestSlideId;
    }
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
  }, [bootstrapData?.homeHero?.latestSlideId, visibleSlides]);

  React.useEffect(() => {
    if (!api || visibleSlides.length <= 1) {
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
  }, [api, visibleSlides.length]);

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

  const clearHeroReadyFrame = React.useCallback(() => {
    if (heroReadyFrameRef.current === null || typeof window === "undefined") {
      return;
    }
    window.cancelAnimationFrame(heroReadyFrameRef.current);
    heroReadyFrameRef.current = null;
  }, []);

  const dispatchHeroReady = React.useCallback(() => {
    if (heroReadyDispatchedRef.current || typeof window === "undefined") {
      return;
    }
    heroReadyDispatchedRef.current = true;
    clearHeroReadyFrame();
    heroReadyFrameRef.current = window.requestAnimationFrame(() => {
      heroReadyFrameRef.current = window.requestAnimationFrame(() => {
        heroReadyFrameRef.current = null;
        window.dispatchEvent(new Event(HOME_HERO_READY_EVENT));
      });
    });
  }, [clearHeroReadyFrame]);

  const handlePrimaryHeroImageRef = React.useCallback((node: HTMLImageElement | null) => {
    primaryHeroImageRef.current = node;
  }, []);

  const handlePrimaryHeroImageReady = React.useCallback(() => {
    dispatchHeroReady();
  }, [dispatchHeroReady]);

  const primaryHeroCandidateId = visibleSlides[0]?.id || "";

  React.useEffect(() => {
    if (!primaryHeroCandidateId || heroReadyDispatchedRef.current) {
      return;
    }
    const image = primaryHeroImageRef.current;
    if (!image) {
      return;
    }
    if (image.complete && image.naturalWidth > 0) {
      dispatchHeroReady();
    }
  }, [dispatchHeroReady, primaryHeroCandidateId]);

  React.useEffect(
    () => () => {
      clearHeroReadyFrame();
    },
    [clearHeroReadyFrame],
  );

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
    if (!api || !isCarouselAutoplayReady || visibleSlides.length <= 1) {
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
    isCarouselAutoplayReady,
    scheduleAutoplayResume,
    startAutoplay,
    stopAutoplay,
    visibleSlides.length,
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

  const heroViewportClass = `${PUBLIC_HOME_HERO_VIEWPORT_CLASS} min-h-[78vh] md:min-h-screen`;
  const shouldRenderNavbarOverlay = effectiveMode === "light";
  const navbarOverlayClass =
    "pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-background/95 via-background/70 to-transparent md:h-36";
  const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  const shouldRenderCarousel = visibleSlides.length > 1;
  const shouldRenderCarouselControls = visibleSlides.length > 1;
  const hasInitialHomeShellSnapshot = initialHomeShellSnapshotRef.current;

  // Flip mounted flag on first paint so the section fades in only after the
  // overlay gradients are already in the DOM. When the server-side hero shell
  // is present it becomes the visual cover (z-70 fixed overlay), so we skip
  // the fade to avoid a double transition.
  React.useEffect(() => {
    setIsHeroMounted(true);
  }, []);

  const heroSectionStyle: React.CSSProperties = hasInitialHomeShellSnapshot
    ? {}
    : {
        opacity: isHeroMounted ? 1 : 0,
        transition: isHeroMounted ? "opacity 220ms ease-out" : undefined,
      };

  return (
    <section
      className={`relative w-screen overflow-hidden ${heroViewportClass}`}
      style={heroSectionStyle}
    >
      {shouldRenderCarousel ? (
        <Carousel opts={{ loop: true }} setApi={setApi} className={heroViewportClass}>
          <CarouselContent className="ml-0">
            {visibleSlides.map((slide, index) => {
              const isActive = index === activeIndex;
              const isPrioritySlide = index === 0 || isActive;
              const isReadyCandidate = index === 0;
              const shouldAnimateEntry = !(hasInitialHomeShellSnapshot && index === 0);
              const shouldLoadImage = loadedSlideIds.has(slide.id) || isPrioritySlide;
              const loading = isPrioritySlide ? "eager" : "lazy";
              const imagePriorityProps = {
                fetchPriority: isPrioritySlide ? "high" : "auto",
              } as const;
              const readyImageRef = isReadyCandidate ? handlePrimaryHeroImageRef : undefined;
              const readyImageProps = isReadyCandidate
                ? {
                    onLoad: handlePrimaryHeroImageReady,
                    onError: handlePrimaryHeroImageReady,
                  }
                : {};
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
                            ref={readyImageRef}
                            src={shouldLoadImage ? slide.optimizedImageSet.jpg : transparentPixel}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-cover object-center"
                            loading={loading}
                            decoding="async"
                            {...readyImageProps}
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
                          imgRef={readyImageRef}
                          aria-hidden="true"
                          loading={loading}
                          decoding="async"
                          {...readyImageProps}
                          {...imagePriorityProps}
                        />
                      )}
                    </div>

                    <div className="absolute inset-0 bg-linear-to-r from-background via-background/80 to-transparent" />
                    <div className="absolute inset-0 bg-linear-to-t from-background via-background/30 to-transparent" />

                    {shouldRenderNavbarOverlay ? (
                      <div data-testid="hero-navbar-overlay" className={navbarOverlayClass} />
                    ) : null}

                    <div className="relative z-10 w-full px-6 pb-16 md:px-12 md:pb-24">
                      <div className="max-w-3xl">
                        <div
                          data-testid={`hero-slide-meta-${slide.id}`}
                          className="mb-3 flex flex-col items-start gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:flex-row md:flex-wrap md:items-center md:gap-3"
                        >
                          {slide.id === latestSlideId ? (
                            <span
                              data-testid={`hero-slide-latest-${slide.id}`}
                              className={composeHeroEntryClassName(
                                "inline-block rounded-full border bg-(--hero-badge-bg,hsl(var(--primary)/0.2)) px-3 py-1 text-(--hero-badge-text,hsl(var(--primary))) border-(--hero-badge-border,hsl(var(--primary)/0.3))",
                                shouldAnimateEntry,
                              )}
                              style={resolveHeroEntryStyle("type", shouldAnimateEntry)}
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
                                <span
                                  className={composeHeroEntryClassName(
                                    "",
                                    shouldAnimateEntry,
                                  ).trim()}
                                  style={resolveHeroEntryStyle("type", shouldAnimateEntry)}
                                >
                                  {slide.format}
                                </span>
                              ) : null}
                              {slide.format && slide.status ? (
                                <span
                                  className={composeHeroEntryClassName(
                                    "text-muted-foreground/50",
                                    shouldAnimateEntry,
                                  )}
                                  style={resolveHeroEntryStyle("separator", shouldAnimateEntry)}
                                >
                                  •
                                </span>
                              ) : null}
                              {slide.status ? (
                                <span
                                  className={composeHeroEntryClassName(
                                    "",
                                    shouldAnimateEntry,
                                  ).trim()}
                                  style={resolveHeroEntryStyle("status", shouldAnimateEntry)}
                                >
                                  {slide.status}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <h1
                          className={composeHeroEntryClassName(
                            "text-2xl font-black leading-tight text-foreground md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl mb-6",
                            shouldAnimateEntry,
                          )}
                          style={resolveHeroEntryStyle("title", shouldAnimateEntry)}
                        >
                          {slide.title}
                        </h1>

                        <p
                          className={composeHeroEntryClassName(
                            "text-base leading-relaxed text-muted-foreground md:text-lg xl:text-xl 2xl:text-2xl max-w-2xl",
                            shouldAnimateEntry,
                          )}
                          style={resolveHeroEntryStyle("synopsis", shouldAnimateEntry)}
                        >
                          {clampSynopsis(slide.description)}
                        </p>

                        <div
                          className={composeHeroEntryClassName(
                            "mt-8 flex flex-wrap gap-4",
                            shouldAnimateEntry,
                          )}
                          style={resolveHeroEntryStyle("actions", shouldAnimateEntry)}
                        >
                          <Link
                            to={`/projeto/${slide.projectId}`}
                            aria-label={`Acessar página de ${slide.title}`}
                            className={heroPrimaryButtonClassName}
                            style={heroPrimaryButtonStyle}
                          >
                            <Globe className="h-4 w-4" />
                            Acessar Página
                          </Link>
                          {slide.trailerUrl ? (
                            <a
                              href={slide.trailerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={buttonVariants({
                                variant: "outline",
                                className:
                                  "border-border/40 bg-background/70 px-6 text-foreground hover:bg-background/90",
                              })}
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
      ) : visibleSlides[0] ? (
        <HeroSlideFrame
          slide={visibleSlides[0]}
          index={0}
          activeIndex={0}
          latestSlideId={latestSlideId}
          loadedSlideIds={loadedSlideIds}
          mediaVariants={mediaVariants}
          heroViewportClass={heroViewportClass}
          shouldRenderNavbarOverlay={shouldRenderNavbarOverlay}
          navbarOverlayClass={navbarOverlayClass}
          transparentPixel={transparentPixel}
          clampSynopsis={clampSynopsis}
          shouldAnimateEntry={!hasInitialHomeShellSnapshot}
          isReadyCandidate
          priorityImageRef={handlePrimaryHeroImageRef}
          onPriorityImageLoad={handlePrimaryHeroImageReady}
          onPriorityImageError={handlePrimaryHeroImageReady}
        />
      ) : null}
    </section>
  );
};

export default HeroSection;
