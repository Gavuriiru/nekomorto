import {
  ChartSpline,
  ScrollText,
  FileText,
  FolderCog,
  LayoutGrid,
  MessageSquare,
  Send,
  Settings,
  ShieldAlert,
  Shield,
  HardDriveUpload,
  UserRound,
} from "lucide-react";
import { uiCopy } from "@/lib/ui-copy";

export type DashboardMenuSectionId = "home" | "content" | "team" | "system";
export type DashboardMenuActiveMatch = "exact" | "prefix";

export type DashboardMenuItem = {
  label: string;
  href: string;
  icon: typeof LayoutGrid;
  enabled: boolean;
  section: DashboardMenuSectionId;
  activeMatch?: DashboardMenuActiveMatch;
};

export type DashboardMenuSection = {
  id: DashboardMenuSectionId;
  label: string;
  items: DashboardMenuItem[];
};

export const dashboardMenuSections: DashboardMenuSection[] = [
  {
    id: "home",
    label: "Início",
    items: [
      {
        label: "Início",
        href: "/dashboard",
        icon: LayoutGrid,
        enabled: true,
        section: "home",
        activeMatch: "exact",
      },
    ],
  },
  {
    id: "content",
    label: "Conteúdo",
    items: [
      {
        label: "Postagens",
        href: "/dashboard/posts",
        icon: FileText,
        enabled: true,
        section: "content",
        activeMatch: "prefix",
      },
      {
        label: "Projetos",
        href: "/dashboard/projetos",
        icon: FolderCog,
        enabled: true,
        section: "content",
        activeMatch: "prefix",
      },
      {
        label: "Comentários",
        href: "/dashboard/comentarios",
        icon: MessageSquare,
        enabled: true,
        section: "content",
        activeMatch: "prefix",
      },
      {
        label: "Páginas",
        href: "/dashboard/paginas",
        icon: Shield,
        enabled: true,
        section: "content",
        activeMatch: "prefix",
      },
    ],
  },
  {
    id: "team",
    label: "Equipe",
    items: [
      {
        label: "Usuários",
        href: "/dashboard/usuarios",
        icon: UserRound,
        enabled: true,
        section: "team",
        activeMatch: "prefix",
      },
    ],
  },
  {
    id: "system",
    label: "Sistema",
    items: [
      {
        label: uiCopy.navigation.analytics,
        href: "/dashboard/analytics",
        icon: ChartSpline,
        enabled: true,
        section: "system",
        activeMatch: "prefix",
      },
      {
        label: "Integrações",
        href: "/dashboard/webhooks",
        icon: Send,
        enabled: true,
        section: "system",
        activeMatch: "prefix",
      },
      {
        label: "Armazenamento",
        href: "/dashboard/uploads",
        icon: HardDriveUpload,
        enabled: true,
        section: "system",
        activeMatch: "prefix",
      },
      {
        label: uiCopy.navigation.auditLog,
        href: "/dashboard/audit-log",
        icon: ScrollText,
        enabled: true,
        section: "system",
        activeMatch: "prefix",
      },
      {
        label: "Segurança",
        href: "/dashboard/seguranca",
        icon: ShieldAlert,
        enabled: true,
        section: "system",
        activeMatch: "prefix",
      },
      {
        label: "Configurações",
        href: "/dashboard/configuracoes",
        icon: Settings,
        enabled: true,
        section: "system",
        activeMatch: "prefix",
      },
    ],
  },
];

export const dashboardMenuItems: DashboardMenuItem[] = dashboardMenuSections.flatMap(
  (section) => section.items,
);

const defaultSectionIdByHref = new Map(dashboardMenuItems.map((item) => [item.href, item.section]));

export const groupDashboardMenuItems = (items: DashboardMenuItem[]): DashboardMenuSection[] => {
  const sectionsById = new Map<DashboardMenuSectionId, DashboardMenuSection>(
    dashboardMenuSections.map((section) => [section.id, { ...section, items: [] }]),
  );

  items.forEach((item) => {
    const sectionId = item.section || defaultSectionIdByHref.get(item.href) || "system";
    const targetSection = sectionsById.get(sectionId);
    if (!targetSection) {
      return;
    }
    targetSection.items.push(item);
  });

  return dashboardMenuSections
    .map((section) => sectionsById.get(section.id))
    .filter((section): section is DashboardMenuSection => Boolean(section?.items.length));
};

export const isDashboardMenuItemActive = (item: DashboardMenuItem, pathname: string) => {
  const matchMode = item.activeMatch || (item.href === "/dashboard" ? "exact" : "prefix");
  if (matchMode === "exact") {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
};
