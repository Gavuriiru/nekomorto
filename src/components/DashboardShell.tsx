import { useMemo, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, LayoutDashboard } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import Footer from "@/components/Footer";
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { dashboardMenuItems, type DashboardMenuItem } from "@/components/dashboard-menu";
import { buildDashboardMenuFromGrants, resolveGrants } from "@/lib/access-control";

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
  onMenuItemClick?: (
    item: DashboardMenuItem,
    event: MouseEvent<HTMLAnchorElement>,
  ) => void;
};

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
  const resolvedMenuItems = useMemo(() => {
    if (Array.isArray(menuItems)) {
      return menuItems.filter((item) => item.enabled);
    }
    const grants = resolveGrants(currentUser || null);
    return buildDashboardMenuFromGrants(dashboardMenuItems, grants);
  }, [currentUser, menuItems]);
  const userName =
    userLabel ?? (isLoadingUser ? "Carregando usuario..." : currentUser?.name ?? "Usuario");
  const userHandle =
    userSubLabel ?? (currentUser?.username ? `@${currentUser.username}` : "Dashboard");
  const initialsRaw = (currentUser?.name ?? currentUser?.username ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join("")
    .toUpperCase();
  const initials = initialsRaw || "??";
  const isUserClickable = Boolean(onUserCardClick);
  const userCardBaseClass =
    "flex items-center gap-3 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/20 p-3 transition hover:border-sidebar-ring/40 hover:bg-sidebar-accent/35 group-data-[collapsible=icon]:hidden";
  const userCardCompactClass =
    "hidden items-center justify-center rounded-xl border border-sidebar-border/80 bg-sidebar-accent/20 p-2 transition hover:border-sidebar-ring/40 hover:bg-sidebar-accent/35 group-data-[collapsible=icon]:flex";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SidebarProvider defaultOpen>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader className="gap-3 px-2 pb-2 pt-3 transition-all duration-200 ease-linear group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:items-center">
            <Link
              to="/dashboard"
              className="group flex items-center gap-3 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/20 p-3 transition hover:border-sidebar-ring/40 hover:bg-sidebar-accent/35"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-border/70 bg-sidebar-primary/15 text-sidebar-primary">
                <LayoutDashboard className="h-4 w-4" />
              </span>
              <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold text-sidebar-foreground">Dashboard</span>
                <span className="text-xs text-sidebar-foreground/65">Painel de gestao</span>
              </div>
            </Link>

            <div
              className={`${userCardBaseClass} ${isUserClickable ? "cursor-pointer" : "cursor-default"}`}
              role={isUserClickable ? "button" : undefined}
              tabIndex={isUserClickable ? 0 : undefined}
              onClick={isUserClickable ? onUserCardClick : undefined}
              onKeyDown={(event) => {
                if (!isUserClickable) {
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onUserCardClick?.();
                }
              }}
            >
              <Avatar className="h-11 w-11 border border-sidebar-border">
                {currentUser?.avatarUrl ? <AvatarImage src={currentUser.avatarUrl} alt={userName} /> : null}
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
              role={isUserClickable ? "button" : undefined}
              tabIndex={isUserClickable ? 0 : undefined}
              onClick={isUserClickable ? onUserCardClick : undefined}
              onKeyDown={(event) => {
                if (!isUserClickable) {
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onUserCardClick?.();
                }
              }}
            >
              <Avatar className="h-8 w-8 border border-sidebar-border shadow-xs">
                {currentUser?.avatarUrl ? <AvatarImage src={currentUser.avatarUrl} alt={userName} /> : null}
                <AvatarFallback className="bg-sidebar-primary/10 text-[10px] text-sidebar-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </SidebarHeader>

          <SidebarSeparator className="my-2" />

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
                          onClick={onMenuItemClick ? (event) => onMenuItemClick(item, event) : undefined}
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

        <SidebarInset className="min-w-0 overflow-x-hidden flex min-h-screen flex-col bg-linear-to-b from-background via-[hsl(var(--primary)/0.12)] to-background text-foreground md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:rounded-none">
          <DashboardHeader currentUser={currentUser} menuItems={resolvedMenuItems} />
          <div className="min-w-0 w-full flex-1">{children}</div>
          <Footer />
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default DashboardShell;
