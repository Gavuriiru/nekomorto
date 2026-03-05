import type { DashboardMenuItem } from "@/components/dashboard-menu";
import ThemeModeSwitcher from "@/components/ThemeModeSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNavbarIcon } from "@/lib/navbar-icons";
import { uiCopy } from "@/lib/ui-copy";
import type { PublicBootstrapCurrentUser } from "@/lib/public-bootstrap-global";
import { LogOut, Menu } from "lucide-react";
import { Link } from "react-router-dom";

export type HeaderActionMenuNavbarLink = {
  label: string;
  href: string;
  icon: string;
};

export type HeaderActionMenusProps = {
  navbarLinks: HeaderActionMenuNavbarLink[];
  isInternalHref: (href: string) => boolean;
  currentUser: PublicBootstrapCurrentUser | null;
  headerAvatarUrl: string;
  dashboardMenuForUser: DashboardMenuItem[];
  headerMenuContentClass: string;
  headerMenuItemClass: string;
  isLoggingOut: boolean;
  onLogout: () => void | Promise<void>;
};

const HeaderActionMenus = ({
  navbarLinks,
  isInternalHref,
  currentUser,
  headerAvatarUrl,
  dashboardMenuForUser,
  headerMenuContentClass,
  headerMenuItemClass,
  isLoggingOut,
  onLogout,
}: HeaderActionMenusProps) => (
  <>
    <ThemeModeSwitcher />
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-10 w-10 rounded-full border border-border/60 bg-card/50 text-foreground/85 hover:bg-accent hover:text-accent-foreground"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={`w-48 ${headerMenuContentClass}`}>
        {navbarLinks.map((item) => {
          const ItemIcon = getNavbarIcon(item.icon);
          return (
            <DropdownMenuItem
              key={`${item.label}-${item.href}`}
              asChild
              className={headerMenuItemClass}
            >
              {isInternalHref(item.href) ? (
                <Link to={item.href} className="flex items-center gap-2">
                  <ItemIcon className="h-4 w-4" />
                  {item.label}
                </Link>
              ) : (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ItemIcon className="h-4 w-4" />
                  {item.label}
                </a>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>

    {currentUser ? (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-11 gap-2 rounded-full px-2">
            <Avatar className="h-8 w-8 border border-border/70 shadow-[0_10px_24px_-18px_hsl(var(--foreground)/0.65)]">
              {headerAvatarUrl ? (
                <AvatarImage src={headerAvatarUrl} alt={currentUser.name} />
              ) : null}
              <AvatarFallback className="bg-secondary text-xs text-foreground">
                {(currentUser.name || "").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium text-foreground lg:inline">
              {currentUser.name || ""}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={`w-56 ${headerMenuContentClass}`}>
          {dashboardMenuForUser.map((item) => {
            const ItemIcon = item.icon;
            return (
              <DropdownMenuItem key={item.href} asChild className={headerMenuItemClass}>
                <Link to={item.href} className="flex items-center gap-2">
                  <ItemIcon className="h-4 w-4" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator className="bg-border/70" />
          <DropdownMenuItem
            className={headerMenuItemClass}
            onClick={() => {
              void onLogout();
            }}
            disabled={isLoggingOut}
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? uiCopy.actions.loggingOut : uiCopy.actions.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null}
  </>
);

export default HeaderActionMenus;
