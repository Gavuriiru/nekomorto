import * as React from "react";
import heroImageAvif from "@/assets/hero-illya.avif";
import heroImageWebp from "@/assets/hero-illya.webp";
import heroImageJpg from "@/assets/hero-illya.jpg";
import { Globe, Play } from "lucide-react";
import { Link } from "react-router-dom";
import UploadPicture from "@/components/UploadPicture";
import { scheduleOnBrowserIdle } from "@/lib/browser-idle";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { useIsMobile } from "@/hooks/use-mobile";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import type {
  PublicBootstrapProject,
  PublicBootstrapUpdate,
} from "@/types/public-bootstrap";

const HeroDesktopCarousel = React.lazy(() => import("@/components/HeroDesktopCarousel"));

export type HeroSlide = {
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
  navbarOverlayClass: string;
  transparentPixel: string;
  clampSynopsis: (text: string, limit?: number) => string;
  shouldAnimateEntry: boolean;
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
  shouldAnimateEntry,
}: HeroSlideFrameProps) => {
  const isActive = index === activeIndex;
  const isPrioritySlide = index === 0 || isActive;
  const shouldLoadImage = loadedSlideIds.has(slide.id) || isPrioritySlide;
  const loading = isPrioritySlide ? "eager" : "lazy";
  const imagePriorityProps = {
    fetchpriority: isPrioritySlide ? "high" : "auto",
  } as const;
  const entryAnimationClass = shouldAnimateEntry ? "animate-slide-up opacity-0" : "";
  const getEntryAnimationStyle = (style: React.CSSProperties) =>
    shouldAnimateEntry ? style : undefined;

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
            sizes="100vw"
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

      <div className="relative z-10 w-full px-6 pb-16 md:px-12 md:pb-24">
        <div className="max-w-3xl">
          <div
            data-testid={`hero-slide-meta-${slide.id}`}
            className="mb-3 flex flex-col items-start gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:flex-row md:flex-wrap md:items-center md:gap-3"
          >
            {slide.id === latestSlideId ? (
              <span
                data-testid={`hero-slide-latest-${slide.id}`}
                className={`inline-block rounded-full border bg-(--hero-badge-bg,hsl(var(--primary)/0.2)) px-3 py-1 text-(--hero-badge-text,hsl(var(--primary))) border-(--hero-badge-border,hsl(var(--primary)/0.3)) ${entryAnimationClass}`}
                style={getEntryAnimationStyle(heroEntryDelayStyles.type)}
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
                  <span className={entryAnimationClass} style={getEntryAnimationStyle(heroEntryDelayStyles.type)}>
                    {slide.format}
                  </span>
                ) : null}
                {slide.format && slide.status ? (
                  <span
                    className={`${entryAnimationClass} opacity-50`}
                    style={getEntryAnimationStyle(heroEntryDelayStyles.separator)}
                  >
                    •
                  </span>
                ) : null}
                {slide.status ? (
                  <span className={entryAnimationClass} style={getEntryAnimationStyle(heroEntryDelayStyles.status)}>
                    {slide.status}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <h1
            className={`mb-6 text-2xl font-black leading-tight text-foreground md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl ${entryAnimationClass}`}
            style={getEntryAnimationStyle(heroEntryDelayStyles.title)}
          >
            {slide.title}
          </h1>

          <p
            className={`max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg xl:text-xl 2xl:text-2xl ${entryAnimationClass}`}
            style={getEntryAnimationStyle(heroEntryDelayStyles.synopsis)}
          >
            {clampSynopsis(slide.description)}
          </p>

          <div
            className={`mt-8 flex flex-wrap gap-4 ${entryAnimationClass}`}
            style={getEntryAnimationStyle(heroEntryDelayStyles.actions)}
          >
            <Link
              to={`/projeto/${slide.projectId}`}
              aria-label={`Acessar página de ${slide.title}`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:scale-105 hover:brightness-110"
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
  const [isDesktopCarouselReady, setIsDesktopCarouselReady] = React.useState(false);
  const isMobile = useIsMobile();
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
    if (isMobile || visibleSlides.length <= 1) {
      setIsDesktopCarouselReady(false);
      return;
    }
    let isActive = true;
    const cancelIdle = scheduleOnBrowserIdle(() => {
      void import("@/components/HeroDesktopCarousel")
        .catch(() => undefined)
        .finally(() => {
          if (isActive) {
            setIsDesktopCarouselReady(true);
          }
        });
    });
    return () => {
      isActive = false;
      cancelIdle();
    };
  }, [isMobile, visibleSlides.length]);

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
  const staticSlide = visibleSlides[0] || null;
  const shouldRenderDesktopCarousel =
    !isMobile && isDesktopCarouselReady && visibleSlides.length > 1;

  React.useEffect(() => {
    if (typeof window === "undefined" || !staticSlide) {
      return;
    }
    window.dispatchEvent(new Event("nekomata:hero-ready"));
  }, [staticSlide?.id]);

  const renderDesktopSlide = React.useCallback(
    (
      slide: HeroSlide,
      index: number,
      activeIndex: number,
      loadedSlideIds: Set<string>,
    ) => (
      <HeroSlideFrame
        slide={slide}
        index={index}
        activeIndex={activeIndex}
        latestSlideId={latestSlideId}
        loadedSlideIds={loadedSlideIds}
        mediaVariants={mediaVariants}
        heroViewportClass={heroViewportClass}
        shouldRenderNavbarOverlay={shouldRenderNavbarOverlay}
        navbarOverlayClass={navbarOverlayClass}
        transparentPixel={transparentPixel}
        clampSynopsis={clampSynopsis}
        shouldAnimateEntry={false}
      />
    ),
    [
      clampSynopsis,
      heroViewportClass,
      latestSlideId,
      mediaVariants,
      navbarOverlayClass,
      shouldRenderNavbarOverlay,
      transparentPixel,
    ],
  );

  const staticSlideFrame = staticSlide ? (
    <HeroSlideFrame
      slide={staticSlide}
      index={0}
      activeIndex={0}
      latestSlideId={latestSlideId}
      loadedSlideIds={new Set()}
      mediaVariants={mediaVariants}
      heroViewportClass={heroViewportClass}
      shouldRenderNavbarOverlay={shouldRenderNavbarOverlay}
      navbarOverlayClass={navbarOverlayClass}
      transparentPixel={transparentPixel}
      clampSynopsis={clampSynopsis}
      shouldAnimateEntry={!isMobile}
    />
  ) : null;

  return (
    <section className={`relative overflow-hidden ${heroViewportClass}`}>
      {shouldRenderDesktopCarousel ? (
        <React.Suspense fallback={staticSlideFrame}>
          <HeroDesktopCarousel
            slides={visibleSlides}
            heroViewportClass={heroViewportClass}
            renderSlide={renderDesktopSlide}
          />
        </React.Suspense>
      ) : (
        staticSlideFrame
      )}
    </section>
  );
};

export default HeroSection;
