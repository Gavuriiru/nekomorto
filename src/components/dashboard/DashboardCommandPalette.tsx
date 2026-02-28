import { useMemo } from "react";
import {
  Bell,
  FilePlus2,
  FolderPlus,
  LucideIcon,
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
} from "@/components/ui/command";

type DashboardCommandPaletteProps = {
  open: boolean;
  menuItems: DashboardMenuItem[];
  onOpenChange: (open: boolean) => void;
  onNavigate: (href: string) => void;
  onOpenNotifications: () => void;
};

type QuickAction = {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  available: boolean;
  onSelect?: () => void;
};

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

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        id: "new-post",
        label: "Novo post",
        href: "/dashboard/posts?edit=new",
        icon: FilePlus2,
        available: Boolean(menuByHref.get("/dashboard/posts")?.enabled),
      },
      {
        id: "new-project",
        label: "Novo projeto",
        href: "/dashboard/projetos?edit=new",
        icon: FolderPlus,
        available: Boolean(menuByHref.get("/dashboard/projetos")?.enabled),
      },
      {
        id: "new-user",
        label: "Novo usuário",
        href: "/dashboard/usuarios?create=1",
        icon: UserPlus,
        available: Boolean(menuByHref.get("/dashboard/usuarios")?.enabled),
      },
      {
        id: "edit-me",
        label: "Editar meu perfil",
        href: "/dashboard/usuarios?edit=me",
        icon: UserCog,
        available: true,
      },
      {
        id: "open-notifications",
        label: "Abrir notificações",
        icon: Bell,
        available: true,
        onSelect: onOpenNotifications,
      },
    ],
    [menuByHref, onOpenNotifications],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar navegação e ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        <CommandGroup heading="Navegação">
          {menuItems
            .filter((item) => item.enabled)
            .map((item) => {
              const ItemIcon = item.icon;
              return (
                <CommandItem
                  key={`nav-${item.href}`}
                  value={`${item.label} ${item.href}`}
                  onSelect={() => {
                    onOpenChange(false);
                    onNavigate(item.href);
                  }}
                >
                  <ItemIcon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
        </CommandGroup>
        <CommandGroup heading="Ações rápidas">
          {quickActions
            .filter((item) => item.available)
            .map((item) => {
              const ItemIcon = item.icon;
              return (
                <CommandItem
                  key={`quick-${item.id}`}
                  value={item.label}
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
                </CommandItem>
              );
            })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default DashboardCommandPalette;

