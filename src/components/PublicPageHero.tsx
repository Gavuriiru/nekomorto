import type { CSSProperties, ReactNode } from "react";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import { Badge } from "@/components/ui/badge";
import "@/styles/public-page-hero.css";

type PublicPageHeroProps = {
  badge?: string;
  title: string;
  subtitle?: string;
  badges?: string[];
  children?: ReactNode;
};

const subtitleAnimationDelay = {
  animationDelay: "0.2s",
} as CSSProperties;

const badgesAnimationDelay = {
  animationDelay: "0.4s",
} as CSSProperties;

const PublicPageHero = ({ badge, title, subtitle, badges = [], children }: PublicPageHeroProps) => {
  const badgeLabel = String(badge || "").trim();
  const badgeItems = badges.map((item) => String(item || "").trim()).filter(Boolean);

  return (
    <section className="public-page-hero">
      <div
        className={`${publicPageLayoutTokens.sectionBase} public-page-hero__inner max-w-6xl pb-8 pt-20 md:pb-10 md:pt-28`}
      >
        <div className="public-page-hero__copy reveal space-y-4" data-reveal>
          {badgeLabel ? (
            <Badge
              variant="secondary"
              className="text-xs uppercase tracking-widest animate-fade-in"
            >
              {badgeLabel}
            </Badge>
          ) : null}
          <h1 className="text-3xl font-semibold text-foreground md:text-5xl animate-slide-up">
            {title}
          </h1>
          {subtitle ? (
            <p
              className="text-sm text-muted-foreground md:text-base animate-slide-up opacity-0"
              style={subtitleAnimationDelay}
            >
              {subtitle}
            </p>
          ) : null}
          {badgeItems.length > 0 ? (
            <div
              className="flex flex-wrap gap-3 animate-slide-up opacity-0"
              style={badgesAnimationDelay}
            >
              {badgeItems.map((item) => (
                <Badge key={item} variant="secondary" className="text-xs uppercase tracking-widest">
                  {item}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </section>
  );
};

export default PublicPageHero;
