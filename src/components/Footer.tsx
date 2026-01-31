import { Facebook, Instagram, Twitter, Youtube, MessageCircle } from "lucide-react";

const footerColumns = [
  {
    title: "Nekomata",
    links: [
      { label: "Sobre", href: "/sobre" },
      { label: "Equipe", href: "/equipe" },
      { label: "Contato", href: "/contato" },
    ],
  },
  {
    title: "Ajude nossa equipe",
    links: [
      { label: "Recrutamento", href: "/recrutamento" },
      { label: "Doações", href: "/doacoes" },
      { label: "Vantagens de apoiador", href: "/apoiadores" },
    ],
  },
  {
    title: "Links úteis",
    links: [
      { label: "Projetos", href: "/projetos" },
      { label: "FAQ", href: "/faq" },
      { label: "Política de privacidade", href: "/privacidade" },
      { label: "Reportar erros", href: "/suporte" },
      { label: "Info Anime", href: "https://infoanime.com.br" },
    ],
  },
];

const socialLinks = [
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: Instagram,
  },
  {
    label: "Facebook",
    href: "https://facebook.com",
    icon: Facebook,
  },
  {
    label: "Twitter",
    href: "https://twitter.com",
    icon: Twitter,
  },
  {
    label: "YouTube",
    href: "https://youtube.com",
    icon: Youtube,
  },
  {
    label: "Discord",
    href: "https://discord.gg/nekogroup",
    icon: MessageCircle,
  },
];

const Footer = () => {
  return (
    <footer className="mt-16 border-t border-border/60 bg-card/60">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr_1.1fr]">
          <div className="space-y-4">
            <p className="text-3xl font-black tracking-widest text-gradient-rainbow">NEKOMATA</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Fansub dedicada a trazer histórias inesquecíveis com o carinho que a comunidade merece.
              Traduzimos por paixão, respeitando autores e apoiando o consumo legal das obras.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title} className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {column.title}
              </p>
              <ul className="space-y-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-foreground/80 transition-colors hover:text-primary"
                    >
                      {link.label}
                    </a>
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
              {socialLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    className="group flex items-center gap-3 text-sm text-foreground/80 transition-colors hover:text-primary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-secondary/70 text-primary/80 transition group-hover:border-primary/40 group-hover:text-primary">
                      <Icon className="h-4 w-4" aria-hidden="true" />
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
            <p>
              Todo o conteúdo divulgado aqui pertence a seus respectivos autores e editoras. As traduções
              são realizadas por fãs, sem fins lucrativos, com o objetivo de divulgar as obras no Brasil.
            </p>
            <p>
              Caso goste de alguma obra, apoie a versão oficial. A venda de materiais legendados pela equipe
              é proibida.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-gradient-card p-5 text-sm text-foreground">
            <p className="font-semibold text-primary">Atribuição • Não Comercial • Compartilhe Igual</p>
            <p className="text-muted-foreground">
              Este site segue a licença Creative Commons BY-NC-SA. Você pode compartilhar com créditos, sem
              fins comerciais e mantendo a mesma licença.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-12">
          <p>© 2014 - 2026 Nekomata Fansub. Feito por fãs para fãs.</p>
          <div className="flex flex-wrap gap-4">
            <a href="/termos" className="transition-colors hover:text-primary">
              Termos de uso
            </a>
            <a href="/privacidade" className="transition-colors hover:text-primary">
              Política de privacidade
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
