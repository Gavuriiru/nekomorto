import { useMemo } from "react";
import {
  Bell,
  FilePlus2,
  FileText,
  FolderPlus,
  LucideIcon,
  Settings,
  UserCog,
  UserPlus,
} from "lucide-react";
import type { DashboardMenuItem } from "@/components/dashboard-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

type DashboardCommandPaletteProps = {
  open: boolean;
  menuItems: DashboardMenuItem[];
  onOpenChange: (open: boolean) => void;
  onNavigate: (href: string) => void;
  onOpenNotifications: () => void;
};

type PaletteCommand = {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  available: boolean;
  keywords?: string[];
  shortcutHint?: string;
  onSelect?: () => void;
};

const buildCommandValue = ({ label, href, keywords = [], shortcutHint }: PaletteCommand) =>
  [label, href || "", shortcutHint || "", ...keywords].join(" ").trim().toLowerCase();

const DashboardCommandPalette = ({
  open,
  menuItems,
  onOpenChange,
  onNavigate,
  onOpenNotifications,
}: DashboardCommandPaletteProps) => {
  const menuByHref = useMemo(
    () => new Map(menuItems.map((item) => [item.href, item])),
    [menuItems],
  );

  const quickActions = useMemo<PaletteCommand[]>(() => {
    const usersEnabled = Boolean(menuByHref.get("/dashboard/usuarios")?.enabled);

    return [
      {
        id: "new-post",
        label: "Novo post",
        href: "/dashboard/posts?edit=new",
        icon: FilePlus2,
        available: Boolean(menuByHref.get("/dashboard/posts")?.enabled),
        keywords: ["novo", "post", "posts", "criar", "editor"],
        shortcutHint: "NP",
      },
      {
        id: "new-project",
        label: "Novo projeto",
        href: "/dashboard/projetos?edit=new",
        icon: FolderPlus,
        available: Boolean(menuByHref.get("/dashboard/projetos")?.enabled),
        keywords: ["novo", "projeto", "projetos", "criar", "editor"],
        shortcutHint: "NPR",
      },
      {
        id: "new-user",
        label: "Novo usu\u00e1rio",
        href: "/dashboard/usuarios?create=1",
        icon: UserPlus,
        available: usersEnabled,
        keywords: ["novo", "usuario", "usuarios", "criar", "conta"],
        shortcutHint: "NU",
      },
      {
        id: "edit-me",
        label: "Editar meu perfil",
        href: "/dashboard/usuarios?edit=me",
        icon: UserCog,
        available: usersEnabled,
        keywords: ["perfil", "minha conta", "usuario", "editar", "me"],
        shortcutHint: "ME",
      },
      {
        id: "open-notifications",
        label: "Abrir notifica\u00e7\u00f5es",
        icon: Bell,
        available: true,
        keywords: ["notificacoes", "alertas", "fila", "inbox"],
        shortcutHint: "NT",
        onSelect: onOpenNotifications,
      },
    ];
  }, [menuByHref, onOpenNotifications]);

  const settingsTabActions = useMemo<PaletteCommand[]>(() => {
    const settingsEnabled = Boolean(menuByHref.get("/dashboard/configuracoes")?.enabled);
    const settingsIcon = menuByHref.get("/dashboard/configuracoes")?.icon ?? Settings;

    return [
      {
        id: "settings-general",
        label: "Geral",
        href: "/dashboard/configuracoes",
        icon: settingsIcon,
        available: settingsEnabled,
        keywords: ["config", "cfg", "configuracoes", "tab", "settings"],
        shortcutHint: "SG",
      },
      {
        id: "settings-downloads",
        label: "Downloads",
        href: "/dashboard/configuracoes?tab=downloads",
        icon: settingsIcon,
        available: settingsEnabled,
        keywords: ["config", "cfg", "configuracoes", "tab", "downloads"],
        shortcutHint: "SD",
      },
      {
        id: "settings-team",
        label: "Equipe",
        href: "/dashboard/configuracoes?tab=equipe",
        icon: settingsIcon,
        available: settingsEnabled,
        keywords: ["config", "cfg", "configuracoes", "tab", "equipe", "staff"],
        shortcutHint: "SE",
      },
      {
        id: "settings-footer",
        label: "Footer",
        href: "/dashboard/configuracoes?tab=footer",
        icon: settingsIcon,
        available: settingsEnabled,
        keywords: ["config", "cfg", "configuracoes", "tab", "footer", "rodape"],
        shortcutHint: "SF",
      },
      {
        id: "settings-navbar",
        label: "Navbar",
        href: "/dashboard/configuracoes?tab=navbar",
        icon: settingsIcon,
        available: settingsEnabled,
        keywords: ["config", "cfg", "configuracoes", "tab", "navbar", "menu"],
        shortcutHint: "SN",
      },
      {
        id: "settings-user-socials",
        label: "Redes sociais",
        href: "/dashboard/configuracoes?tab=redes-usuarios",
        icon: settingsIcon,
        available: settingsEnabled,
        keywords: ["config", "cfg", "configuracoes", "tab", "redes", "sociais", "social"],
        shortcutHint: "SR",
      },
      {
        id: "settings-translations",
        label: "Tradu\u00e7\u00f5es",
        href: "/dashboard/configuracoes?tab=traducoes",
        icon: settingsIcon,
        available: settingsEnabled,
        keywords: ["config", "cfg", "configuracoes", "tab", "traducoes", "idiomas"],
        shortcutHint: "ST",
      },
    ];
  }, [menuByHref]);

  const pageTabActions = useMemo<PaletteCommand[]>(() => {
    const pagesEnabled = Boolean(menuByHref.get("/dashboard/paginas")?.enabled);
    const pagesIcon = menuByHref.get("/dashboard/paginas")?.icon ?? FileText;

    return [
      {
        id: "pages-donations",
        label: "Doa\u00e7\u00f5es",
        href: "/dashboard/paginas",
        icon: pagesIcon,
        available: pagesEnabled,
        keywords: ["paginas", "pages", "tab", "doacoes", "donations"],
        shortcutHint: "PD",
      },
      {
        id: "pages-team",
        label: "Equipe",
        href: "/dashboard/paginas?tab=team",
        icon: pagesIcon,
        available: pagesEnabled,
        keywords: ["paginas", "pages", "tab", "equipe", "team"],
        shortcutHint: "PE",
      },
      {
        id: "pages-faq",
        label: "FAQ",
        href: "/dashboard/paginas?tab=faq",
        icon: pagesIcon,
        available: pagesEnabled,
        keywords: ["paginas", "pages", "tab", "faq"],
        shortcutHint: "PF",
      },
      {
        id: "pages-recruitment",
        label: "Recrutamento",
        href: "/dashboard/paginas?tab=recruitment",
        icon: pagesIcon,
        available: pagesEnabled,
        keywords: ["paginas", "pages", "tab", "recrutamento", "recruitment"],
        shortcutHint: "PR",
      },
      {
        id: "pages-about",
        label: "Sobre",
        href: "/dashboard/paginas?tab=about",
        icon: pagesIcon,
        available: pagesEnabled,
        keywords: ["paginas", "pages", "tab", "sobre", "about"],
        shortcutHint: "PS",
      },
      {
        id: "pages-preview",
        label: "Preview",
        href: "/dashboard/paginas?tab=preview",
        icon: pagesIcon,
        available: pagesEnabled,
        keywords: ["paginas", "pages", "tab", "preview", "og"],
        shortcutHint: "PV",
      },
    ];
  }, [menuByHref]);

  const navigationItems = useMemo<PaletteCommand[]>(
    () =>
      menuItems.map((item) => ({
        id: `nav-${item.href}`,
        label: item.label,
        href: item.href,
        icon: item.icon,
        available: Boolean(item.enabled),
        keywords: ["nav", "rota", "dashboard"],
      })),
    [menuItems],
  );

  const renderGroup = (heading: string, items: PaletteCommand[]) => {
    const visibleItems = items.filter((item) => item.available);
    if (!visibleItems.length) {
      return null;
    }

    return (
      <CommandGroup heading={heading}>
        {visibleItems.map((item) => {
          const ItemIcon = item.icon;

          return (
            <CommandItem
              key={item.id}
              value={buildCommandValue(item)}
              onSelect={() => {
                onOpenChange(false);
                item.onSelect?.();
                if (item.href) {
                  onNavigate(item.href);
                }
              }}
            >
              <ItemIcon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
              {item.shortcutHint ? <CommandShortcut>{item.shortcutHint}</CommandShortcut> : null}
            </CommandItem>
          );
        })}
      </CommandGroup>
    );
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar navega\u00e7\u00e3o, abas e a\u00e7\u00f5es..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {renderGroup("A\u00e7\u00f5es r\u00e1pidas", quickActions)}
        {renderGroup("Abas - Configura\u00e7\u00f5es", settingsTabActions)}
        {renderGroup("Abas - P\u00e1ginas", pageTabActions)}
        {renderGroup("Navega\u00e7\u00e3o", navigationItems)}
      </CommandList>
    </CommandDialog>
  );
};

export default DashboardCommandPalette;
