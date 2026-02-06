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
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import type { Project } from "@/data/projects";

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
};

const heroSlidesSeed = [
  {
    id: "prisma-illya",
    title: "Fate/Kaleid Liner Prisma Illya",
    description:
      "Illya (Illyasviel von Einzbern) é uma típica estudante do Instituto Homurabara que tem uma quedinha por seu cunhado. Certa noite, uma varinha de condão chamada Cajado Rubi cai do céu em sua banheira e a faz assinar um contrato...",
    updatedAt: "2024-01-28T12:00:00Z",
    image: heroImage,
    projectId: "aurora-no-horizonte",
    trailerUrl: "",
  },
  {
    id: "spy-family",
    title: "Spy x Family",
    description:
      "Loid precisa montar uma família falsa para cumprir a missão mais delicada de sua carreira. Entre uma espiã e uma telepata, tudo pode dar errado — e ficar ainda mais divertido.",
    updatedAt: "2024-01-25T12:00:00Z",
    image: heroImage,
    projectId: "rainbow-pulse",
    trailerUrl: "",
  },
  {
    id: "jujutsu-kaisen",
    title: "Jujutsu Kaisen",
    description:
      "Yuji Itadori se envolve com maldições perigosas e encontra novos aliados na Escola Jujutsu. Cada episódio é uma luta intensa, cheia de energia e emoção.",
    updatedAt: "2024-01-22T12:00:00Z",
    image: heroImage,
    projectId: "iris-black",
    trailerUrl: "",
  },
  {
    id: "frieren",
    title: "Frieren",
    description:
      "Após a derrota do Rei Demônio, Frieren parte em uma jornada que combina nostalgia e descobertas sobre a vida humana. Um roteiro sensível e contemplativo a cada episódio.",
    updatedAt: "2024-01-20T12:00:00Z",
    image: heroImage,
    projectId: "jardim-das-marés",
    trailerUrl: "",
  },
  {
    id: "oshi-no-ko",
    title: "Oshi no Ko",
    description:
      "Nos bastidores do entretenimento, a história mistura idol, fama e mistérios. Cada episódio revela mais sobre o brilho e as sombras do estrelato.",
    updatedAt: "2024-01-18T12:00:00Z",
    image: heroImage,
    projectId: "nova-primavera",
    trailerUrl: "",
  },
];

const HeroSection = () => {
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  const autoplayRef = React.useRef<number | null>(null);
  const resumeTimeoutRef = React.useRef<number | null>(null);
  const [heroSlides, setHeroSlides] = React.useState<HeroSlide[]>([]);
  const [projectsCount, setProjectsCount] = React.useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const apiBase = getApiBase();
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
    }, 3000);
  }, [startAutoplay, stopAutoplay]);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    startAutoplay();
    api.on("pointerDown", scheduleAutoplayResume);

    return () => {
      api.off("pointerDown", scheduleAutoplayResume);
      stopAutoplay();
      if (resumeTimeoutRef.current !== null) {
        window.clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, [api, scheduleAutoplayResume, startAutoplay, stopAutoplay]);

  React.useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const [projectsRes, updatesRes] = await Promise.all([
          apiFetch(apiBase, "/api/public/projects"),
          apiFetch(apiBase, "/api/public/updates"),
        ]);
        if (!projectsRes.ok) {
          return;
        }
        const projectData = await projectsRes.json();
        const projects: Project[] = Array.isArray(projectData.projects) ? projectData.projects : [];
        const updates = updatesRes.ok ? (await updatesRes.json()).updates || [] : [];
        const launchUpdates = (Array.isArray(updates) ? updates : [])
          .filter((update: { kind?: string }) => {
            const kind = String(update.kind || "").toLowerCase();
            return kind === "lançamento" || kind === "lancamento";
          })
          .sort(
            (a: { updatedAt?: string }, b: { updatedAt?: string }) =>
              new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
          );
        const latestLaunchByProject = new Map<string, string>();
        launchUpdates.forEach((update: { projectId?: string; updatedAt?: string }) => {
          const projectId = String(update.projectId || "");
          if (!projectId || latestLaunchByProject.has(projectId)) {
            return;
          }
          latestLaunchByProject.set(projectId, update.updatedAt || "");
        });

        const projectsById = new Map(projects.map((project) => [project.id, project]));
        const forced = projects.filter((project) => project.forceHero);
        const forcedSorted = [...forced].sort((a, b) => {
          const aTime = new Date(latestLaunchByProject.get(a.id) || 0).getTime();
          const bTime = new Date(latestLaunchByProject.get(b.id) || 0).getTime();
          return bTime - aTime;
        });

        const resultIds = new Set<string>();
        const slides: HeroSlide[] = [];
        const maxSlides = 5;
        const epoch = "1970-01-01T00:00:00.000Z";
        const createSlide = (project: Project, updatedAt?: string) => {
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

        if (isActive) {
          setProjectsCount(projects.length);
          if (!slides.length && projects.length === 0) {
            setHeroSlides(heroSlidesSeed);
          } else {
            setHeroSlides(slides);
          }
        }
      } catch {
        if (isActive) {
          setHeroSlides([]);
          setProjectsCount(null);
        }
      } finally {
        if (isActive) {
          setHasLoaded(true);
        }
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

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

  return (
    <section className="relative min-h-screen overflow-hidden">
      <Carousel opts={{ loop: true }} setApi={setApi} className="min-h-screen">
        <CarouselContent className="ml-0">
          {visibleSlides.map((slide) => (
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
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {slide.id === latestSlideId ? (
                        <span className="inline-block px-3 py-1 rounded-full animate-fade-in border bg-[color:var(--hero-badge-bg,hsl(var(--primary)/0.2))] text-[color:var(--hero-badge-text,hsl(var(--primary)))] border-[color:var(--hero-badge-border,hsl(var(--primary)/0.3)))]">
                          Último Lançamento
                        </span>
                      ) : null}
                      {slide.format ? <span>{slide.format}</span> : null}
                      {slide.format && slide.status ? <span className="opacity-50">•</span> : null}
                      {slide.status ? <span>{slide.status}</span> : null}
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
                        className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all hover:scale-105 hover:brightness-110 bg-[color:var(--hero-accent,hsl(var(--primary)))] text-[color:var(--hero-accent-foreground,hsl(var(--primary-foreground)))]"
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
