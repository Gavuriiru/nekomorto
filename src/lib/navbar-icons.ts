import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CircleHelp,
  FolderKanban,
  HandHeart,
  Home,
  Info,
  LayoutDashboard,
  Link2,
  Newspaper,
  UserPlus,
  Users,
} from "lucide-react";

export const navbarIconOptions: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Início", icon: Home },
  { id: "folder-kanban", label: "Projetos", icon: FolderKanban },
  { id: "users", label: "Equipe", icon: Users },
  { id: "user-plus", label: "Recrutamento", icon: UserPlus },
  { id: "info", label: "Sobre", icon: Info },
  { id: "hand-heart", label: "Doações", icon: HandHeart },
  { id: "circle-help", label: "FAQ", icon: CircleHelp },
  { id: "newspaper", label: "Postagens", icon: Newspaper },
  { id: "book-open", label: "Leitura", icon: BookOpen },
  { id: "layout-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "link", label: "Link", icon: Link2 },
];

const navbarIconMap: Record<string, LucideIcon> = navbarIconOptions.reduce(
  (accumulator, option) => {
    accumulator[option.id] = option.icon;
    return accumulator;
  },
  {} as Record<string, LucideIcon>,
);

export const getNavbarIcon = (value?: string | null): LucideIcon => {
  const key = String(value || "").trim().toLowerCase();
  return navbarIconMap[key] || Link2;
};
