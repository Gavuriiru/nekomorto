import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-site-settings";

const DiscordInviteCard = () => {
  const { settings } = useSiteSettings();
  const inviteCard = settings.community.inviteCard;
  const ctaHref = String(inviteCard.ctaUrl || settings.community.discordUrl || "#").trim() || "#";

  return (
    <Card className="bg-card border-border reveal" data-reveal>
      <CardHeader className="px-4 pb-3 pt-4">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary/80" />
          {inviteCard.title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{inviteCard.subtitle}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 pb-4 pt-0">
        <div className="group/panel space-y-2 rounded-xl border border-border/60 bg-background/40 p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-background/70 hover:shadow-lg">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground transition-colors duration-300 group-hover/panel:text-primary">
            <Users className="h-4 w-4 text-primary/80 transition-colors duration-300 group-hover/panel:text-primary" aria-hidden="true" />
            {inviteCard.panelTitle}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed transition-colors duration-300 group-hover/panel:text-foreground/80">{inviteCard.panelDescription}</p>
        </div>

        <Button asChild className="w-full">
          <a href={ctaHref} target="_blank" rel="noreferrer">
            {inviteCard.ctaLabel}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
};

export default DiscordInviteCard;


