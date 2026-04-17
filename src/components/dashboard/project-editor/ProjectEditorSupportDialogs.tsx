import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import { Combobox, Input } from "@/components/dashboard/dashboard-form-controls";
import type { EditorProjectEpisode } from "@/components/dashboard/project-editor/dashboard-projects-editor-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type ProjectEditorConfirmDialogProps = {
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export const ProjectEditorConfirmDialog = ({
  description,
  onCancel,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ProjectEditorConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="flex justify-end gap-3">
        <DashboardActionButton size="sm" onClick={onCancel}>
          Continuar editando
        </DashboardActionButton>
        <DashboardActionButton size="sm" tone="destructive" onClick={onConfirm}>
          Sair
        </DashboardActionButton>
      </div>
    </DialogContent>
  </Dialog>
);

type ProjectEditorAnimeBatchDialogProps = {
  cadenceDays: string;
  durationInput: string;
  onCadenceDaysChange: (nextValue: string) => void;
  onCreate: () => void;
  onDurationInputChange: (nextValue: string) => void;
  onOpenChange: (open: boolean) => void;
  onPublicationStatusChange: (nextValue: "draft" | "published") => void;
  onQuantityChange: (nextValue: string) => void;
  onSourceTypeChange: (nextValue: EditorProjectEpisode["sourceType"]) => void;
  onStartNumberChange: (nextValue: string) => void;
  open: boolean;
  publicationStatus: "draft" | "published";
  quantity: string;
  sourceType: EditorProjectEpisode["sourceType"];
  startNumber: string;
};

export const ProjectEditorAnimeBatchDialog = ({
  cadenceDays,
  durationInput,
  onCadenceDaysChange,
  onCreate,
  onDurationInputChange,
  onOpenChange,
  onPublicationStatusChange,
  onQuantityChange,
  onSourceTypeChange,
  onStartNumberChange,
  open,
  publicationStatus,
  quantity,
  sourceType,
  startNumber,
}: ProjectEditorAnimeBatchDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Criar lote de episódios</DialogTitle>
        <DialogDescription>
          Adiciona vários episódios sequenciais ao formulário com defaults de data, duração, origem
          e status.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 md:grid-cols-2">
        <DashboardFieldStack>
          <Label htmlFor="anime-batch-start-number">Episódio inicial</Label>
          <Input
            id="anime-batch-start-number"
            type="number"
            min={1}
            value={startNumber}
            onChange={(event) => onStartNumberChange(event.target.value)}
          />
        </DashboardFieldStack>
        <DashboardFieldStack>
          <Label htmlFor="anime-batch-quantity">Quantidade</Label>
          <Input
            id="anime-batch-quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => onQuantityChange(event.target.value)}
          />
        </DashboardFieldStack>
        <DashboardFieldStack>
          <Label htmlFor="anime-batch-cadence">Cadência de datas</Label>
          <Input
            id="anime-batch-cadence"
            type="number"
            min={0}
            value={cadenceDays}
            onChange={(event) => onCadenceDaysChange(event.target.value)}
            placeholder="Dias"
          />
        </DashboardFieldStack>
        <DashboardFieldStack>
          <Label htmlFor="anime-batch-duration">Duração padrão</Label>
          <Input
            id="anime-batch-duration"
            value={durationInput}
            onChange={(event) => onDurationInputChange(event.target.value)}
            placeholder="MM:SS ou H:MM:SS"
          />
        </DashboardFieldStack>
        <DashboardFieldStack>
          <Label htmlFor="anime-batch-source-type">Origem padrão</Label>
          <Combobox
            id="anime-batch-source-type"
            value={sourceType}
            onValueChange={(value) =>
              onSourceTypeChange(value as EditorProjectEpisode["sourceType"])
            }
            ariaLabel="Origem padrão"
            options={[
              { value: "TV", label: "TV" },
              { value: "Web", label: "Web" },
              { value: "Blu-ray", label: "Blu-ray" },
            ]}
            placeholder="Origem"
            searchable={false}
          />
        </DashboardFieldStack>
        <DashboardFieldStack>
          <Label htmlFor="anime-batch-status">Status inicial</Label>
          <Combobox
            id="anime-batch-status"
            value={publicationStatus}
            onValueChange={(value) =>
              onPublicationStatusChange(value === "draft" ? "draft" : "published")
            }
            ariaLabel="Status inicial"
            options={[
              { value: "draft", label: "Rascunho" },
              { value: "published", label: "Publicado" },
            ]}
            placeholder="Status"
            searchable={false}
          />
        </DashboardFieldStack>
      </div>
      <div className="flex justify-end gap-3">
        <DashboardActionButton size="sm" onClick={() => onOpenChange(false)}>
          Cancelar
        </DashboardActionButton>
        <DashboardActionButton size="sm" tone="primary" onClick={onCreate}>
          Criar lote
        </DashboardActionButton>
      </div>
    </DialogContent>
  </Dialog>
);

type ProjectEditorDeleteDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  targetTitle?: string | null;
};

export const ProjectEditorDeleteDialog = ({
  onCancel,
  onConfirm,
  onOpenChange,
  open,
  targetTitle,
}: ProjectEditorDeleteDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Excluir projeto?</DialogTitle>
        <DialogDescription>
          {targetTitle ? `Excluir "${targetTitle}"? Você pode restaurar por até 3 dias.` : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-end gap-3">
        <DashboardActionButton size="sm" onClick={onCancel}>
          Cancelar
        </DashboardActionButton>
        <DashboardActionButton size="sm" tone="destructive" onClick={onConfirm}>
          Excluir
        </DashboardActionButton>
      </div>
    </DialogContent>
  </Dialog>
);
