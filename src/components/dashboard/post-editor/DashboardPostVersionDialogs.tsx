import type { Project } from "@/data/projects";
import type { ContentVersion } from "@/types/editorial";

import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import AsyncState from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTimeShort } from "@/lib/date";
import { RotateCcw } from "lucide-react";

import {
  getPostStatusLabel,
  isVersionRestorableAgainstPost,
  type PostRecord,
} from "@/components/dashboard/post-editor/dashboard-posts-types";

type DashboardPostVersionDialogsProps = {
  editingPost: PostRecord | null;
  hasVersionsError: boolean;
  isCreatingManualVersion: boolean;
  isLoadingVersions: boolean;
  isRollingBackVersion: boolean;
  isVersionHistoryOpen: boolean;
  loadVersionHistory: (postId: string) => Promise<void>;
  onConfirmRollbackVersion: () => Promise<void>;
  onCreateManualVersion: () => Promise<void>;
  onVersionHistoryOpenChange: (open: boolean) => void;
  persistedEditingPost: PostRecord | null;
  postVersions: ContentVersion[];
  projectMap: Map<string, Project>;
  rollbackTargetVersion: ContentVersion | null;
  setRollbackTargetVersion: (version: ContentVersion | null) => void;
  versionsNextCursor: string | null;
};

