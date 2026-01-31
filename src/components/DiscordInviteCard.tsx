import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users } from "lucide-react";

const DiscordInviteCard = () => {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="px-4 pb-3 pt-4">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          Entre no Discord
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Converse com a equipe e acompanhe novidades em tempo real.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 pb-4 pt-0">
        <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-primary/80" aria-hidden="true" />
            Comunidade do Zuraaa!
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Receba alertas de lançamentos, participe de eventos e fale
            sobre os nossos projetos.
          </p>
        </div>
        <Button asChild className="w-full">
          <a
            href="https://discord.gg/BAHKhdX2ju"
            target="_blank"
            rel="noreferrer"
          >
            Entrar no servidor
          </a>
        </Button>
      </CardContent>
    </Card>
  );
};

export default DiscordInviteCard;
