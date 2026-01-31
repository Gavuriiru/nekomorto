import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock } from "lucide-react";

type WorkKind = "anime" | "manga";

interface WorkItem {
  id: number;
  title: string;
  entry: string;
  kind: WorkKind;
  currentStage: string;
  completedStages: string[];
}

const animeStages = [
  { id: "aguardando-raw", label: "Aguardando Raw", color: "bg-slate-500", badge: "bg-slate-500/20 text-slate-300 border-slate-500/40" },
  { id: "traducao", label: "Tradução", color: "bg-blue-500", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "revisao", label: "Revisão", color: "bg-yellow-500", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { id: "timing", label: "Timing", color: "bg-pink-500", badge: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  { id: "typesetting", label: "Typesetting", color: "bg-indigo-500", badge: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  { id: "quality-check", label: "Quality Check", color: "bg-orange-500", badge: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { id: "encode", label: "Encode", color: "bg-purple-500", badge: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
];

const mangaStages = [
  { id: "aguardando-raw", label: "Aguardando Raw", color: "bg-slate-500", badge: "bg-slate-500/20 text-slate-300 border-slate-500/40" },
  { id: "traducao", label: "Tradução", color: "bg-blue-500", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "limpeza", label: "Limpeza", color: "bg-emerald-500", badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { id: "redrawing", label: "Redrawing", color: "bg-cyan-500", badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { id: "revisao", label: "Revisão", color: "bg-yellow-500", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { id: "typesetting", label: "Typesetting", color: "bg-indigo-500", badge: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  { id: "quality-check", label: "Quality Check", color: "bg-orange-500", badge: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
];

const workItems: WorkItem[] = [
  {
    id: 1,
    title: "Spy x Family",
    entry: "Episódio 9",
    kind: "anime",
    currentStage: "traducao",
    completedStages: ["aguardando-raw"],
  },
  {
    id: 2,
    title: "Jujutsu Kaisen",
    entry: "Episódio 16",
    kind: "anime",
    currentStage: "timing",
    completedStages: ["aguardando-raw", "traducao", "revisao"],
  },
  {
    id: 3,
    title: "Frieren",
    entry: "Episódio 21",
    kind: "anime",
    currentStage: "quality-check",
    completedStages: ["aguardando-raw", "traducao", "revisao", "timing", "typesetting"],
  },
  {
    id: 4,
    title: "Oshi no Ko",
    entry: "Episódio 7",
    kind: "anime",
    currentStage: "typesetting",
    completedStages: ["aguardando-raw", "traducao"],
  },
  {
    id: 5,
    title: "Bocchi the Rock!",
    entry: "Episódio 3",
    kind: "anime",
    currentStage: "revisao",
    completedStages: ["aguardando-raw", "traducao", "timing"],
  },
  {
    id: 6,
    title: "Kagurabachi",
    entry: "Capítulo 32",
    kind: "manga",
    currentStage: "limpeza",
    completedStages: ["aguardando-raw"],
  },
  {
    id: 7,
    title: "Sousou no Frieren",
    entry: "Capítulo 128",
    kind: "manga",
    currentStage: "typesetting",
    completedStages: ["aguardando-raw", "traducao", "limpeza", "redrawing", "revisao"],
  },
  {
    id: 8,
    title: "Chainsaw Man",
    entry: "Capítulo 161",
    kind: "manga",
    currentStage: "revisao",
    completedStages: ["aguardando-raw", "limpeza"],
  },
];

const WorkStatusCard = () => {
  const itemsInProgress = workItems.filter((item) => {
    const stages = item.kind === "anime" ? animeStages : mangaStages;
    const completedSet = new Set([...item.completedStages, item.currentStage]);
    const finalStage = stages[stages.length - 1]?.id;
    return finalStage ? !completedSet.has(finalStage) : true;
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="px-4 pb-3 pt-4">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Em Progresso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        {itemsInProgress.map((item) => {
          const stages = item.kind === "anime" ? animeStages : mangaStages;
          const completedSet = new Set([...item.completedStages, item.currentStage]);
          const completedCount = stages.filter((stage) => completedSet.has(stage.id)).length;
          const progress = Math.round((completedCount / stages.length) * 100);
          const currentStage = stages.find((stage) => stage.id === item.currentStage) ?? stages[0];

          return (
            <div 
              key={item.id}
              className="rounded-md bg-secondary/50 p-3 hover:bg-secondary transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.title}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {item.entry}
                  </span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`flex-shrink-0 flex items-center gap-1 ${currentStage.badge}`}
                >
                  {currentStage.label}
                </Badge>
              </div>
              <div className="mt-3">
                <Progress
                  value={progress}
                  className="h-2"
                  indicatorClassName={currentStage.color}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default WorkStatusCard;
