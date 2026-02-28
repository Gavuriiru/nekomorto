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

export type DashboardMenuItem = {
  label: string;
  href: string;
  icon: typeof LayoutGrid;
  enabled: boolean;
};

export const dashboardMenuItems: DashboardMenuItem[] = [
  { label: "Início", href: "/dashboard", icon: LayoutGrid, enabled: true },
  { label: "Analytics", href: "/dashboard/analytics", icon: ChartSpline, enabled: true },
  { label: "Postagens", href: "/dashboard/posts", icon: FileText, enabled: true },
  { label: "Projetos", href: "/dashboard/projetos", icon: FolderCog, enabled: true },
  { label: "Comentários", href: "/dashboard/comentarios", icon: MessageSquare, enabled: true },
  { label: "Audit Log", href: "/dashboard/audit-log", icon: ScrollText, enabled: true },
  { label: "Usuários", href: "/dashboard/usuarios", icon: UserRound, enabled: true },
  { label: "Páginas", href: "/dashboard/paginas", icon: Shield, enabled: true },
  { label: "Uploads", href: "/dashboard/uploads", icon: HardDriveUpload, enabled: true },
  { label: "Webhooks", href: "/dashboard/webhooks", icon: Send, enabled: true },
  { label: "Segurança", href: "/dashboard/seguranca", icon: ShieldAlert, enabled: true },
  { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings, enabled: true },
];
