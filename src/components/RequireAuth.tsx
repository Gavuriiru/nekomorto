import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";

type RequireAuthProps = {
  children: React.ReactNode;
};

const RequireAuth = ({ children }: RequireAuthProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const apiBase = getApiBase();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true });
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
