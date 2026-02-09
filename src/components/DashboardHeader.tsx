import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, LogOut, Settings, UserCircle2 } from "lucide-react";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import { dashboardMenuItems as defaultMenuItems, type DashboardMenuItem } from "@/components/dashboard-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type DashboardHeaderUser = {
  name?: string;
  username?: string;
  avatarUrl?: string | null;
};

type DashboardHeaderProps = {
  currentUser?: DashboardHeaderUser | null;
  menuItems?: DashboardMenuItem[];
  className?: string;
};

const DashboardHeader = ({
  currentUser,
  menuItems = defaultMenuItems,
  className,
}: DashboardHeaderProps) => {
  const location = useLocation();
  const apiBase = getApiBase();
  const { settings } = useSiteSettings();
  const isMobile = useIsMobile();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const activeMenuItem = useMemo(() => {
    const exactMatch = menuItems.find((item) => item.href === location.pathname);
    if (exactMatch) {
      return exactMatch;
    }
    const prefixedMatch = menuItems.find(
      (item) => item.href !== "/dashboard" && location.pathname.startsWith(`${item.href}/`),
    );
    return prefixedMatch ?? menuItems.find((item) => item.href === "/dashboard") ?? null;
  }, [location.pathname, menuItems]);

  const siteName = (settings.site.name || "Nekomata").toUpperCase();
  const logoUrl = settings.site.logoUrl?.trim();
  const userName = currentUser?.name || currentUser?.username || "Conta";
  const userInitials = (currentUser?.name || currentUser?.username || "??")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      await apiFetch(apiBase, "/api/logout", {
        method: "POST",
        auth: true,
      });
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <header
      style={
        {
          left: isMobile
            ? "0px"
            : "calc(var(--sidebar-offset) - (0.3125rem + min(0.1875rem, max(0rem, calc(var(--sidebar-width-current) - var(--sidebar-width-icon))))))",
        }
      }
      className={cn(
        "fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-[linear-gradient(110deg,hsl(var(--sidebar-background)/0.92),hsl(var(--background)/0.9))] backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex h-[4.75rem] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="h-9 w-9 rounded-lg border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white" />
          <div className="h-7 w-px bg-white/10" />
          <Link
            to="/dashboard"
            className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/85 transition hover:bg-white/10 lg:flex"
          >
            {logoUrl ? (
              <ThemedSvgLogo
                url={logoUrl}
                label={siteName}
                className="h-6 w-6 rounded-full object-cover text-primary"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[11px] font-semibold">
                {siteName.slice(0, 1)}
              </span>
            )}
            <span className="max-w-[11rem] truncate text-[11px] font-semibold uppercase tracking-[0.2em]">
              {siteName}
            </span>
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/50">Painel interno</p>
            <p className="truncate text-sm font-semibold text-white">
              {activeMenuItem?.label || "Dashboard"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            asChild
            variant="ghost"
            className="hidden h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/80 hover:bg-white/10 hover:text-white md:inline-flex"
          >
            <Link to="/" className="inline-flex items-center gap-1.5">
              Ver site
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 rounded-full border border-white/10 bg-white/5 px-2 text-white hover:bg-white/10"
              >
                <Avatar className="h-8 w-8 border border-white/20">
                  {currentUser?.avatarUrl ? <AvatarImage src={currentUser.avatarUrl} alt={userName} /> : null}
                  <AvatarFallback className="bg-white/10 text-xs text-white">{userInitials}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[10rem] truncate text-sm font-medium text-white sm:inline">
                  {userName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 border-white/15 bg-sidebar/95 text-white shadow-xl backdrop-blur-sm"
            >
              <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white">
                <Link to="/dashboard/usuarios?edit=me" className="flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4" />
                  Meu perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white">
                <Link to="/dashboard/configuracoes" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configuracoes
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="focus:bg-white/10 focus:text-white"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? "Saindo..." : "Sair"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
