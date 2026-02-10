import { Facebook, Instagram, Twitter, MessageCircle, Youtube, X, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/use-site-settings";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import { resolveBranding } from "@/lib/branding";

const Footer = () => {
  const { settings } = useSiteSettings();
  const footer = settings.footer;
  const footerColumns = footer.columns || [];
  const socialLinks = footer.socialLinks || [];
  const disclaimer = footer.disclaimer || [];
  const brandName = (settings.site.name || footer.brandName || "Nekomata").trim() || "Nekomata";
  const brandNameUpper = brandName.toUpperCase();
  const branding = resolveBranding(settings);
  const footerWordmarkUrl = branding.footer.wordmarkUrl;
  const footerSymbolUrl = branding.footer.symbolUrl;
  const footerMode = branding.footer.mode;
  const showWordmarkInFooter = branding.footer.showWordmark;
  const renderCopyright = () => {
    const text = footer.copyright || "";
    const marker = "©";
    const index = text.indexOf(marker);
    if (index === -1) {
      return <p>{text}</p>;
    }
    const before = text.slice(0, index);
    const after = text.slice(index + marker.length);
    return (
      <p>
        {before}
        <Link to="/login" className="text-muted-foreground/70 hover:text-foreground transition-colors">
          {marker}
        </Link>
        {after}
      </p>
    );
  };
  const isInternalLink = (href: string) => href.startsWith("/") && !href.startsWith("//");
  const iconMap: Record<string, typeof Globe> = {
    instagram: Instagram,
    facebook: Facebook,
    twitter: Twitter,
    x: X,
    youtube: Youtube,
    discord: MessageCircle,
    "message-circle": MessageCircle,
    globe: Globe,
    site: Globe,
  };
  const isIconUrl = (value?: string | null) =>
    Boolean(value && (value.startsWith("http") || value.startsWith("data:") || value.startsWith("/uploads/")));

  return (
    <footer className="mt-16 border-t border-border/60 bg-card/60">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1.1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {showWordmarkInFooter ? (
                <>
                  <img
                    src={footerWordmarkUrl}
                    alt={brandName}
                    className="h-9 md:h-12 w-auto max-w-[220px] md:max-w-[280px] object-contain"
                  />
                  <span className="sr-only">{brandName}</span>
                </>
              ) : footerMode === "text" ? (
                <p className="text-3xl font-black tracking-widest text-gradient-rainbow">
                  {brandNameUpper}
                </p>
              ) : (
                <>
                  {footerSymbolUrl ? (
                    <ThemedSvgLogo
                      url={footerSymbolUrl}
                      label={brandName}
                      className="h-10 w-10 rounded-full object-cover shadow-sm text-primary"
                    />
                  ) : null}
                  <p className="text-3xl font-black tracking-widest text-gradient-rainbow">
                    {brandNameUpper}
                  </p>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {footer.brandDescription}
            </p>
          </div>

          {footerColumns.map((column, columnIndex) => (
            <div key={`${column.title}-${columnIndex}`} className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {column.title}
              </p>
              <ul className="space-y-2 text-sm">
                {column.links.map((link, linkIndex) => (
                  <li key={`${link.label}-${link.href}-${linkIndex}`}>
                    {isInternalLink(link.href) ? (
                      <Link
                        to={link.href}
                        className="text-foreground/80 transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-foreground/80 transition-colors hover:text-primary"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Siga-nos
            </p>
            <div className="space-y-2">
              {socialLinks.map((link, linkIndex) => {
                const iconKey = link.icon || link.label;
                const iconValue = String(iconKey || "");
                const Icon = iconMap[iconValue.toLowerCase()] || Globe;
                const renderCustomIcon = isIconUrl(iconValue);
                return (
                  <a
                    key={`${link.label}-${link.href}-${linkIndex}`}
                    href={link.href}
                    className="group flex items-center gap-3 text-sm text-foreground/80 transition-colors hover:text-primary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-secondary/70 text-primary/80 transition group-hover:border-primary/40 group-hover:text-primary">
                      {renderCustomIcon ? (
                        <ThemedSvgLogo
                          url={iconValue}
                          label={link.label}
                          className="h-4 w-4 text-primary"
                        />
                      ) : (
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    {link.label}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-6 border-t border-border/60 pt-8 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3 text-sm text-muted-foreground">
            {disclaimer.map((item, index) => (
              <p key={`footer-disclaimer-${index}`}>{item}</p>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-gradient-card p-5 text-sm text-foreground">
            <p className="font-semibold text-primary">{footer.highlightTitle}</p>
            <p className="text-muted-foreground">{footer.highlightDescription}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-12">
          {renderCopyright()}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
