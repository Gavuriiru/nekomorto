import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Download, Film, MessageSquare, PlayCircle, Share2, Users } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getApiBase } from "@/lib/api-base";
import NotFound from "./NotFound";
import type { Project } from "@/data/projects";

const ProjectPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const apiBase = getApiBase();
  const [project, setProject] = useState<Project | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!slug) {
      return;
    }
    let isActive = true;
    const load = async () => {
      try {
        const response = await fetch(`${apiBase}/api/public/projects/${slug}`);
        if (!response.ok) {
          if (isActive) {
            setProject(null);
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setProject(data.project || null);
        }
      } catch {
        if (isActive) {
          setProject(null);
        }
      } finally {
        if (isActive) {
          setHasLoaded(true);
        }
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [apiBase, slug]);

  if (!slug || (!project && hasLoaded)) {
    return <NotFound />;
  }

  if (!project) {
    return null;
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

  const downloadableEpisodes = useMemo(
    () => (project.episodeDownloads || []).filter((episode) => (episode.sources || []).length > 0),
    [project.episodeDownloads],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${project.banner})` }}
          />
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

          <div className="relative mx-auto flex min-h-[420px] w-full max-w-6xl flex-col items-start gap-8 px-6 pb-16 pt-24 md:flex-row md:items-center md:px-10 lg:min-h-[520px]">
            <div className="w-52 flex-shrink-0 overflow-hidden rounded-2xl bg-secondary shadow-2xl md:w-64">
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
                {downloadableEpisodes.length} disponíveis
              </Badge>
            </div>

            {downloadableEpisodes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
                Este projeto ainda está em produção. Assim que os episódios forem lançados, os
                downloads aparecerão aqui.
              </div>
            ) : (
              <div className="grid gap-6">
                {downloadableEpisodes.map((episode) => (
                  <Card
                    key={episode.number}
                    className="border-border/60 bg-card/80 shadow-lg transition hover:border-primary/40"
                  >
                    <CardContent className="relative grid gap-6 p-6 md:grid-cols-[240px_minmax(0,1fr)]">
                      <Badge className="absolute right-6 top-6 text-[10px] uppercase">
                        RAW {episode.sourceType}
                      </Badge>
                      <div className="overflow-hidden rounded-xl border border-border/50 bg-background/50 shadow-sm">
                        <img
                          src={project.banner}
                          alt={`Preview de ${episode.title}`}
                          className="aspect-[16/9] w-full object-cover"
                        />
                      </div>
                      <div className="flex h-full flex-col gap-4 md:min-h-[135px]">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge variant="secondary" className="text-xs uppercase">
                              {project.type === "Mangá" || project.type === "Webtoon"
                                ? `Cap ${episode.number}`
                                : `EP ${episode.number}`}
                            </Badge>
                            <p className="text-lg font-semibold text-foreground">{episode.title}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>{episode.duration}</span>
                            <span>
                              <CalendarDays className="mr-1 inline h-3 w-3 text-primary/70" />
                              {new Date(episode.releaseDate).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{episode.synopsis}</p>
                        </div>
                        <div className="mt-auto flex flex-wrap gap-2 md:justify-end md:self-end">
                          {episode.sources.map((source) => {
                            const icon =
                              source.label === "Google Drive" ? (
                                <svg
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                  className="h-4 w-4 text-[#34A853]"
                                >
                                  <path
                                    fill="currentColor"
                                    d="M7.5 3h9l4.5 8-4.5 8h-9L3 11z"
                                  />
                                </svg>
                              ) : source.label === "MEGA" ? (
                                <svg
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                  className="h-4 w-4 text-[#D9272E]"
                                >
                                  <circle cx="12" cy="12" r="10" fill="currentColor" />
                                  <path
                                    fill="#fff"
                                    d="M7.2 16.4V7.6h1.6l3.2 4.2 3.2-4.2h1.6v8.8h-1.6V10l-3.2 4.1L8.8 10v6.4z"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                  className="h-4 w-4 text-[#7C3AED]"
                                >
                                  <path
                                    fill="currentColor"
                                    d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 5.5 3.5 3.5H13Zm-2 0v3.5H7.5Zm-3.5 6.5 3.5-3.5V14Z"
                                  />
                                </svg>
                              );
                            const buttonClassName =
                              source.label === "Google Drive"
                                ? "border-[#34A853]/60 text-[#34A853] hover:bg-[#34A853]/15"
                                : source.label === "MEGA"
                                ? "border-[#D9272E]/60 text-[#D9272E] hover:bg-[#D9272E]/15"
                                : "border-[#7C3AED]/60 text-[#7C3AED] hover:bg-[#7C3AED]/15";

                            return (
                              <Button
                                key={source.label}
                                asChild
                                variant="outline"
                                size="sm"
                                className={`bg-black/35 ${buttonClassName}`}
                              >
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2"
                                >
                                  {icon}
                                  {source.label}
                                </a>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-4 md:px-10">
          <div className="grid gap-6">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Compartilhar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Share2 className="h-4 w-4 text-primary/70" aria-hidden="true" />
                  Envie este projeto nas redes sociais.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary">
                    Copiar link
                  </Button>
                  <Button size="sm" variant="outline">
                    Compartilhar no X
                  </Button>
                  <Button size="sm" variant="outline">
                    Compartilhar no Discord
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Comentários</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageSquare className="h-4 w-4 text-primary/70" aria-hidden="true" />
                    Seção integrada ou via Disqus.
                  </div>
                  <Button size="sm" variant="outline">
                    Conectar Disqus
                  </Button>
                </div>
                <Separator />
                <div className="flex gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="/placeholder.svg" alt="Avatar do usuário" />
                    <AvatarFallback>RA</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-3">
                    <Textarea
                      placeholder="Escreva um comentário ou feedback sobre o projeto..."
                      className="min-h-[120px]"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button>Publicar comentário</Button>
                      <Button variant="ghost" size="sm">
                        Ver regras da comunidade
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                  Aqui aparecerá a thread de comentários com paginação, reações e moderação.
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ProjectPage;
