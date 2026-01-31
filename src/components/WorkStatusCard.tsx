import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, Edit3, Eye, Mic } from "lucide-react";

type WorkStatus = "traducao" | "revisao" | "encode" | "qc" | "finalizado";

interface WorkItem {
  id: number;
  anime: string;
  episode: number;
  status: WorkStatus;
}

const statusConfig: Record<WorkStatus, { label: string; color: string; icon: React.ReactNode }> = {
  traducao: { 
    label: "Tradução", 
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: <Edit3 className="w-3 h-3" />
  },
  revisao: { 
    label: "Revisão", 
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: <Eye className="w-3 h-3" />
  },
  encode: { 
    label: "Encode", 
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: <Mic className="w-3 h-3" />
  },
  qc: { 
    label: "QC", 
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    icon: <CheckCircle className="w-3 h-3" />
  },
  finalizado: { 
    label: "Finalizado", 
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: <CheckCircle className="w-3 h-3" />
  },
};

const workItems: WorkItem[] = [
  { id: 1, anime: "Spy x Family", episode: 9, status: "traducao" },
  { id: 2, anime: "Jujutsu Kaisen", episode: 16, status: "revisao" },
  { id: 3, anime: "Frieren", episode: 21, status: "encode" },
  { id: 4, anime: "Oshi no Ko", episode: 7, status: "qc" },
  { id: 5, anime: "Bocchi the Rock!", episode: 3, status: "traducao" },
];

const WorkStatusCard = () => {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="px-4 pb-3 pt-4">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Em Progresso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        {workItems.map((item) => {
          const config = statusConfig[item.status];
          return (
            <div 
              key={item.id}
              className="flex items-center justify-between p-2 rounded-md bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.anime}
                </p>
                <span className="text-xs text-muted-foreground">
                  Episódio {item.episode}
                </span>
              </div>
              <Badge 
                variant="outline" 
                className={`ml-2 flex-shrink-0 flex items-center gap-1 ${config.color}`}
              >
                {config.icon}
                {config.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default WorkStatusCard;
