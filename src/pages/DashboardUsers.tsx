import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardShell from "@/components/DashboardShell";
import ImageLibraryDialog from "@/components/ImageLibraryDialog";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  UserRound,
  BadgeCheck,
  Check,
  Clock,
  Code,
  Globe,
  Instagram,
  Languages,
  Layers,
  Paintbrush,
  Palette,
  PenTool,
  Sparkles,
  Video,
  X,
  Youtube,
  MessageCircle,
} from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { toast } from "@/components/ui/use-toast";

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

const stripOwnerRole = (roles: string[]) =>
  roles.filter((role) => role.trim().toLowerCase() !== "dono");

const defaultRoleOptions = [
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

const roleIconRegistry: Record<string, typeof Globe> = {
  languages: Languages,
  check: Check,
  "pen-tool": PenTool,
  sparkles: Sparkles,
  code: Code,
  paintbrush: Paintbrush,
  layers: Layers,
  video: Video,
  clock: Clock,
  badge: BadgeCheck,
  palette: Palette,
  user: UserRound,
};

const DashboardUsers = () => {
  usePageMeta({ title: "Usuários", noIndex: true });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const apiBase = getApiBase();
  const { settings } = useSiteSettings();
  const roleOptions = useMemo(() => {
    const labels = settings.teamRoles.map((role) => role.label).filter(Boolean);
    return labels.length ? labels : defaultRoleOptions;
  }, [settings.teamRoles]);
  const roleIconMap = useMemo(
    () => new Map(settings.teamRoles.map((role) => [role.label, role.icon])),
    [settings.teamRoles],
  );
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
  const [ownerToggle, setOwnerToggle] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<"avatar" | "cover">("avatar");
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


  const currentUserRecord = currentUser
    ? users.find((user) => user.id === currentUser.id) || null
    : null;
  const canManageUsers = currentUser?.id ? ownerIds.includes(currentUser.id) : false;
  const primaryOwnerId = ownerIds[0] || "";
  const canManageOwners = Boolean(currentUser?.id && primaryOwnerId && currentUser.id === primaryOwnerId);
  const openLibrary = (target: "avatar" | "cover") => {
    setLibraryTarget(target);
    setIsLibraryOpen(true);
  };
  const handleLibrarySelect = useCallback(
    (url: string) => {
      if (libraryTarget === "avatar") {
        setFormState((prev) => ({ ...prev, avatarUrl: url }));
        return;
      }
      setFormState((prev) => ({ ...prev, coverImageUrl: url }));
    },
    [libraryTarget],
  );
  const currentLibrarySelection = libraryTarget === "avatar" ? formState.avatarUrl : formState.coverImageUrl;
  const openEditDialog = useCallback((user: UserRecord) => {
    const normalizedPermissions = user.permissions.includes("*")
      ? permissionOptions.map((permission) => permission.id)
      : [...user.permissions];
    const normalizedRoles = ownerIds.includes(user.id) ? user.roles : stripOwnerRole(user.roles);
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
      permissions: normalizedPermissions,
      roles: normalizedRoles ? [...normalizedRoles] : [],
    });
    setOwnerToggle(ownerIds.includes(user.id));
    setIsDialogOpen(true);
  }, [ownerIds]);
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
  const isPrimaryOwnerRecord = editingUser ? editingUser.id === primaryOwnerId : false;
  const effectivePermissions = useMemo(() => {
    if (formState.permissions.includes("*")) {
      return permissionOptions.map((permission) => permission.id);
    }
    return formState.permissions;
  }, [formState.permissions]);
  const isAdminRecord = (user: UserRecord) =>
    user.permissions.includes("*") ||
    permissionOptions.every((permission) => user.permissions.includes(permission.id));
  const isAdminForm =
    effectivePermissions.includes("*") ||
    permissionOptions.every((permission) => effectivePermissions.includes(permission.id));
  const rolesOnlyEdit =
    Boolean(editingUser) && canManageBadges && !canManageUsers && currentUser?.id !== editingUser.id;

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, meRes, linkTypesRes] = await Promise.all([
          apiFetch(apiBase, "/api/users", { auth: true }),
          apiFetch(apiBase, "/api/me", { auth: true }),
          apiFetch(apiBase, "/api/link-types"),
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
  }, [currentUserRecord, isDialogOpen, navigate, openEditDialog, searchParams]);

  const openNewDialog = () => {
    setEditingUser(null);
    setFormState(emptyForm);
    setOwnerToggle(false);
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
      roles: ownerToggle ? formState.roles : stripOwnerRole(formState.roles),
    };
    const payload =
      editingUser && !canManageUsers && canManageBadges
        ? { roles: formState.roles }
        : basePayload;

    if (!editingUser && (!basePayload.id || !basePayload.name)) {
      return;
    }

    const method = editingUser ? "PUT" : "POST";
    const path = editingUser
      ? canManageUsers
        ? `/api/users/${editingUser.id}`
        : "/api/users/self"
      : "/api/users";

    const response = await apiFetch(apiBase, path, {
      method,
      auth: true,
      json: payload,
    });

    if (response.ok) {
      const data = await response.json();
      const targetId = editingUser ? editingUser.id : data.user?.id || basePayload.id;
      const shouldKeepOwner =
        ownerToggle && (!editingUser || !ownerIds.includes(editingUser.id) || isAdminForm);
      if (canManageOwners && targetId) {
        const nextOwnerIds = shouldKeepOwner
          ? Array.from(new Set([...ownerIds, targetId]))
          : ownerIds.filter((id) => id !== targetId);
        if (nextOwnerIds.join(",") !== ownerIds.join(",")) {
          const ownersResponse = await apiFetch(apiBase, "/api/owners", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            auth: true,
            body: JSON.stringify({ ownerIds: nextOwnerIds }),
          });
          if (ownersResponse.ok) {
            const ownersData = await ownersResponse.json();
            setOwnerIds(Array.isArray(ownersData.ownerIds) ? ownersData.ownerIds : nextOwnerIds);
            if (!shouldKeepOwner) {
              setOwnerToggle(false);
            }
          } else if (!shouldKeepOwner) {
            toast({ title: "Não foi possível rebaixar o dono" });
          }
        }
      }
      const sanitizedPermissions = formState.permissions.includes("*")
        ? permissionOptions.map((permission) => permission.id)
        : formState.permissions;
      const updatedUser =
        !shouldKeepOwner && editingUser
          ? { ...data.user, permissions: sanitizedPermissions }
          : data.user;
      if (editingUser) {
        setUsers((prev) => prev.map((user) => (user.id === editingUser.id ? updatedUser : user)));
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
    const response = await apiFetch(apiBase, `/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      auth: true,
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
      const basePermissions = prev.permissions.includes("*")
        ? permissionOptions.map((permission) => permission.id)
        : prev.permissions;
      const hasPermission = basePermissions.includes(permissionId);
      return {
        ...prev,
        permissions: hasPermission
          ? basePermissions.filter((item) => item !== permissionId)
          : [...basePermissions, permissionId],
      };
    });
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) {
      return;
    }
    const response = await apiFetch(apiBase, `/api/users/${deleteTarget.id}`, {
      method: "DELETE",
      auth: true,
    });
    if (!response.ok) {
      toast({ title: "Não foi possível excluir o usuário" });
      return;
    }
    const data = await response.json();
    setUsers((prev) => prev.filter((user) => user.id !== deleteTarget.id));
    if (Array.isArray(data.ownerIds)) {
      setOwnerIds(data.ownerIds);
    }
    if (editingUser && editingUser.id === deleteTarget.id) {
      setIsDialogOpen(false);
    }
    setDeleteTarget(null);
    toast({ title: "Usuário excluído" });
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
    await apiFetch(apiBase, "/api/users/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      auth: true,
      body: JSON.stringify({ orderedIds, retiredIds }),
    });
    setDragId(null);
    setDragGroup(null);
  };

  return (
    <>
      <DashboardShell
        currentUser={currentUser}
        onUserCardClick={currentUserRecord ? () => handleUserCardClick(currentUserRecord) : undefined}
      >
      <main className="pt-24">
          <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Usuários
                </div>
                <h1 className="mt-4 text-3xl font-semibold lg:text-4xl">Gestão de Usuários</h1>
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
                <Badge className="bg-white/10 text-muted-foreground">{activeUsers.length}</Badge>
              </div>

              {isLoading ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-sm text-muted-foreground">
                  Carregando Usuários...
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
                              {!ownerIds.includes(user.id) && isAdminRecord(user) && (
                                <Badge className="bg-white/10 text-muted-foreground">Administrador</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.phrase || "-"}</p>
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                              {user.bio || "Sem biografia cadastrada."}
                            </p>
                            {user.roles && user.roles.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(ownerIds.includes(user.id)
                                  ? user.roles
                                  : stripOwnerRole(user.roles)
                                ).map((role) => (
                                  <Badge key={role} variant="secondary" className="text-[10px] uppercase">
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {retiredUsers.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Usuários aposentados</h2>
                    <Badge className="bg-white/10 text-muted-foreground">{retiredUsers.length}</Badge>
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
                                {isAdminRecord(user) && (
                                  <Badge className="bg-white/10 text-muted-foreground">Administrador</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{user.phrase || "-"}</p>
                              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                                {user.bio || "Sem biografia cadastrada."}
                              </p>
                              {user.roles && user.roles.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {(ownerIds.includes(user.id)
                                    ? user.roles
                                    : stripOwnerRole(user.roles)
                                  ).map((role) => (
                                    <Badge key={role} variant="secondary" className="text-[10px] uppercase">
                                      {role}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </DashboardShell>
      <ImageLibraryDialog
        open={isLibraryOpen}
        onOpenChange={setIsLibraryOpen}
        apiBase={apiBase}
        description="Selecione uma imagem já enviada para reutilizar ou envie um novo arquivo."
        uploadFolder="users"
        listFolders={[""]}
        showAltInput={false}
        allowDeselect
        currentSelectionUrl={currentLibrarySelection || undefined}
        onSelect={(url) => handleLibrarySelect(url)}
      />

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
              <Label>Avatar</Label>
              <div className="flex flex-wrap items-center gap-3">
                {formState.avatarUrl ? (
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={formState.avatarUrl} alt={formState.name || "Avatar"} />
                    <AvatarFallback>{(formState.name || "U").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border/60 text-[10px] text-muted-foreground">
                    Sem imagem
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openLibrary("avatar")}
                  disabled={rolesOnlyEdit}
                >
                  Biblioteca
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Imagem do card público</Label>
              <div className="flex flex-wrap items-center gap-3">
                {formState.coverImageUrl ? (
                  <img
                    src={formState.coverImageUrl}
                    alt={formState.name || "Capa"}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border/60 text-[10px] text-muted-foreground">
                    Sem imagem
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openLibrary("cover")}
                  disabled={rolesOnlyEdit}
                >
                  Biblioteca
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Links e redes</Label>
              <div className="grid gap-3">
                {formState.socials.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum link adicionado.</p>
                ) : null}
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
                <p className="text-xs text-muted-foreground">Apenas dono ou admin podem alterar Funções.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((role) => {
                  const isSelected = formState.roles.includes(role);
                  const iconKey = roleIconMap.get(role);
                  const RoleIcon = iconKey ? roleIconRegistry[String(iconKey).toLowerCase()] : null;
                  return (
                    <Button
                      key={role}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                      onClick={() => toggleRole(role)}
                      disabled={!canManageBadges}
                    >
                      {RoleIcon ? <RoleIcon className="h-4 w-4" /> : null}
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
              {isOwnerRecord && <Badge className="w-fit bg-primary/20 text-primary">Acesso total</Badge>}
              {!isOwnerRecord && isAdminForm && (
                <Badge className="w-fit bg-white/10 text-muted-foreground">Administrador</Badge>
              )}
              <div className="flex flex-wrap gap-2">
                {permissionOptions.map((permission) => {
                  const isSelected = effectivePermissions.includes(permission.id);
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
                <p className="text-xs text-muted-foreground">Apenas o dono pode alterar permissões.</p>
              )}
            </div>
            {canManageUsers ? (
              <div className="grid gap-2">
                <Label>Dono</Label>
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Permite acesso total ao painel e às configurações críticas.
                  </span>
                  <Switch
                    checked={ownerToggle}
                    onCheckedChange={setOwnerToggle}
                    disabled={!canManageOwners || rolesOnlyEdit || isPrimaryOwnerRecord}
                  />
                </div>
                {!canManageOwners ? (
                  <p className="text-xs text-muted-foreground">
                    Apenas o primeiro dono pode promover ou rebaixar outros donos.
                  </p>
                ) : null}
                {isPrimaryOwnerRecord ? (
                  <p className="text-xs text-muted-foreground">
                    O primeiro dono não pode ser rebaixado.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Status</Label>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {formState.status === "active" ? "Ativo" : "Aposentado"}
                </span>
                <Switch
                  checked={formState.status === "active"}
                  onCheckedChange={(checked) =>
                    setFormState((prev) => ({ ...prev, status: checked ? "active" : "retired" }))
                  }
                  disabled={!canManageUsers || isOwnerRecord || rolesOnlyEdit}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              {editingUser ? (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteTarget(editingUser)}
                  disabled={!canManageUsers || isPrimaryOwnerRecord || editingUser.id === currentUser?.id}
                >
                  Excluir
                </Button>
              ) : null}
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
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir usuário?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `Excluir "${deleteTarget.name}"? Esta ação não pode ser desfeita.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DashboardUsers;





