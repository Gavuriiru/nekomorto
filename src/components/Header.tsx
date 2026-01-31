import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 md:px-12">
      <nav className="flex items-center justify-between">
        <Link to="/" className="text-2xl md:text-3xl font-black tracking-wider text-foreground">
          NEKOMATA
        </Link>
        
        <div className="flex items-center gap-6 md:gap-8">
          <Link 
            to="/" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Início
          </Link>
          <Link 
            to="/animes" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Animes
          </Link>
          <Link 
            to="/login" 
            className="text-sm font-medium px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
          >
            Entrar
          </Link>
        </div>
      </nav>
    </header>
  );
};

export default Header;
