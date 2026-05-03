import PublicPageContainer from "@/components/PublicPageContainer";
import { usePageMeta } from "@/hooks/use-page-meta";

const TermsOfService = () => {
  usePageMeta({
    title: "Termos de Uso",
    description:
      "Regras resumidas para uso do site, comentários públicos, acesso a áreas restritas e integrações de terceiros.",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicPageContainer maxWidth="3xl" mainClassName="pt-28" className="pb-20">
        <div className="space-y-10 rounded-3xl border border-border/60 bg-card/75 p-6 shadow-sm md:p-8">
          <header className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Informações legais
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Termos de Uso</h1>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Estes Termos de Uso descrevem, de forma resumida, as regras aplicáveis ao uso do site,
              aos comentários públicos e ao acesso a áreas restritas da plataforma.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Uso do site</h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              O site pode ser utilizado para navegação pública e, quando aplicável, para interação
              com recursos disponibilizados pela plataforma. O uso deve ocorrer de forma legítima,
              sem abuso técnico, fraude, automação indevida ou tentativa de contornar autenticação,
              segurança, moderação ou rate limiting.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. Comentários públicos</h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Comentários enviados por usuários podem passar por moderação antes de aparecer no
              site. Conteúdo com spam, ofensa, fraude, violação de direitos ou qualquer uso
              incompatível com a finalidade da plataforma poderá ser recusado, ocultado ou removido.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Cada pessoa usuária é responsável pelo conteúdo que envia e pelas consequências da sua
              publicação.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. Áreas restritas</h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Algumas áreas são destinadas exclusivamente à equipe e dependem de autenticação e
              autorização específicas. O uso de um provedor de login não garante, por si só,
              liberação de acesso ao painel ou a outras áreas internas.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4. Serviços de terceiros</h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Parte da experiência pode envolver serviços externos, como provedores de autenticação
              e serviços de avatar. Quando isso ocorrer, o tratamento correspondente também poderá
              estar sujeito aos termos e políticas desses terceiros.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Atualizações</h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Estes Termos de Uso podem ser atualizados para refletir mudanças técnicas,
              operacionais ou legais. A versão publicada nesta página será considerada a versão
              vigente.
            </p>
          </section>
        </div>
      </PublicPageContainer>
    </div>
  );
};

export default TermsOfService;
