import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  getFirstAllowedDashboardRoute,
  isDashboardPathAllowed,
  isFrontendRbacV2Enabled,
  resolveGrants,
} from "@/lib/access-control";
import { toast } from "@/components/ui/use-toast";

type RequireAuthProps = {
  children: React.ReactNode;
};

const RequireAuth = ({ children }: RequireAuthProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const apiBase = getApiBase();

  useEffect(() => {
    let isActive = true;
    const checkAuth = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true });
        if (!response.ok) {
          const next = encodeURIComponent(`${location.pathname}${location.search || ""}`);
          navigate(`/login?next=${next}`);
          return;
        }
        const user = await response.json();
        const grants = resolveGrants(user || null);
        if (
          isFrontendRbacV2Enabled &&
          location.pathname.startsWith("/dashboard") &&
          !isDashboardPathAllowed(location.pathname, grants)
        ) {
          const target = getFirstAllowedDashboardRoute(grants);
          toast({
            title: "Acesso negado",
            description: "Você foi redirecionado para uma área permitida do painel.",
          });
          navigate(target, { replace: true });
          return;
        }
        if (isActive) {
          setIsChecking(false);
        }
      } catch {
        const next = encodeURIComponent(`${location.pathname}${location.search || ""}`);
        navigate(`/login?next=${next}`);
      }
    };

    void checkAuth();
    return () => {
      isActive = false;
    };
  }, [apiBase, location.pathname, location.search, navigate]);

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