export const DashboardPostVersionDialogs = ({
  editingPost,
  hasVersionsError,
  isCreatingManualVersion,
  isLoadingVersions,
  isRollingBackVersion,
  isVersionHistoryOpen,
  loadVersionHistory,
  onConfirmRollbackVersion,
  onCreateManualVersion,
  onVersionHistoryOpenChange,
  persistedEditingPost,
  postVersions,
  projectMap,
  rollbackTargetVersion,
  setRollbackTargetVersion,
  versionsNextCursor,
}: DashboardPostVersionDialogsProps) => (
  <>
    <Dialog open={isVersionHistoryOpen} onOpenChange={onVersionHistoryOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de versões</DialogTitle>
          <DialogDescription>
            {editingPost
              ? `Postagem: ${editingPost.title}`
              : "Selecione uma postagem para visualizar versões."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Versões mais recentes primeiro. Rollback restaura o conteúdo editorial da versão
              escolhida.
            </p>
            {editingPost ? (
              <DashboardActionButton
                type="button"
                size="sm"
                disabled={isCreatingManualVersion}
                onClick={() => void onCreateManualVersion()}
              >
                {isCreatingManualVersion ? "Criando..." : "Criar versão agora"}
              </DashboardActionButton>
            ) : null}
          </div>
          {isLoadingVersions ? (
            <AsyncState
              kind="loading"
              title="Carregando versões"
              description="Buscando histórico da postagem."
              className="border-0 bg-transparent p-0"
            />
          ) : hasVersionsError ? (
            <AsyncState
              kind="error"
              title="Não foi possível carregar o histórico"
              description="Tente novamente em alguns instantes."
              className="border-0 bg-transparent p-0"
              action={
                editingPost ? (
                  <DashboardActionButton
                    type="button"
                    onClick={() => void loadVersionHistory(editingPost.id)}
                  >
                    Recarregar
                  </DashboardActionButton>
                ) : null
              }
            />
          ) : postVersions.length === 0 ? (
            <AsyncState
              kind="empty"
              title="Sem versões ainda"
              description="As versões aparecem após salvar/editar a postagem."
              className="border-0 bg-transparent p-0"
            />
          ) : (
            <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
              {postVersions.map((version) => {
                const isRestorable = isVersionRestorableAgainstPost(version, persistedEditingPost);
                return (
                  <div
                    key={version.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/60 p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          v{version.versionNumber}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {version.reasonLabel || version.reason}
                        </Badge>
                        {version.label ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {version.label}
                          </Badge>
                        ) : null}
                        {!isRestorable ? (
                          <Badge variant="outline" className="text-[10px] uppercase">
                            Estado atual
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {formatDateTimeShort(version.createdAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {version.actorName || "Sistema"} {"•"} /{version.slug}
                      </p>
                    </div>
                    <div className="shrink-0 self-start">
                      {isRestorable ? (
                        <DashboardActionButton
                          type="button"
                          size="sm"
                          className="gap-2"
                          onClick={() => setRollbackTargetVersion(version)}
                        >
                          <RotateCcw className="h-4 w-4" />
                          {"Restaurar esta versão"}
                        </DashboardActionButton>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {versionsNextCursor ? (
                <p className="text-xs text-muted-foreground">
                  Há mais versões antigas disponíveis. (Paginação v1 ainda não exposta na UI)
                </p>
              ) : null}
            </div>
          )}
          <div className="flex justify-end">
            <DashboardActionButton
              type="button"
              onClick={() => onVersionHistoryOpenChange(false)}
            >
              Fechar
            </DashboardActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={Boolean(rollbackTargetVersion)}
      onOpenChange={(open) => !open && setRollbackTargetVersion(null)}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Restaurar versão?</DialogTitle>
          <DialogDescription>
            {rollbackTargetVersion
              ? `Restaurar a versão v${rollbackTargetVersion.versionNumber} de ${formatDateTimeShort(
                  rollbackTargetVersion.createdAt,
                )}?`
              : "Confirme o rollback da versão selecionada."}
          </DialogDescription>
        </DialogHeader>
        {rollbackTargetVersion ? (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">
                  v{rollbackTargetVersion.versionNumber}
                </Badge>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {rollbackTargetVersion.reasonLabel || rollbackTargetVersion.reason}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {getPostStatusLabel(
                    rollbackTargetVersion.snapshot?.status === "scheduled" ||
                      rollbackTargetVersion.snapshot?.status === "published"
                      ? rollbackTargetVersion.snapshot.status
                      : "draft",
                  )}
                </Badge>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Título
                  </p>
                  <p className="font-medium text-foreground">
                    {rollbackTargetVersion.snapshot?.title || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Slug
                  </p>
                  <p className="font-medium text-foreground">
                    /{rollbackTargetVersion.snapshot?.slug || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Versão salva
                  </p>
                  <p className="text-foreground">
                    {formatDateTimeShort(rollbackTargetVersion.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Data editorial
                  </p>
                  <p className="text-foreground">
                    {(() => {
                      const editorialAt =
                        rollbackTargetVersion.snapshot?.status === "scheduled"
                          ? rollbackTargetVersion.snapshot?.scheduledAt ||
                            rollbackTargetVersion.snapshot?.publishedAt
                          : rollbackTargetVersion.snapshot?.publishedAt;
                      return editorialAt ? formatDateTimeShort(editorialAt) : "Sem data";
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Autor
                  </p>
                  <p className="text-foreground">
                    {rollbackTargetVersion.snapshot?.author || "Não definido"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Projeto
                  </p>
                  <p className="text-foreground">
                    {rollbackTargetVersion.snapshot?.projectId
                      ? projectMap.get(String(rollbackTargetVersion.snapshot.projectId || ""))
                          ?.title || `ID ${rollbackTargetVersion.snapshot.projectId}`
                      : "Sem projeto"}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Resumo
                </p>
                <p className="line-clamp-3 text-sm text-foreground/90">
                  {String(rollbackTargetVersion.snapshot?.excerpt || "").trim() || "Sem resumo"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
        <div className="flex justify-end gap-3">
          <DashboardActionButton
            type="button"
            disabled={isRollingBackVersion}
            onClick={() => setRollbackTargetVersion(null)}
          >
            Cancelar
          </DashboardActionButton>
          <DashboardActionButton
            type="button"
            tone="primary"
            disabled={isRollingBackVersion}
            onClick={() => void onConfirmRollbackVersion()}
          >
            {isRollingBackVersion ? "Restaurando..." : "Confirmar rollback"}
          </DashboardActionButton>
        </div>
      </DialogContent>
    </Dialog>
  </>
);
