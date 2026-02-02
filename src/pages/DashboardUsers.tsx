import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  FileText,
  FolderCog,
  LayoutGrid,
  MessageSquare,
  Settings,
  Shield,
  UserRound,
  Globe,
  Instagram,
  X,
  Youtube,
  MessageCircle,
} from "lucide-react";
import { getApiBase } from "@/lib/api-base";

type UserRecord = {
  id: string;
  name: string;
  phrase: string;
  bio: string;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  socials?: Array<{ label: string; href: string }>;
  status: "active" | "retired";
  permissions: string[];
  roles?: string[];
  order: number;
};

const emptyForm = {
  id: "",
  name: "",
  phrase: "",
  bio: "",
  avatarUrl: "",
  coverImageUrl: "",
  socials: [] as Array<{ label: string; href: string }>,
  status: "active" as "active" | "retired",
  permissions: [] as string[],
  roles: [] as string[],
};

const permissionOptions = [
  { id: "posts", label: "Posts" },
  { id: "projetos", label: "Projetos" },
  { id: "comentarios", label: "Comentários" },
  { id: "usuarios", label: "Usuários" },
  { id: "paginas", label: "Páginas" },
  { id: "configuracoes", label: "Configurações" },
];

const roleOptions = [
  "Tradutor",
  "Revisor",
  "Typesetter",
  "Qualidade",
  "Desenvolvedor",
  "Cleaner",
  "Redrawer",
  "Encoder",
  "K-Timer",
  "Logo Maker",
  "K-Maker",
];

const socialIconMap: Record<string, typeof Globe> = {
  instagram: Instagram,
  twitter: X,
  x: X,
  youtube: Youtube,
  discord: MessageCircle,
  "message-circle": MessageCircle,
  globe: Globe,
  site: Globe,
};

