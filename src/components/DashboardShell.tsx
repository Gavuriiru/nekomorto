import type { MouseEvent, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { dashboardMenuItems, type DashboardMenuItem } from "@/components/dashboard-menu";

type DashboardUser = {
  name?: string;
  username?: string;
  avatarUrl?: string | null;
};

type DashboardShellProps = {
  children: ReactNode;
  currentUser?: DashboardUser | null;
  isLoadingUser?: boolean;
  menuItems?: DashboardMenuItem[];
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
  menuItems = dashboardMenuItems,
  onUserCardClick,
  userLabel,
  userSubLabel,
  onMenuItemClick,
}: DashboardShellProps) => {
  const location = useLocation();
  const userName =
    userLabel ?? (isLoadingUser ? "Carregando usuário..." : currentUser?.name ?? "Usuário");
  const userHandle =
    userSubLabel ?? (currentUser?.username ? `@${currentUser.username}` : "Dashboard");
  const initials = (currentUser?.name ?? "??").slice(0, 2).toUpperCase();
  const isUserClickable = Boolean(onUserCardClick);
  const userCardBaseClass =
    "flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3 transition hover:border-primary/40 hover:bg-sidebar-accent/50 group-data-[collapsible=icon]:hidden";
  const userCardCompactClass =
    "hidden items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-2 transition hover:border-primary/40 hover:bg-sidebar-accent/50 group-data-[collapsible=icon]:flex";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SidebarProvider defaultOpen>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader className="gap-4 transition-all duration-200 ease-linear group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:items-center">
            <div
              className={`${userCardBaseClass} ${isUserClickable ? "cursor-pointer" : "cursor-default"}`}
              role={isUserClickable ? "button" : undefined}
              tabIndex={isUserClickable ? 0 : undefined}
              onClick={isUserClickable ? onUserCardClick : undefined}
              onKeyDown={(event) => {
                if (!isUserClickable) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onUserCardClick?.();
                }
              }}
            >
              <Avatar className="h-11 w-11 border border-sidebar-border">
                {currentUser?.avatarUrl ? (
                  <AvatarImage src={currentUser.avatarUrl} alt={userName} />
                ) : null}
                <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-foreground">
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
                if (!isUserClickable) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onUserCardClick?.();
                }
              }}
            >
              <Avatar className="h-8 w-8 border border-sidebar-border shadow-sm">
                {currentUser?.avatarUrl ? (
                  <AvatarImage src={currentUser.avatarUrl} alt={userName} />
                ) : null}
                <AvatarFallback className="bg-sidebar-accent text-[10px] text-sidebar-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </SidebarHeader>
          <SidebarSeparator className="my-2" />
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.href;
                const ItemIcon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} disabled={!item.enabled}>
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
        </Sidebar>

        <SidebarInset className="flex min-h-screen flex-col bg-gradient-to-b from-background via-[hsl(var(--primary)/0.12)] to-background text-foreground">
          <Header variant="fixed" leading={<SidebarTrigger className="text-white/80 hover:text-white" />} />
          <div className="flex-1">{children}</div>
          <Footer />
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default DashboardShell;
