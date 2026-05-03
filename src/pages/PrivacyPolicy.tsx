import PublicPageContainer from "@/components/PublicPageContainer";
import { usePageMeta } from "@/hooks/use-page-meta";

const PrivacyPolicy = () => {
  usePageMeta({
    title: "Política de Privacidade",
    description:
      "Resumo de como o site trata dados de comentários públicos, autenticação, segurança e operação da plataforma.",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicPageContainer maxWidth="3xl" mainClassName="pt-28" className="pb-20">
        <div className="space-y-10 rounded-3xl border border-border/60 bg-card/75 p-6 shadow-sm md:p-8">
          <header className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Informações legais
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Política de Privacidade
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Esta Política de Privacidade explica, de forma objetiva, como tratamos dados ligados
              ao uso do site, aos comentários públicos, à autenticação e à operação da plataforma.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Dados fornecidos por você</h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Ao enviar um comentário público, podemos tratar o nome escolhido, o conteúdo enviado e
              um e-mail opcional. Também podem ser processados dados de contexto do próprio
              comentário, como a página ou item ao qual ele está vinculado.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. Comentários e avatar</h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Comentários aprovados podem exibir publicamente o nome informado, o conteúdo enviado,
              a data da publicação e o avatar associado ao comentário. Quando o e-mail opcional é
              informado, ele pode ser usado para obter avatar por meio do Gravatar.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. Login e áreas restritas</h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Para acesso a áreas restritas da plataforma, podemos tratar dados de autenticação
              fornecidos por provedores autorizados, como Google e Discord, além das informações
              necessárias para sessão, segurança e controle de acesso.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              O Login com Google é usado para autenticar usuários autorizados da equipe no dashboard
              e em outras áreas internas. Esse login não é necessário para visitantes navegarem
              pelas páginas públicas do site.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4. Segurança e operação</h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Dados técnicos e operacionais podem ser tratados para autenticação, manutenção de
              sessão, moderação, prevenção de spam, rate limiting, segurança, diagnóstico e operação
              geral do serviço. Isso pode incluir registros técnicos e identificadores necessários
              para proteger a plataforma.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Retenção e terceiros</h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Os dados podem ser mantidos pelo tempo necessário para operação do site, moderação,
              segurança e cumprimento de obrigações aplicáveis. Quando houver uso de serviços de
              terceiros, como autenticação externa ou avatar, o tratamento correspondente também
              pode seguir as políticas próprias desses serviços.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">6. Atualizações desta política</h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Esta Política de Privacidade pode ser atualizada para refletir mudanças técnicas,
              operacionais ou legais. A versão publicada nesta página será considerada a versão
              vigente.
            </p>
          </section>
        </div>
      </PublicPageContainer>
    </div>
  );
};

export default PrivacyPolicy;
