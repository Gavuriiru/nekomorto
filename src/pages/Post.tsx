import { CalendarDays, Clock, MessageSquare, Share2, User } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DiscordInviteCard from "@/components/DiscordInviteCard";
import LatestEpisodeCard from "@/components/LatestEpisodeCard";
import WorkStatusCard from "@/components/WorkStatusCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const post = {
  title: "Sono Bisque Doll wa Koi wo Suru — Season 2 #02",
  cover: "/placeholder.svg",
  dateTime: "2024-02-12T19:45:00",
  author: "Equipe Rainbow",
  readTime: "6 min de leitura",
  tags: ["Anime", "Lançamento", "Romance"],
  excerpt:
    "O segundo episódio já mostra o ritmo acelerado da temporada. Neste post comentamos escolhas de tradução, detalhes de produção e bastidores do projeto.",
};

const projectEmbed = {
  title: "Sono Bisque Doll wa Koi wo Suru",
  format: "Anime",
  status: "Em andamento",
  studio: "CloverWorks",
  episodes: "12 eps",
  image: "/placeholder.svg",
  synopsis:
    "Marin e Gojo continuam explorando o universo do cosplay enquanto encaram novos desafios na escola.",
};

const Post = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="px-6 pb-20 pt-14 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          <section className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-foreground md:text-4xl">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2">
                    <User className="h-4 w-4 text-primary/70" aria-hidden="true" />
                    {post.author}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary/70" aria-hidden="true" />
                    {new Date(post.dateTime).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary/70" aria-hidden="true" />
                    {post.readTime}
                  </span>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs uppercase tracking-wide">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <img
                src={post.cover}
                alt={`Capa do post: ${post.title}`}
                className="aspect-[3/2] w-full object-cover"
              />
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <article className="space-y-8">
              <Card className="border-border bg-card shadow-sm">
                <CardContent className="space-y-7 p-6 text-sm leading-relaxed text-muted-foreground">
                  <div className="space-y-3">
                    <p className="text-base text-muted-foreground">{post.excerpt}</p>
                    <p>
                      O segundo episódio traz um ritmo mais acelerado e organiza os novos personagens em torno do festival de verão.
                      Analisamos como a direção enfatiza a evolução da Marin, sem deixar de lado o cuidado com figurinos e detalhes de
                      produção.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-xl font-semibold text-foreground">1. O arco do verão e os desafios de cosplay</h2>
                    <p>
                      A narrativa alterna entre humor e emoção, enquanto Gojo trabalha nas novas peças. A equipe de legendagem
                      precisou ajustar escolhas de tradução para preservar o tom leve e as referências culturais do episódio.
                    </p>
                    <div className="overflow-hidden rounded-xl border border-border">
                      <img src="/placeholder.svg" alt="Cena do episódio" className="aspect-[3/2] w-full object-cover" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Captura central do episódio mostrando os detalhes da produção.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">Checklist do conteúdo</h3>
                    <ul className="list-disc space-y-2 pl-5">
                      <li>Notas de tradução e termos especiais.</li>
                      <li>Imagens do episódio ou bastidores no fluxo do texto.</li>
                      <li>Links para downloads, streaming ou extras.</li>
                    </ul>
                  </div>

                  <div className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">Bloco em Markdown</span>
                    <p className="text-foreground">
                      <strong>Exemplo:</strong> O episódio introduz o arco de verão e aprofunda a relação entre Marin e Gojo.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button size="sm" className="bg-primary text-primary-foreground">
                        Assistir agora
                      </Button>
                      <Button size="sm" variant="secondary">
                        Baixar legendas
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p>
                      Entre as sequências de bastidores, a fotografia do episódio destaca texturas de tecido e expressões faciais mais
                      sutis. Esse cuidado impacta diretamente o ritmo da legenda, que precisa respeitar respirações e pausas.
                    </p>
                    <div className="overflow-hidden rounded-xl border border-border">
                      <img src="/placeholder.svg" alt="Storyboard" className="aspect-[16/9] w-full object-cover" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Storyboard exibido no meio do texto para contextualizar a discussão.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card shadow-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="mb-4 w-full overflow-hidden rounded-xl border border-border sm:w-32">
                      <img
                        src={projectEmbed.image}
                        alt={projectEmbed.title}
                        className="aspect-[2/3] w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-foreground">{projectEmbed.title}</h3>
                          <p className="text-sm text-muted-foreground">{projectEmbed.synopsis}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="secondary">{projectEmbed.format}</Badge>
                        <Badge variant="outline">{projectEmbed.status}</Badge>
                        <Badge variant="outline">{projectEmbed.studio}</Badge>
                        <Badge variant="outline">{projectEmbed.episodes}</Badge>
                        <Button size="sm" className="ml-auto">
                          Página do projeto
                        </Button>
                      </div>
                      <Separator />
                      <div className="grid gap-2.5 text-xs text-muted-foreground sm:grid-cols-2">
                        <div>
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground">Formato</span>
                          {projectEmbed.format}
                        </div>
                        <div>
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground">Status</span>
                          {projectEmbed.status}
                        </div>
                        <div>
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground">Estúdio</span>
                          {projectEmbed.studio}
                        </div>
                        <div>
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground">Episódios</span>
                          {projectEmbed.episodes}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-lg">Compartilhar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Share2 className="h-4 w-4 text-primary/70" aria-hidden="true" />
                    Envie este post nas redes sociais.
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
                        placeholder="Escreva um comentário ou feedback sobre o episódio..."
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
            </article>

            <aside className="space-y-6">
              <LatestEpisodeCard />
              <WorkStatusCard />
              <DiscordInviteCard />
            </aside>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Post;
