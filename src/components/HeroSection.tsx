import heroImage from "@/assets/hero-illya.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-end overflow-hidden">
      {/* Background Image - positioned to show character on the right */}
      <div 
        className="absolute inset-0 bg-cover bg-right-top md:bg-center bg-no-repeat scale-105"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      
      {/* Gradient Overlay - darker on the left for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
      
      {/* Bottom gradient for smooth transition */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      
      {/* Content */}
      <div className="relative z-10 w-full px-6 md:px-12 pb-16 md:pb-24">
        <div className="max-w-3xl">
          {/* Badge for latest release */}
          <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 rounded-full animate-fade-in">
            Último Lançamento
          </span>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 animate-slide-up text-foreground leading-tight">
            Fate/Kaleid Liner Prisma Illya
          </h1>
          
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl animate-slide-up opacity-0" style={{ animationDelay: "0.2s" }}>
            Illya (Illyasviel von Einzbern) é uma típica estudante do Instituto Homurabara 
            que tem uma quedinha por seu cunhado. Certa noite, uma varinha de condão chamada 
            Cajado Rubi cai do céu em sua banheira e a faz assinar um contrato...
          </p>
          
          <div className="mt-8 flex flex-wrap gap-4 animate-slide-up opacity-0" style={{ animationDelay: "0.4s" }}>
            <button className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all hover:scale-105">
              Assistir Agora
            </button>
            <button className="px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold rounded-lg transition-all hover:scale-105">
              Ver Detalhes
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
