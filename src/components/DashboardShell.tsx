import { useEffect, useMemo, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import Footer from "@/components/Footer";
import SkipLinks from "@/components/SkipLinks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { dashboardMenuItems, type DashboardMenuItem } from "@/components/dashboard-menu";
import {
  buildDashboardMenuFromGrants,
  getFirstAllowedDashboardRoute,
  resolveAccessRole,
  resolveGrants,
} from "@/lib/access-control";
import { uiCopy } from "@/lib/ui-copy";

type DashboardUser = {
  id?: string;
  name?: string;
  username?: string;
  avatarUrl?: string | null;
  accessRole?: string;
  permissions?: string[];
  ownerIds?: string[];
  primaryOwnerId?: string | null;
  grants?: Partial<Record<string, boolean>>;
};

type DashboardShellProps = {
  children: ReactNode;
  currentUser?: DashboardUser | null;
  isLoadingUser?: boolean;
  menuItems?: DashboardMenuItem[] | null;
  onUserCardClick?: () => void;
  userLabel?: string;
  userSubLabel?: string;
  onMenuItemClick?: (item: DashboardMenuItem, event: MouseEvent<HTMLAnchorElement>) => void;
};

let lastResolvedDashboardUser: DashboardUser | null = null;

const DashboardShell = ({
  children,
  currentUser,
  isLoadingUser = false,
  menuItems = null,
  onUserCardClick,
  userLabel,
  userSubLabel,
  onMenuItemClick,
}: DashboardShellProps) => {
  const location = useLocation();
  const effectiveUser = useMemo<DashboardUser | null>(() => {
    if (currentUser) {
      return currentUser;
    }
    if (isLoadingUser) {
      return lastResolvedDashboardUser;
    }
    return null;
  }, [currentUser, isLoadingUser]);

  useEffect(() => {
    if (currentUser) {
      lastResolvedDashboardUser = currentUser;
      return;
    }
    if (!isLoadingUser) {
      lastResolvedDashboardUser = null;
    }
  }, [currentUser, isLoadingUser]);

  const resolvedMenuItems = useMemo(() => {
    const accessRole = resolveAccessRole(effectiveUser || null);
    const isOwner = accessRole === "owner_primary" || accessRole === "owner_secondary";
    if (Array.isArray(menuItems)) {
      return menuItems.filter(
        (item) => item.enabled && (item.href !== "/dashboard/seguranca" || isOwner),
      );
    }
    const grants = resolveGrants(effectiveUser || null);
    return buildDashboardMenuFromGrants(dashboardMenuItems, grants).filter(
      (item) => item.href !== "/dashboard/seguranca" || isOwner,
    );
  }, [effectiveUser, menuItems]);
  const dashboardHomeHref = useMemo(
    () =>
      getFirstAllowedDashboardRoute(resolveGrants(effectiveUser || null), {
        allowUsersForSelf: Boolean(effectiveUser),
      }),
    [effectiveUser],
  );
  const userName =
    userLabel ??
    effectiveUser?.name ??
    (isLoadingUser ? uiCopy.user.loading : uiCopy.user.singular);
  const userHandle =
    userSubLabel ??
    (effectiveUser?.username
      ? `@${effectiveUser.username}`
      : isLoadingUser
        ? uiCopy.user.waiting
        : uiCopy.dashboard.home);
  const initialsRaw = (effectiveUser?.name ?? effectiveUser?.username ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join("")
    .toUpperCase();
  const initials = initialsRaw || "??";
  const isUserClickable = Boolean(onUserCardClick);
  const userCardBaseClass =
    "relative flex items-center gap-3 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/20 p-3 transition hover:border-sidebar-ring/40 hover:bg-sidebar-accent/35 group-data-[collapsible=icon]:hidden";
  const userCardCompactClass =
    "relative hidden items-center justify-center rounded-xl border border-sidebar-border/80 bg-sidebar-accent/20 p-2 transition hover:border-sidebar-ring/40 hover:bg-sidebar-accent/35 group-data-[collapsible=icon]:flex";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SkipLinks
        links={[
          { href: "#dashboard-navigation", label: "Pular para a navegação" },
          { href: "#dashboard-main-content", label: "Pular para o conteúdo" },
        ]}
      />
      <SidebarProvider defaultOpen>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader
            id="dashboard-navigation"
            tabIndex={-1}
            className="a11y-focus-target gap-3 px-2 pb-2 pt-3 transition-all duration-200 ease-linear group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:items-center"
          >
            <div
              className={`${userCardBaseClass} ${isUserClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              {isUserClickable ? (
                <button
                  type="button"
                  className="absolute inset-0 z-10 rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  aria-label={`Abrir perfil de ${userName}`}
                  onClick={onUserCardClick}
                >
                  <span className="sr-only">{`Abrir perfil de ${userName}`}</span>
                </button>
              ) : null}
              <Avatar className="h-11 w-11 border border-sidebar-border">
                {effectiveUser?.avatarUrl ? (
                  <AvatarImage src={effectiveUser.avatarUrl} alt={userName} />
                ) : null}
                <AvatarFallback className="bg-sidebar-primary/10 text-xs text-sidebar-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold text-sidebar-foreground">{userName}</span>
                <span className="text-xs text-sidebar-foreground/70">{userHandle}</span>
              </div>
            </div>

            <div
              className={`${userCardCompactClass} ${isUserClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              {isUserClickable ? (
                <button
                  type="button"
                  className="absolute inset-0 z-10 rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  aria-label={`Abrir perfil de ${userName}`}
                  onClick={onUserCardClick}
                >
                  <span className="sr-only">{`Abrir perfil de ${userName}`}</span>
                </button>
              ) : null}
              <Avatar className="h-8 w-8 border border-sidebar-border shadow-xs">
                {effectiveUser?.avatarUrl ? (
                  <AvatarImage src={effectiveUser.avatarUrl} alt={userName} />
                ) : null}
                <AvatarFallback className="bg-sidebar-primary/10 text-[10px] text-sidebar-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 pb-2">
            <SidebarMenu className="gap-1.5">
              {resolvedMenuItems.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== "/dashboard" && location.pathname.startsWith(`${item.href}/`));
                const ItemIcon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      disabled={!item.enabled}
                      className="h-10 rounded-xl text-sidebar-foreground/80 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-[inset_0_0_0_1px_hsl(var(--sidebar-ring)/0.35)]"
                    >
                      {item.enabled ? (
                        <Link
                          to={item.href}
                          onClick={
                            onMenuItemClick ? (event) => onMenuItemClick(item, event) : undefined
                          }
                        >
                          <ItemIcon />
                          <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                        </Link>
                      ) : (
                        <button type="button" aria-disabled="true" disabled>
                          <ItemIcon />
                          <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                        </button>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="px-2 pb-3 pt-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Voltar ao site"
                  className="h-10 rounded-xl text-sidebar-foreground/80 hover:text-sidebar-foreground"
                >
                  <Link to="/">
                    <Home />
                    <span className="group-data-[collapsible=icon]:hidden">Voltar ao site</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset
          id="dashboard-main-content"
          tabIndex={-1}
          className="a11y-focus-target min-w-0 overflow-x-hidden flex min-h-screen flex-col bg-linear-to-b from-background via-[hsl(var(--primary)/0.12)] to-background text-foreground md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:rounded-none"
        >
          <DashboardHeader
            currentUser={effectiveUser}
            menuItems={resolvedMenuItems}
            dashboardHomeHref={dashboardHomeHref}
          />
          <div className="min-w-0 w-full flex-1">{children}</div>
          <Footer />
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default DashboardShell;
