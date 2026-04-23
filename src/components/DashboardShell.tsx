import {
  type DashboardMenuItem,
  dashboardMenuItems,
  groupDashboardMenuItems,
  isDashboardMenuItemActive,
} from "@/components/dashboard-menu";
import { dashboardMotionDurations } from "@/components/dashboard/dashboard-motion";
import { dashboardStrongFocusScopeClassName } from "@/components/dashboard/dashboard-page-tokens";
import DashboardHeader from "@/components/DashboardHeader";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebarState,
} from "@/components/ui/sidebar";
import { useDashboardSession } from "@/hooks/use-dashboard-session";
import {
  buildDashboardMenuFromGrants,
  getFirstAllowedDashboardRoute,
  resolveAccessRole,
  resolveGrants,
} from "@/lib/access-control";
import { buildAvatarRenderUrl } from "@/lib/avatar-render-url";
import { readWindowPublicBootstrapCurrentUser } from "@/lib/public-bootstrap-global";
import { uiCopy } from "@/lib/ui-copy";
import { Home } from "lucide-react";
import {
  createContext,
  type CSSProperties,
  memo,
  type MouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "react-router-dom";

type DashboardUser = {
  id?: string;
  name?: string;
  username?: string;
  avatarUrl?: string | null;
  revision?: string | null;
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

const DASHBOARD_SCROLLBAR_GUTTER_CLASS = "dashboard-scrollbar-gutter-stable";
const DashboardShellPresenceContext = createContext(false);

let lastResolvedDashboardUser: DashboardUser | null = readWindowPublicBootstrapCurrentUser();

type DashboardSidebarMenuSectionProps = {
  pathname: string;
  section: ReturnType<typeof groupDashboardMenuItems>[number];
  onMenuItemClick?: DashboardShellProps["onMenuItemClick"];
};

const DashboardSidebarMenuSection = memo(
  ({ pathname, section, onMenuItemClick }: DashboardSidebarMenuSectionProps) => (
    <SidebarGroup className="px-0 py-0">
      <SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden">
        {section.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1.5">
          {section.items.map((item) => {
            const ItemIcon = item.icon;

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isDashboardMenuItemActive(item, pathname)}
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
      </SidebarGroupContent>
    </SidebarGroup>
  ),
);

DashboardSidebarMenuSection.displayName = "DashboardSidebarMenuSection";

const DashboardSidebarProfileCard = ({
  userName,
  userHandle,
  userAvatarUrl,
  initials,
  isUserClickable,
  onUserCardClick,
}: {
  userName: string;
  userHandle: string;
  userAvatarUrl: string | undefined;
  initials: string;
  isUserClickable: boolean;
  onUserCardClick?: () => void;
}) => {
  const { open } = useSidebarState();
  const [forceTextTransition, setForceTextTransition] = useState(false);
  const [textVisible, setTextVisible] = useState(open);
  const [transitionDirection, setTransitionDirection] = useState<"opening" | "closing" | null>(null);
  const previousOpenRef = useRef(open);

  useEffect(() => {
    if (previousOpenRef.current === open) {
      return;
    }

    const nextDirection = open ? "opening" : "closing";
    previousOpenRef.current = open;

    if (typeof window === "undefined") {
      setForceTextTransition(false);
      setTextVisible(open);
      setTransitionDirection(null);
      return;
    }

    setForceTextTransition(true);
    setTransitionDirection(nextDirection);

    let frame = 0;
    let nestedFrame = 0;
    let showTimeout = 0;
    let clearTimeoutId = 0;

    if (open) {
      setTextVisible(false);
      frame = window.requestAnimationFrame(() => {
        nestedFrame = window.requestAnimationFrame(() => {
          showTimeout = window.setTimeout(() => {
            setTextVisible(true);
          }, 28);
        });
      });
      clearTimeoutId = window.setTimeout(() => {
        setForceTextTransition(false);
        setTransitionDirection(null);
      }, 260);
    } else {
      setTextVisible(true);
      frame = window.requestAnimationFrame(() => {
        nestedFrame = window.requestAnimationFrame(() => {
          showTimeout = window.setTimeout(() => {
            setTextVisible(false);
          }, 12);
        });
      });
      clearTimeoutId = window.setTimeout(() => {
        setForceTextTransition(false);
        setTransitionDirection(null);
      }, 260);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(nestedFrame);
      window.clearTimeout(showTimeout);
      window.clearTimeout(clearTimeoutId);
    };
  }, [open]);

  const isClosingTransition = forceTextTransition && transitionDirection === "closing";
  const textTransitionDurationClass = isClosingTransition ? "duration-[220ms]" : "duration-[220ms]";
  const textTransitionTimingClass = isClosingTransition
    ? "ease-[cubic-bezier(0.32,0,0.67,0)]"
    : "ease-[cubic-bezier(0.16,1,0.3,1)]";
  const cardTransitionTimingClass = isClosingTransition
    ? "ease-[cubic-bezier(0.32,0,0.67,0)]"
    : "ease-[cubic-bezier(0.16,1,0.3,1)]";
  const shouldUseExpandedProfileLayout = open && textVisible;
  const textVisibleStateClass = shouldUseExpandedProfileLayout
    ? "max-w-[10rem] opacity-100 translate-x-0"
    : "max-w-0 flex-none opacity-0 translate-x-1";
  const textInnerVisibleStateClass = shouldUseExpandedProfileLayout
    ? "opacity-100 translate-x-0"
    : "opacity-0 translate-x-1";

  const userCardDataState = shouldUseExpandedProfileLayout ? "expanded" : "collapsed";
  const userCardDataCollapsible = userCardDataState === "collapsed" ? "icon" : "";
  const collapsedCardStateClass =
    userCardDataCollapsible === "icon"
      ? "h-10 w-10 self-start justify-center gap-0 border-sidebar-border/60 bg-sidebar-accent/15 p-0"
      : "h-[4.25rem] w-full self-stretch px-3 py-2.5";
  const userCardClass =
    `relative flex items-center overflow-hidden rounded-xl border border-sidebar-border/80 bg-sidebar-accent/20 transition-[width,height,padding,gap,background-color,border-color] duration-200 ${cardTransitionTimingClass} hover:border-sidebar-ring/40 hover:bg-sidebar-accent/35 ${collapsedCardStateClass}`;
  const userCardTextWrapFlexClass = userCardDataCollapsible === "icon" ? "flex-none" : "flex-1";
  const userCardTextWrapClass = `${textVisibleStateClass} flex min-w-0 ${userCardTextWrapFlexClass} overflow-hidden transition-[max-width,opacity,transform] ${textTransitionDurationClass} ${textTransitionTimingClass}`;
  const userCardTextClass = `${textInnerVisibleStateClass} flex min-w-0 flex-col transition-[opacity,transform] ${textTransitionDurationClass} ${textTransitionTimingClass}`;
  const avatarCollapsedStateClass = userCardDataCollapsible === "icon" ? "h-7 w-7 min-h-7 min-w-7 scale-100" : "h-11 w-11 min-h-11 min-w-11";
  const avatarFallbackCollapsedStateClass = userCardDataCollapsible === "icon" ? "text-[9px]" : "text-xs";
  const userCardAvatarClass =
    `${avatarCollapsedStateClass} shrink-0 border border-sidebar-border shadow-xs transition-[width,height,transform] ${textTransitionDurationClass} ${cardTransitionTimingClass}`;
  const userCardCollapsedAvatarClass =
    `${avatarCollapsedStateClass} relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-sidebar-border shadow-xs transition-[width,height,transform] ${textTransitionDurationClass} ${cardTransitionTimingClass}`;
  const userCardAvatarFallbackClass =
    `bg-sidebar-primary/10 text-sidebar-foreground transition-[font-size] ${textTransitionDurationClass} ${cardTransitionTimingClass} ${avatarFallbackCollapsedStateClass}`;
  const shouldRenderCollapsedAvatarShell = userCardDataCollapsible === "icon";
  const collapsedAvatarFallbackText = initials;
  const collapsedAvatarImageClass = "block h-full w-full rounded-full object-cover object-center";
  const collapsedAvatarFallbackShellClass = `flex h-full w-full items-center justify-center rounded-full ${userCardAvatarFallbackClass}`;
  const userCardTextSpanClass = "truncate text-sm font-semibold text-sidebar-foreground";
  const userCardSubTextSpanClass = "truncate text-xs text-sidebar-foreground/70";

  return (
    <div
      data-state={userCardDataState}
      data-collapsible={userCardDataCollapsible}
      className={`${userCardClass} ${isUserClickable ? "cursor-pointer" : "cursor-default"}`}
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
      {shouldRenderCollapsedAvatarShell ? (
        <div className={userCardCollapsedAvatarClass}>
          {userAvatarUrl ? (
            <img src={userAvatarUrl} alt={userName} className={collapsedAvatarImageClass} />
          ) : (
            <span className={collapsedAvatarFallbackShellClass}>{collapsedAvatarFallbackText}</span>
          )}
        </div>
      ) : (
        <Avatar className={userCardAvatarClass}>
          {userAvatarUrl ? <AvatarImage src={userAvatarUrl} alt={userName} /> : null}
          <AvatarFallback className={userCardAvatarFallbackClass}>{initials}</AvatarFallback>
        </Avatar>
      )}
      <div className={userCardTextWrapClass}>
        <div className={userCardTextClass}>
          <span className={userCardTextSpanClass}>{userName}</span>
          <span className={userCardSubTextSpanClass}>{userHandle}</span>
        </div>
      </div>
    </div>
  );
};

const DashboardShellFrame = ({
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
  const dashboardSession = useDashboardSession();
  const effectiveUser = useMemo<DashboardUser | null>(() => {
    if (currentUser) {
      return currentUser;
    }
    if (dashboardSession.currentUser) {
      return dashboardSession.currentUser;
    }
    if (isLoadingUser) {
      return lastResolvedDashboardUser;
    }
    return null;
  }, [currentUser, dashboardSession.currentUser, isLoadingUser]);

  useEffect(() => {
    if (currentUser) {
      lastResolvedDashboardUser = currentUser;
      return;
    }
    if (!isLoadingUser) {
      lastResolvedDashboardUser = null;
    }
  }, [currentUser, isLoadingUser]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.classList.add(DASHBOARD_SCROLLBAR_GUTTER_CLASS);
    document.body.classList.add(DASHBOARD_SCROLLBAR_GUTTER_CLASS);

    return () => {
      document.documentElement.classList.remove(DASHBOARD_SCROLLBAR_GUTTER_CLASS);
      document.body.classList.remove(DASHBOARD_SCROLLBAR_GUTTER_CLASS);
    };
  }, []);

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
  const resolvedMenuSections = useMemo(
    () => groupDashboardMenuItems(resolvedMenuItems),
    [resolvedMenuItems],
  );
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
  const userAvatarUrl = useMemo(
    () => buildAvatarRenderUrl(effectiveUser?.avatarUrl, 128, effectiveUser?.revision),
    [effectiveUser?.avatarUrl, effectiveUser?.revision],
  );
  const isUserClickable = Boolean(onUserCardClick);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SidebarProvider defaultOpen>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader
            id="dashboard-navigation"
            tabIndex={-1}
            className="a11y-focus-target gap-3 px-2 pb-2 pt-3 transition-all duration-200 ease-linear group-data-[collapsible=icon]:items-start"
          >
            <DashboardSidebarProfileCard
              userName={userName}
              userHandle={userHandle}
              userAvatarUrl={userAvatarUrl || undefined}
              initials={initials}
              isUserClickable={isUserClickable}
              onUserCardClick={onUserCardClick}
            />
          </SidebarHeader>

          <SidebarContent className="px-2 pb-2">
            <div className="space-y-4">
              {resolvedMenuSections.map((section) => (
                <DashboardSidebarMenuSection
                  key={section.id}
                  pathname={location.pathname}
                  section={section}
                  onMenuItemClick={onMenuItemClick}
                />
              ))}
            </div>
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
          data-dashboard-motion="true"
          className={`a11y-focus-target ${dashboardStrongFocusScopeClassName} min-w-0 overflow-x-hidden flex min-h-screen flex-col bg-gradient-surface text-foreground md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:rounded-none`}
          style={
            {
              "--dashboard-motion-enter-duration": `${dashboardMotionDurations.enterMs}ms`,
              "--dashboard-motion-reveal-duration": `${dashboardMotionDurations.revealMs}ms`,
            } as CSSProperties
          }
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

const DashboardShell = (props: DashboardShellProps) => {
  const hasPersistentShell = useContext(DashboardShellPresenceContext);
  if (hasPersistentShell) {
    return <>{props.children}</>;
  }
  return (
    <DashboardShellPresenceContext.Provider value>
      <DashboardShellFrame {...props} />
    </DashboardShellPresenceContext.Provider>
  );
};

export default DashboardShell;