const DashboardUsers = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const apiBase = getApiBase();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragGroup, setDragGroup] = useState<"active" | "retired" | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formState, setFormState] = useState(emptyForm);
  const [linkTypes, setLinkTypes] = useState<Array<{ id: string; label: string; icon: string }>>([]);
  const fallbackLinkTypes = useMemo(
    () => [
      { id: "instagram", label: "Instagram", icon: "instagram" },
      { id: "x", label: "X", icon: "x" },
      { id: "youtube", label: "YouTube", icon: "youtube" },
      { id: "discord", label: "Discord", icon: "message-circle" },
      { id: "site", label: "Site", icon: "globe" },
    ],
    [],
  );

  const menuItems = [
    { label: "Início", href: "/dashboard", icon: LayoutGrid, enabled: true },
    { label: "Postagens", href: "/dashboard/posts", icon: FileText, enabled: true },
    { label: "Projetos", href: "/dashboard/projetos", icon: FolderCog, enabled: true },
    { label: "Comentários", href: "/dashboard/comentarios", icon: MessageSquare, enabled: true },
    { label: "Usuários", href: "/dashboard/usuarios", icon: UserRound, enabled: true },
    { label: "Páginas", href: "/dashboard/paginas", icon: Shield, enabled: true },
    { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings, enabled: false },
  ];

  const currentUserRecord = currentUser
    ? users.find((user) => user.id === currentUser.id) || null
    : null;
  const canManageUsers = currentUser?.id ? ownerIds.includes(currentUser.id) : false;
  const canManageBadges =
    canManageUsers ||
    (currentUserRecord
      ? currentUserRecord.permissions.includes("usuarios") || currentUserRecord.permissions.includes("*")
      : false);

  const activeUsers = useMemo(
    () => users.filter((user) => user.status === "active").sort((a, b) => a.order - b.order),
    [users],
  );
  const retiredUsers = useMemo(
    () => users.filter((user) => user.status === "retired").sort((a, b) => a.order - b.order),
    [users],
  );
  const isOwnerRecord = editingUser ? ownerIds.includes(editingUser.id) : false;
  const rolesOnlyEdit =
    Boolean(editingUser) && canManageBadges && !canManageUsers && currentUser?.id !== editingUser.id;

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, meRes, linkTypesRes] = await Promise.all([
          fetch(`${apiBase}/api/users`, { credentials: "include" }),
          fetch(`${apiBase}/api/me`, { credentials: "include" }),
          fetch(`${apiBase}/api/link-types`),
        ]);

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users || []);
          setOwnerIds(Array.isArray(data.ownerIds) ? data.ownerIds : []);
        }

        if (meRes.ok) {
          const me = await meRes.json();
          setCurrentUser(me);
        }

        if (linkTypesRes.ok) {
          const data = await linkTypesRes.json();
          setLinkTypes(Array.isArray(data.items) ? data.items : []);
        }
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [apiBase]);

  useEffect(() => {
    if (searchParams.get("edit") !== "me") {
      return;
    }
    if (!currentUserRecord || isDialogOpen) {
      return;
    }
    openEditDialog(currentUserRecord);
    navigate("/dashboard/usuarios", { replace: true });
  }, [currentUserRecord, isDialogOpen, navigate, searchParams]);

  const openNewDialog = () => {
    setEditingUser(null);
    setFormState(emptyForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: UserRecord) => {
    setEditingUser(user);
    setFormState({
      id: user.id,
      name: user.name,
      phrase: user.phrase,
      bio: user.bio,
      avatarUrl: user.avatarUrl || "",
      coverImageUrl: user.coverImageUrl || "",
      socials: user.socials ? [...user.socials] : [],
      status: user.status,
      permissions: [...user.permissions],
      roles: user.roles ? [...user.roles] : [],
    });
    setIsDialogOpen(true);
  };

  const canOpenEdit = (user: UserRecord) =>
    Boolean(canManageBadges || canManageUsers || currentUser?.id === user.id);

  const handleUserCardClick = (user: UserRecord) => {
    if (!canOpenEdit(user)) {
      return;
    }
    openEditDialog(user);
  };

  const handleSave = async () => {
    const basePayload = {
      id: formState.id.trim(),
      name: formState.name.trim(),
      phrase: formState.phrase.trim(),
      bio: formState.bio.trim(),
      avatarUrl: formState.avatarUrl.trim() || null,
      coverImageUrl: formState.coverImageUrl.trim() || null,
      socials: formState.socials.filter((item) => item.label.trim() && item.href.trim()),
      status: formState.status,
      permissions: formState.permissions,
      roles: formState.roles,
    };
    const payload =
      editingUser && !canManageUsers && canManageBadges
        ? { roles: formState.roles }
        : basePayload;

    if (!editingUser && (!basePayload.id || !basePayload.name)) {
      return;
    }

    const method = editingUser ? "PUT" : "POST";
    const url = editingUser
      ? canManageUsers
        ? `${apiBase}/api/users/${editingUser.id}`
        : `${apiBase}/api/users/self`
      : `${apiBase}/api/users`;

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      if (editingUser) {
        setUsers((prev) => prev.map((user) => (user.id === editingUser.id ? data.user : user)));
      } else {
        setUsers((prev) => [...prev, data.user]);
      }
      setIsDialogOpen(false);
    }
  };

  const handleStatusToggle = async (user: UserRecord) => {
    if (ownerIds.includes(user.id)) {
      return;
    }
    const nextStatus = user.status === "active" ? "retired" : "active";
    const response = await fetch(`${apiBase}/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: nextStatus }),
    });

    if (response.ok) {
      const data = await response.json();
      setUsers((prev) => prev.map((item) => (item.id === user.id ? data.user : item)));
    }
  };

  const togglePermission = (permissionId: string) => {
    if (!canManageUsers) {
      return;
    }
    setFormState((prev) => {
      const hasPermission = prev.permissions.includes(permissionId);
      return {
        ...prev,
        permissions: hasPermission
          ? prev.permissions.filter((item) => item !== permissionId)
          : [...prev.permissions, permissionId],
      };
    });
  };

  const toggleRole = (role: string) => {
    if (!canManageBadges) {
      return;
    }
    setFormState((prev) => {
      const hasRole = prev.roles.includes(role);
      return {
        ...prev,
        roles: hasRole ? prev.roles.filter((item) => item !== role) : [...prev.roles, role],
      };
    });
  };

  const reorderUsers = (orderedActiveIds: string[], orderedRetiredIds: string[]) => {
    setUsers((prev) => {
      const activeMap = new Map(prev.filter((u) => u.status === "active").map((u) => [u.id, u]));
      const retiredMap = new Map(prev.filter((u) => u.status === "retired").map((u) => [u.id, u]));
      const reorderedActive = orderedActiveIds
        .map((id, index) => {
          const user = activeMap.get(id);
          return user ? { ...user, order: index } : null;
        })
        .filter(Boolean) as UserRecord[];
      const reorderedRetired = orderedRetiredIds
        .map((id, index) => {
          const user = retiredMap.get(id);
          return user ? { ...user, order: orderedActiveIds.length + index } : null;
        })
        .filter(Boolean) as UserRecord[];
      return [...reorderedActive, ...reorderedRetired];
    });
  };

  const handleDragOverActive = (event: React.DragEvent<HTMLDivElement>, overId: string) => {
    if (!canManageUsers || !dragId || dragGroup !== "active" || dragId === overId) {
      return;
    }
    event.preventDefault();
    const activeIds = activeUsers.map((user) => user.id);
    const retiredIds = retiredUsers.map((user) => user.id);
    const fromIndex = activeIds.indexOf(dragId);
    const toIndex = activeIds.indexOf(overId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const nextActiveIds = [...activeIds];
    nextActiveIds.splice(fromIndex, 1);
    nextActiveIds.splice(toIndex, 0, dragId);
    reorderUsers(nextActiveIds, retiredIds);
  };

  const handleDragOverRetired = (event: React.DragEvent<HTMLDivElement>, overId: string) => {
    if (!canManageUsers || !dragId || dragGroup !== "retired" || dragId === overId) {
      return;
    }
    event.preventDefault();
    const activeIds = activeUsers.map((user) => user.id);
    const retiredIds = retiredUsers.map((user) => user.id);
    const fromIndex = retiredIds.indexOf(dragId);
    const toIndex = retiredIds.indexOf(overId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const nextRetiredIds = [...retiredIds];
    nextRetiredIds.splice(fromIndex, 1);
    nextRetiredIds.splice(toIndex, 0, dragId);
    reorderUsers(activeIds, nextRetiredIds);
  };

  const handleDragEnd = async () => {
    if (!canManageUsers) {
      setDragId(null);
      setDragGroup(null);
      return;
    }
    const orderedIds = activeUsers.map((user) => user.id);
    const retiredIds = retiredUsers.map((user) => user.id);
    await fetch(`${apiBase}/api/users/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ orderedIds, retiredIds }),
    });
    setDragId(null);
    setDragGroup(null);
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="gap-4 group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:items-center">
          <div
            className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3 transition hover:border-primary/40 hover:bg-sidebar-accent/50 cursor-pointer group-data-[collapsible=icon]:hidden"
            role="button"
            tabIndex={0}
            onClick={() => currentUserRecord && handleUserCardClick(currentUserRecord)}
            onKeyDown={(event) => {
              if (!currentUserRecord) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleUserCardClick(currentUserRecord);
              }
            }}
          >
            <Avatar className="h-11 w-11 border border-sidebar-border">
              {currentUser?.avatarUrl ? (
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
              ) : null}
              <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-foreground">
                {currentUser ? currentUser.name.slice(0, 2).toUpperCase() : "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">
                {currentUser?.name ?? "Usuário"}
              </span>
              <span className="text-xs text-sidebar-foreground/70">
                {currentUser?.username ? `@${currentUser.username}` : "Dashboard"}
              </span>
            </div>
          </div>
          <div
            className="hidden items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-2 transition hover:border-primary/40 hover:bg-sidebar-accent/50 cursor-pointer group-data-[collapsible=icon]:flex"
            role="button"
            tabIndex={0}
            onClick={() => currentUserRecord && handleUserCardClick(currentUserRecord)}
            onKeyDown={(event) => {
              if (!currentUserRecord) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleUserCardClick(currentUserRecord);
              }
            }}
          >
            <Avatar className="h-8 w-8 border border-sidebar-border shadow-sm">
              {currentUser?.avatarUrl ? (
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
              ) : null}
              <AvatarFallback className="bg-sidebar-accent text-[10px] text-sidebar-foreground">
                {currentUser ? currentUser.name.slice(0, 2).toUpperCase() : "??"}
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
                      <Link to={item.href}>
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

      <SidebarInset className="bg-gradient-to-b from-background via-[hsl(var(--primary)/0.12)] to-background text-foreground">
        <Header variant="fixed" leading={<SidebarTrigger className="text-white/80 hover:text-white" />} />
        <main className="pt-24">
          <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Usuários
                </div>
                <h1 className="mt-4 text-3xl font-semibold lg:text-4xl">Gestão de usuários</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Reordene arrastando para refletir a ordem na página pública.
                </p>
              </div>
              {canManageUsers && (
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openNewDialog}>
                  Adicionar usuário
                </Button>
              )}
            </header>

            <div className="mt-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Usuários ativos</h2>
                <Badge className="bg-white/10 text-muted-foreground">
                  {activeUsers.length}
                </Badge>
              </div>

              {isLoading ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-sm text-muted-foreground">
                  Carregando usuários...
                </div>
              ) : activeUsers.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-sm text-muted-foreground">
                  Nenhum usuário ativo no momento.
                </div>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {activeUsers.map((user) => (
                    <div
                      key={user.id}
                      className="relative rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-primary/40 hover:bg-primary/5"
                      draggable={canManageUsers}
                      onDragStart={() => {
                        setDragId(user.id);
                        setDragGroup("active");
                      }}
                      onDragOver={(event) => handleDragOverActive(event, user.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleUserCardClick(user)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleUserCardClick(user);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4">
                          <Avatar className="h-14 w-14 border border-white/10">
                            {user.avatarUrl ? (
                              <AvatarImage src={user.avatarUrl} alt={user.name} />
                            ) : null}
                            <AvatarFallback className="bg-white/10 text-sm text-white">
                              {user.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{user.name}</h3>
                              {ownerIds.includes(user.id) && (
                                <Badge className="bg-primary/20 text-primary">Dono</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.phrase || "—"}</p>
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                              {user.bio || "Sem biografia cadastrada."}
                            </p>
                            {user.roles && user.roles.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {user.roles.map((role) => (
                                  <Badge key={role} variant="secondary" className="text-[10px] uppercase">
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {(canManageBadges || canManageUsers || currentUser?.id === user.id) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={(event) => event.stopPropagation()}>
                                <span className="sr-only">Ações</span>
                                <span className="text-xl leading-none">⋯</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canManageUsers && !ownerIds.includes(user.id) && (
                                <DropdownMenuItem onClick={() => handleStatusToggle(user)}>
                                  Aposentar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {retiredUsers.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Usuários aposentados</h2>
                  <Badge className="bg-white/10 text-muted-foreground">
                    {retiredUsers.length}
                  </Badge>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {retiredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-5"
                      draggable={canManageUsers}
                      onDragStart={() => {
                        setDragId(user.id);
                        setDragGroup("retired");
                      }}
                      onDragOver={(event) => handleDragOverRetired(event, user.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleUserCardClick(user)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleUserCardClick(user);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4">
                          <Avatar className="h-14 w-14 border border-white/10">
                            {user.avatarUrl ? (
                              <AvatarImage src={user.avatarUrl} alt={user.name} />
                            ) : null}
                            <AvatarFallback className="bg-white/10 text-sm text-white">
                              {user.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{user.name}</h3>
                              <Badge className="bg-white/10 text-muted-foreground">Aposentado</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{user.phrase || "—"}</p>
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                              {user.bio || "Sem biografia cadastrada."}
                            </p>
                            {user.roles && user.roles.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {user.roles.map((role) => (
                                  <Badge key={role} variant="secondary" className="text-[10px] uppercase">
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {(canManageBadges || canManageUsers || currentUser?.id === user.id) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={(event) => event.stopPropagation()}>
                                <span className="sr-only">Ações</span>
                                <span className="text-xl leading-none">⋯</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">                              {canManageUsers && (
                                <DropdownMenuItem onClick={() => handleStatusToggle(user)}>
                                  Reativar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </main>
        <Footer />
      </SidebarInset>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[92vw] max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar usuário" : "Adicionar usuário"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Atualize as informações e permissões do usuário."
                : "Cadastre um novo usuário autorizado."}
            </DialogDescription>
          </DialogHeader>
          {rolesOnlyEdit && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-muted-foreground">
              Você só pode alterar as funções deste usuário.
            </div>
          )}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-id">ID do Discord</Label>
              <Input
                id="user-id"
                value={formState.id}
                onChange={(event) => setFormState((prev) => ({ ...prev, id: event.target.value }))}
                placeholder="Ex.: 380305493391966208"
                disabled={Boolean(editingUser) || rolesOnlyEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-name">Nome</Label>
              <Input
                id="user-name"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nome exibido"
                disabled={rolesOnlyEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-phrase">Frase</Label>
              <Input
                id="user-phrase"
                value={formState.phrase}
                onChange={(event) => setFormState((prev) => ({ ...prev, phrase: event.target.value }))}
                placeholder="Frase curta"
                disabled={rolesOnlyEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-bio">Bio</Label>
              <Textarea
                id="user-bio"
                value={formState.bio}
                onChange={(event) => setFormState((prev) => ({ ...prev, bio: event.target.value }))}
                placeholder="Texto da bio"
                rows={4}
                disabled={rolesOnlyEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-avatar">Avatar (URL)</Label>
              <Input
                id="user-avatar"
                value={formState.avatarUrl}
                onChange={(event) => setFormState((prev) => ({ ...prev, avatarUrl: event.target.value }))}
                placeholder="https://"
                disabled={rolesOnlyEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-cover">Imagem do card público (URL)</Label>
              <Input
                id="user-cover"
                value={formState.coverImageUrl}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, coverImageUrl: event.target.value }))
                }
                placeholder="https://"
                disabled={rolesOnlyEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label>Links e redes</Label>
              <div className="grid gap-3">
                {formState.socials.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum link adicionado.</p>
                )}
                {formState.socials.map((social, index) => (
                  <div
                    key={`${social.label}-${index}`}
                    className="grid gap-2 md:grid-cols-[1fr_2fr_auto]"
                  >
                    <Select
                      value={social.label}
                      onValueChange={(value) =>
                        setFormState((prev) => {
                          const next = [...prev.socials];
                          next[index] = { ...next[index], label: value };
                          return { ...prev, socials: next };
                        })
                      }
                      disabled={rolesOnlyEdit}
                    >
                      <SelectTrigger className="bg-background/60 justify-start text-left">
                        <SelectValue placeholder="Selecione a rede" />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {(linkTypes.length > 0 ? linkTypes : fallbackLinkTypes).map((option) => {
                          const Icon = socialIconMap[option.icon] || Globe;
                          return (
                            <SelectItem
                              key={option.id}
                              value={option.id}
                              className="pl-2 pr-2 [&>span:first-child]:hidden"
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <span>{option.label}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                    </Select>
                    <Input
                      value={social.href}
                      onChange={(event) =>
                        setFormState((prev) => {
                          const next = [...prev.socials];
                          next[index] = { ...next[index], href: event.target.value };
                          return { ...prev, socials: next };
                        })
                      }
                      placeholder="https://"
                      disabled={rolesOnlyEdit}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="justify-start md:justify-center"
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          socials: prev.socials.filter((_, idx) => idx !== index),
                        }))
                      }
                      disabled={rolesOnlyEdit}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setFormState((prev) => ({
                      ...prev,
                      socials: [...prev.socials, { label: "", href: "" }],
                    }))
                  }
                  disabled={rolesOnlyEdit}
                >
                  Adicionar link
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Funções</Label>
              {!canManageBadges && (
                <p className="text-xs text-muted-foreground">
                  Apenas dono ou admin podem alterar funções.
                </p>
              )}
              {formState.roles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formState.roles.map((role) => (
                    <div
                      key={role}
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase text-foreground"
                    >
                      <span>{role}</span>
                      <button
                        type="button"
                        className="rounded-full px-1 text-muted-foreground transition hover:text-foreground"
                        onClick={() => toggleRole(role)}
                        disabled={!canManageBadges || isOwnerRecord}
                        aria-label={`Remover ${role}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((role) => {
                  const isSelected = formState.roles.includes(role);
                  return (
                    <Button
                      key={role}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                      onClick={() => toggleRole(role)}
                      disabled={!canManageBadges}
                    >
                      {role}
                    </Button>
                  );
                })}
              </div>
              {isOwnerRecord && (
                <p className="text-xs text-muted-foreground">A badge de dono é automática.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Permissões</Label>
              {isOwnerRecord && (
                <Badge className="w-fit bg-primary/20 text-primary">Acesso total</Badge>
              )}
              <div className="flex flex-wrap gap-2">
                {permissionOptions.map((permission) => {
                  const isSelected = formState.permissions.includes(permission.id);
                  return (
                    <Button
                      key={permission.id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                      onClick={() => togglePermission(permission.id)}
                      disabled={!canManageUsers || isOwnerRecord || rolesOnlyEdit}
                    >
                      {permission.label}
                    </Button>
                  );
                })}
              </div>
              {!canManageUsers && (
                <p className="text-xs text-muted-foreground">
                  Apenas o dono pode alterar permissões.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-status">Status</Label>
              <select
                id="user-status"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={formState.status}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    status: event.target.value === "retired" ? "retired" : "active",
                  }))
                }
                disabled={!canManageUsers || (editingUser ? ownerIds.includes(editingUser.id) : false) || rolesOnlyEdit}
              >
                <option value="active">Ativo</option>
                <option value="retired">Aposentado</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default DashboardUsers;

