import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import UploadPicture from "@/components/UploadPicture";
import { formatDate } from "@/lib/date";
import { PROJECT_COVER_ASPECT_RATIO } from "@/lib/project-card-layout";

const PT_DIACRITICS_REGEX = /[\u0300-\u036f]/g;

const normalizeLookupKey = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(PT_DIACRITICS_REGEX, "")
    .trim()
    .toLowerCase();

const applyReplacementWithCase = (input: string, replacement: string) => {
  const source = String(input || "");
  if (!source) {
    return replacement;
  }
  if (source === source.toUpperCase()) {
    return replacement.toUpperCase();
  }
  const first = source.charAt(0);
  const rest = source.slice(1);
  if (first === first.toUpperCase() && rest === rest.toLowerCase()) {
    return `${replacement.charAt(0).toUpperCase()}${replacement.slice(1)}`;
  }
  return replacement;
};

const LEGACY_REASON_WORD_REPLACEMENTS: Array<{ from: string; to: string }> = [
  { from: "lancamento", to: "lançamento" },
  { from: "capitulo", to: "capítulo" },
  { from: "episodio", to: "episódio" },
  { from: "disponivel", to: "disponível" },
  { from: "conteudo", to: "conteúdo" },
  { from: "atualizacoes", to: "atualizações" },
  { from: "atualizacao", to: "atualização" },
];

const normalizeReasonForDisplay = (value: string) =>
  LEGACY_REASON_WORD_REPLACEMENTS.reduce((result, item) => {
    const regex = new RegExp(`\\b${item.from}\\b`, "gi");
    return result.replace(regex, (match) => applyReplacementWithCase(match, item.to));
  }, String(value || ""));

const LatestEpisodeCard = () => {
  const { data: bootstrapData, isLoading } = usePublicBootstrap();
  const recentUpdates = bootstrapData?.updates || [];
  const mediaVariants = bootstrapData?.mediaVariants || {};
  const isLoadingUpdates = isLoading && !bootstrapData;
  const projectTypes = useMemo(() => {
    const map: Record<string, string> = {};
    (bootstrapData?.projects || []).forEach((project) => {
      if (project?.id) {
        map[String(project.id)] = String(project.type || "");
      }
    });
    return map;
  }, [bootstrapData?.projects]);

  return (
    <Card
      lift={false}
      className="bg-card border-border overflow-hidden reveal transition-all duration-300 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg"
      data-reveal
    >
      <CardHeader className="px-4 pb-3 pt-4">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Atualizações Recentes
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Novos links ou ajustes em episódios/capítulos publicados.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        {isLoadingUpdates ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`update-skeleton-${index}`}
                className="flex items-start gap-4 rounded-xl bg-background/40 p-4"
              >
                <Skeleton className="h-20 w-16 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : recentUpdates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-background/50 p-4 text-xs text-muted-foreground">
            Nenhuma atualização recente cadastrada.
          </div>
        ) : (
          <div className="space-y-3">
            {[...recentUpdates]
              .sort(
                (a, b) =>
                  new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
              )
              .slice(0, 4)
              .map((update) => {
                const typeLabel = (projectTypes[update.projectId] || "").toLowerCase();
                const hasChapterHint =
                  /cap/i.test(update.unit || "") || /cap/i.test(update.reason || "");
                const isChapterBased =
                  typeLabel.includes("mang") ||
                  typeLabel.includes("webtoon") ||
                  typeLabel.includes("light") ||
                  typeLabel.includes("novel") ||
                  hasChapterHint;
                const rawUnitLabel = String(update.unit || "").trim();
                const unitLookup = normalizeLookupKey(rawUnitLabel);
                const unitLabel = rawUnitLabel
                  ? unitLookup === "capitulo"
                    ? "Capítulo"
                    : unitLookup === "episodio"
                      ? "Episódio"
                      : rawUnitLabel
                  : isChapterBased
                    ? "Capítulo"
                    : "Episódio";
                const isExtraUnit = unitLabel.toLowerCase() === "extra";
                const unitShort = isExtraUnit ? "Extra" : /cap/i.test(unitLabel) ? "Cap" : "Ep";
                const normalizedReason = normalizeReasonForDisplay(String(update.reason || ""));
                const reason = normalizedReason
                  ? normalizedReason.charAt(0).toUpperCase() + normalizedReason.slice(1)
                  : "";
                const normalizedKind = normalizeLookupKey(String(update.kind || ""));
                const kindLabel =
                  normalizedKind.startsWith("lan")
                    ? "Lançamento"
                    : normalizedKind.includes("ajuste") || normalizedKind.includes("atualiza")
                      ? "Ajuste"
                      : update.kind;
                return (
                  <Link
                    key={update.id}
                    to={`/projeto/${update.projectId}`}
                    style={{ "--card-h": "164px", "--card-pad": "16px" } as CSSProperties}
                    className="recent-updates-item group relative block h-(--card-h) overflow-hidden rounded-2xl bg-linear-to-br from-background/70 via-background/40 to-background/70 hover:-translate-y-1 reveal"
                    data-reveal
                  >
                    <div className="absolute inset-(--card-pad) flex items-start gap-4">
                      <div
                        className="h-full shrink-0 overflow-hidden rounded-xl bg-secondary/60"
                        style={{ aspectRatio: PROJECT_COVER_ASPECT_RATIO }}
                      >
                        <UploadPicture
                          src={update.image || "/placeholder.svg"}
                          alt={update.projectTitle}
                          preset="posterThumb"
                          mediaVariants={mediaVariants}
                          sizes="96px"
                          className="block h-full w-full"
                          imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="flex h-full min-w-0 flex-1 flex-col gap-3">
                        <div className="no-scrollbar flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto md:flex-wrap md:overflow-visible">
                          <Badge variant="secondary" className="hidden shrink-0 text-[10px] md:inline-flex">
                            {isExtraUnit ? "Extra" : `${unitShort} ${update.episodeNumber}`}
                          </Badge>
                          {update.volume ? (
                            <Badge variant="outline" className="hidden shrink-0 text-[10px] md:inline-flex">
                              Vol. {update.volume}
                            </Badge>
                          ) : null}
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] ${
                              kindLabel === "Lançamento"
                                ? "border-primary/50 text-primary"
                                : kindLabel === "Ajuste"
                                  ? "border-amber-500/50 text-amber-400"
                                  : "border-border/60 text-muted-foreground"
                            }`}
                          >
                            {kindLabel}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary line-clamp-2">
                            {update.projectTitle}
                          </h4>
                          <p className="line-clamp-1 text-xs leading-relaxed text-muted-foreground md:line-clamp-2">
                            {reason}
                          </p>
                        </div>
                        <span className="mt-auto inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3 text-primary/70" aria-hidden="true" />
                          {formatDate(update.updatedAt.split("T")[0])}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LatestEpisodeCard;
