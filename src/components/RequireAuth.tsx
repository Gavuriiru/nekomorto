import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type RequireAuthProps = {
  children: React.ReactNode;
};

const RequireAuth = ({ children }: RequireAuthProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const apiBase = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8080";

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${apiBase}/api/me`, { credentials: "include" });
        if (!response.ok) {
          const next = encodeURIComponent(location.pathname);
          navigate(`/login?next=${next}`);
          return;
        }
        setIsChecking(false);
      } catch {
        const next = encodeURIComponent(location.pathname);
        navigate(`/login?next=${next}`);
      }
    };

    checkAuth();
  }, [apiBase, location.pathname, navigate]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Verificando acesso...</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireAuth;
