import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Download, Film, PlayCircle, Users } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { projectData } from "@/data/projects";
import NotFound from "./NotFound";

const Project = () => {
  const { slug } = useParams<{ slug: string }>();

  const project = useMemo(() => {
    if (!slug) {
      return undefined;
    }
    return projectData.find((item) => item.id === slug);
  }, [slug]);

  if (!project) {
    return <NotFound />;
  }

  const projectDetails = [
    { label: "Formato", value: project.type },
    { label: "Status", value: project.status },
    { label: "Ano", value: project.year },
    { label: "Estúdio", value: project.studio },
    { label: "Temporada", value: project.season },
    { label: "Episódios", value: project.episodes },
    { label: "Classificação", value: project.rating },
    { label: "Agenda", value: project.schedule },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="pt-24">
        <section className="relative overflow-hidden border-b border-border/60">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${project.banner})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          <div className="relative mx-auto flex min-h-[420px] w-full max-w-6xl flex-col items-start gap-8 px-6 pb-16 pt-20 md:flex-row md:items-center md:px-10 lg:min-h-[520px]">
            <div className="w-52 flex-shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary shadow-2xl md:w-64">
              <img
                src={project.cover}
                alt={project.title}
                className="h-full w-full object-cover aspect-[23/32]"
              />
            </div>
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-primary/80">
                <span>{project.type}</span>
                <span className="text-muted-foreground">•</span>
                <span>{project.status}</span>
              </div>
              <h1 className="text-3xl font-semibold text-foreground md:text-4xl lg:text-5xl">
                {project.title}
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                {project.synopsis}
              </p>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] uppercase">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="gap-2">
                  <a href="#downloads">
                    <Download className="h-4 w-4" />
                    Ver downloads
                  </a>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <a href={project.trailerUrl ?? "#"} target="_blank" rel="noreferrer">
                    <PlayCircle className="h-4 w-4" />
                    Assistir trailer
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-12 md:px-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-8">
              <Card className="border-border/60 bg-card/80 shadow-lg">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    <Film className="h-4 w-4 text-primary" />
                    Sobre o projeto
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                    {project.description}
                  </p>
                  <Separator className="bg-border/60" />
                  <div className="grid gap-4 md:grid-cols-2">
                    {projectDetails.map((detail) => (
                      <div key={detail.label} className="rounded-xl border border-border/50 bg-background/60 p-4">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {detail.label}
                        </span>
                        <p className="mt-2 text-sm font-semibold text-foreground">{detail.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {project.relations && project.relations.length > 0 ? (
                <Card className="border-border/60 bg-card/80 shadow-lg">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      Relações
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {project.relations.map((relation) => (
                        <div
                          key={`${relation.relation}-${relation.title}`}
                          className="flex gap-4 rounded-xl border border-border/50 bg-background/60 p-4"
                        >
                          <div className="w-16 flex-shrink-0 overflow-hidden rounded-lg bg-secondary aspect-[2/3]">
                            <img
                              src={relation.image}
                              alt={relation.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
                              {relation.relation}
                            </p>
                            <p className="text-sm font-semibold text-foreground">{relation.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {relation.format} • {relation.status}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <Card className="h-fit border-border/60 bg-card/70 shadow-md">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  Equipe do projeto
                </div>
                <div className="space-y-3">
                  {project.staff.map((staff) => (
                    <div
                      key={staff.role}
                      className="rounded-xl border border-border/50 bg-background/60 p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
                        {staff.role}
                      </p>
                      <p className="mt-2 text-sm text-foreground">{staff.members.join(", ")}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section
          id="downloads"
          className="mx-auto w-full max-w-6xl px-6 pb-20 pt-4 md:px-10"
        >
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Downloads</h2>
                <p className="text-sm text-muted-foreground">
                  Selecione uma fonte de download para cada item disponível.
                </p>
              </div>
              <Badge variant="secondary" className="text-xs uppercase">
                {project.episodeDownloads.length} disponíveis
              </Badge>
            </div>

            {project.episodeDownloads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
                Este projeto ainda está em produção. Assim que os episódios forem lançados, os
                downloads aparecerão aqui.
              </div>
            ) : (
              <div className="grid gap-6">
                {project.episodeDownloads.map((episode) => (
                  <Card
                    key={episode.number}
                    className="border-border/60 bg-card/80 shadow-lg transition hover:border-primary/40"
                  >
                    <CardContent className="grid gap-6 p-6 md:grid-cols-[240px_1fr]">
                      <div className="overflow-hidden rounded-xl border border-border/50 bg-background/50 shadow-sm">
                        <img
                          src={project.banner}
                          alt={`Preview de ${episode.title}`}
                          className="aspect-[16/9] w-full object-cover"
                        />
                      </div>
                      <div className="flex h-full flex-col justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge variant="secondary" className="text-xs uppercase">
                              {project.type === "Mangá" || project.type === "Webtoon"
                                ? `Cap ${episode.number}`
                                : `EP ${episode.number}`}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {episode.duration}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              <CalendarDays className="mr-1 inline h-3 w-3 text-primary/70" />
                              {new Date(episode.releaseDate).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <p className="text-base font-semibold text-foreground">{episode.title}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {episode.sources.map((source) => (
                            <Button key={source.label} asChild variant="outline" size="sm">
                              <a href={source.url} target="_blank" rel="noreferrer">
                                {source.label}
                              </a>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Project;
