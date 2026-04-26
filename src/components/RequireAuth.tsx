import AppLoadingFallback from "@/components/AppLoadingFallback";
import { toast } from "@/components/ui/use-toast";
import { useDashboardSession } from "@/hooks/use-dashboard-session";
import {
  getFirstAllowedDashboardRoute,
  getDashboardRouteRequirement,
  isDashboardPathAllowed,
  resolveAccessRole,
  resolveGrants,
} from "@/lib/access-control";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type RequireAuthProps = {
  children: React.ReactNode;
};

const RequireAuth = ({ children }: RequireAuthProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardSession = useDashboardSession();
  const [isChecking, setIsChecking] = useState(!dashboardSession.hasResolved);
  const apiBase = getApiBase();
  const providerAccess = useMemo(() => {
    if (!dashboardSession.hasProvider || !dashboardSession.hasResolved) {
      return null;
    }

    const user = dashboardSession.currentUser;
    if (!user) {
      return { status: "unauthenticated" as const };
    }

    const grants = resolveGrants(user || null);
    const accessRole = resolveAccessRole(user || null);
    if (
      location.pathname.startsWith("/dashboard") &&
      !isDashboardPathAllowed(location.pathname, grants, { accessRole })
    ) {
      const isOwnerRoute = getDashboardRouteRequirement(location.pathname) === "owner";
      return {
        status: "redirect" as const,
        target: getFirstAllowedDashboardRoute(grants, { accessRole }),
        toast: {
          title: "Acesso negado",
          description: isOwnerRoute
            ? "A área de segurança é restrita aos donos."
            : "Você foi redirecionado para uma área permitida do painel.",
        },
      };
    }

    return { status: "authorized" as const };
  }, [
    dashboardSession.currentUser,
    dashboardSession.hasProvider,
    dashboardSession.hasResolved,
    location.pathname,
  ]);

  useEffect(() => {
    if (dashboardSession.hasProvider) {
      if (!dashboardSession.hasResolved) {
        setIsChecking(true);
        return;
      }

      if (providerAccess?.status === "unauthenticated") {
        const next = encodeURIComponent(`${location.pathname}${location.search || ""}`);
        navigate(`/login?next=${next}`);
        return;
      }

      if (providerAccess?.status === "redirect") {
        toast(providerAccess.toast);
        navigate(providerAccess.target, { replace: true });
        return;
      }

      setIsChecking(false);
      return;
    }

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
        const accessRole = resolveAccessRole(user || null);
        if (
          location.pathname.startsWith("/dashboard") &&
          !isDashboardPathAllowed(location.pathname, grants, { accessRole })
        ) {
          const target = getFirstAllowedDashboardRoute(grants, { accessRole });
          const isOwnerRoute = getDashboardRouteRequirement(location.pathname) === "owner";
          toast({
            title: "Acesso negado",
            description: isOwnerRoute
              ? "A área de segurança é restrita aos donos."
              : "Você foi redirecionado para uma área permitida do painel.",
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
  }, [
    apiBase,
    dashboardSession.hasProvider,
    dashboardSession.hasResolved,
    location.pathname,
    location.search,
    navigate,
    providerAccess,
  ]);

  if (isChecking) {
    return <AppLoadingFallback fullScreen label="Verificando acesso..." />;
  }

  return <>{children}</>;
};

export default RequireAuth;
