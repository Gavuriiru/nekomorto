import { memo, type Dispatch, type SetStateAction } from "react";

import Button from "@/components/dashboard/DashboardActionButton";
import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import {
  Combobox,
  Input,
  Textarea,
} from "@/components/dashboard/dashboard-form-controls";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { translateGenre, translateTag } from "@/lib/project-taxonomy";

import type { ProjectForm, TaxonomySuggestionOption } from "./dashboard-projects-editor-types";
import ProjectEditorAccordionHeader from "./ProjectEditorAccordionHeader";

type ProjectEditorInformationSectionProps = {
  adjacentMetadataInputClassName: string;
  animationStudioInput: string;
  contentClassName: string;
  editorSectionBlockClassName: string;
  editorSectionBlockDividerClassName: string;
  editorSectionBlockTitleClassName: string;
  formState: ProjectForm;
  formatSelectOptions: string[];
  genreInput: string;
  genreSuggestions: TaxonomySuggestionOption[];
  genreTranslationMap: Map<string, string>;
  hasAniListReference: boolean;
  onAddAnimationStudio: () => void;
  onAddGenre: () => void;
  onAddProducer: () => void;
  onAddTag: () => void;
  onAppendGenreValue: (value: string) => void;
  onAppendTagValue: (value: string) => void;
  onRemoveAnimationStudio: (studioName: string) => void;
  onRemoveGenre: (genre: string) => void;
  onRemoveProducer: (producer: string) => void;
  onRemoveTag: (tag: string) => void;
  producerInput: string;
  sectionClassName: string;
  setAnimationStudioInput: (nextValue: string) => void;
  setFormState: Dispatch<SetStateAction<ProjectForm>>;
  setGenreInput: (nextValue: string) => void;
  setProducerInput: (nextValue: string) => void;
  setTagInput: (nextValue: string) => void;
  statusOptions: string[];
  tagInput: string;
  tagSuggestions: TaxonomySuggestionOption[];
  tagTranslationMap: Map<string, string>;
  translatedSortedEditorGenres: string[];
  translatedSortedEditorTags: string[];
  triggerClassName: string;
};

const ProjectEditorInformationSectionComponent = ({
  adjacentMetadataInputClassName,
  animationStudioInput,
  contentClassName,
  editorSectionBlockClassName,
  editorSectionBlockDividerClassName,
  editorSectionBlockTitleClassName,
  formState,
  formatSelectOptions,
  genreInput,
  genreSuggestions,
  genreTranslationMap,
  hasAniListReference,
  onAddAnimationStudio,
  onAddGenre,
  onAddProducer,
  onAddTag,
  onAppendGenreValue,
  onAppendTagValue,
  onRemoveAnimationStudio,
  onRemoveGenre,
  onRemoveProducer,
  onRemoveTag,
  producerInput,
  sectionClassName,
  setAnimationStudioInput,
  setFormState,
  setGenreInput,
  setProducerInput,
  setTagInput,
  statusOptions,
  tagInput,
  tagSuggestions,
  tagTranslationMap,
  translatedSortedEditorGenres,
  translatedSortedEditorTags,
  triggerClassName,
}: ProjectEditorInformationSectionProps) => (
  <AccordionItem value="informacoes" className={sectionClassName}>
    <AccordionTrigger className={triggerClassName}>
      <ProjectEditorAccordionHeader
        title="Informações do projeto"
        subtitle={`${formState.title || "Títulos, classificação e metadados"} • ${
          formState.type || "Formato"
        } • ${formState.status || "Status"} • ${formState.tags.length} tags • ${
          formState.genres.length
        } gêneros`}
      />
    </AccordionTrigger>
    <AccordionContent className={contentClassName}>
      <div className="space-y-6">
        <section className={editorSectionBlockClassName}>
          <div className="space-y-1">
            <h3 className={editorSectionBlockTitleClassName}>Dados principais</h3>
            <p className="text-xs leading-5 text-muted-foreground">
              ID, títulos, sinopse e destaque no carrossel.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DashboardFieldStack>
              <Label>ID do projeto</Label>
              <Input
                value={formState.id}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  const trimmed = nextValue.trim();
                  if (!hasAniListReference && trimmed && /^\d+$/.test(trimmed)) {
                    return;
                  }
                  setFormState((prev) => ({ ...prev, id: nextValue }));
                }}
                placeholder="Mesmo ID do AniList ou slug manual"
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Título</Label>
              <Input
                value={formState.title}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Título original</Label>
              <Input
                value={formState.titleOriginal}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    titleOriginal: event.target.value,
                  }))
                }
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Título em inglês</Label>
              <Input
                value={formState.titleEnglish}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    titleEnglish: event.target.value,
                  }))
                }
              />
            </DashboardFieldStack>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="force-hero-switch">Forçar no carrossel</Label>
              <Switch
                id="force-hero-switch"
                checked={Boolean(formState.forceHero)}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({ ...prev, forceHero: checked }))
                }
              />
            </div>
            <DashboardFieldStack className="md:col-span-2">
              <Label>Sinopse</Label>
              <Textarea
                value={formState.synopsis}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    synopsis: event.target.value,
                  }))
                }
                rows={6}
              />
            </DashboardFieldStack>
          </div>
        </section>

        <section className={`${editorSectionBlockClassName} ${editorSectionBlockDividerClassName}`}>
          <div className="space-y-1">
            <h3 className={editorSectionBlockTitleClassName}>Classificação</h3>
            <p className="text-xs leading-5 text-muted-foreground">
              Tags editoriais e gêneros usados no projeto.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DashboardFieldStack>
              <Label>Tags</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onAddTag();
                    }
                  }}
                  placeholder="Adicionar tag"
                />
              </div>
              {tagSuggestions.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tagSuggestions.map((option) => (
                    <Button
                      key={`tag-suggestion-${option.value}`}
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        onAppendTagValue(option.value);
                        setTagInput("");
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {translatedSortedEditorTags.map((tag, index) => (
                  <Badge
                    key={`${tag}-${index}`}
                    variant="secondary"
                    onClick={() => onRemoveTag(tag)}
                    className="cursor-pointer"
                  >
                    {translateTag(tag, tagTranslationMap)}
                  </Badge>
                ))}
              </div>
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Gêneros</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={genreInput}
                  onChange={(event) => setGenreInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onAddGenre();
                    }
                  }}
                  placeholder="Adicionar gênero"
                />
              </div>
              {genreSuggestions.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {genreSuggestions.map((option) => (
                    <Button
                      key={`genre-suggestion-${option.value}`}
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        onAppendGenreValue(option.value);
                        setGenreInput("");
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {translatedSortedEditorGenres.map((genre, index) => (
                  <Badge
                    key={`${genre}-${index}`}
                    variant="secondary"
                    onClick={() => onRemoveGenre(genre)}
                    className="cursor-pointer"
                  >
                    {translateGenre(genre, genreTranslationMap)}
                  </Badge>
                ))}
              </div>
            </DashboardFieldStack>
          </div>
        </section>

        <section className={`${editorSectionBlockClassName} ${editorSectionBlockDividerClassName}`}>
          <div className="space-y-1">
            <h3 className={editorSectionBlockTitleClassName}>Metadados</h3>
            <p className="text-xs leading-5 text-muted-foreground">
              Formato, status e dados editoriais do projeto.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DashboardFieldStack>
              <Label>Formato</Label>
              <Combobox
                value={formState.type}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, type: value }))}
                ariaLabel="Selecionar formato"
                options={formatSelectOptions.map((option) => ({
                  value: option,
                  label: option,
                }))}
                placeholder="Formato"
                searchable={false}
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Status</Label>
              <Combobox
                value={formState.status}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, status: value }))}
                ariaLabel="Selecionar status"
                options={statusOptions.map((option) => ({
                  value: option,
                  label: option,
                }))}
                placeholder="Status"
                searchable={false}
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Ano</Label>
              <Input
                value={formState.year}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, year: event.target.value }))
                }
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Temporada</Label>
              <Input
                value={formState.season}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, season: event.target.value }))
                }
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Estúdio</Label>
              <Input
                value={formState.studio}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, studio: event.target.value }))
                }
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Episódios/Capítulos</Label>
              <Input
                value={formState.episodes}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    episodes: event.target.value,
                  }))
                }
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>País de origem</Label>
              <Input
                value={formState.country}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, country: event.target.value }))
                }
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Fonte</Label>
              <Input
                value={formState.source}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, source: event.target.value }))
                }
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Cargo Discord (ID)</Label>
              <Input
                value={formState.discordRoleId || ""}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    discordRoleId: event.target.value.replace(/\D/g, ""),
                  }))
                }
                placeholder="Opcional: ID numerico do cargo"
              />
            </DashboardFieldStack>
          </div>
        </section>

        <section className={`${editorSectionBlockClassName} ${editorSectionBlockDividerClassName}`}>
          <div className="space-y-1">
            <h3 className={editorSectionBlockTitleClassName}>Estúdios e produtoras</h3>
            <p className="text-xs leading-5 text-muted-foreground">
              Separe o estúdio principal dos estúdios de animação e das produtoras.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DashboardFieldStack>
              <Label>Estúdio principal</Label>
              <Input
                className={adjacentMetadataInputClassName}
                value={formState.studio}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, studio: event.target.value }))
                }
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Produtoras</Label>
              <Input
                className={adjacentMetadataInputClassName}
                value={producerInput}
                onChange={(event) => setProducerInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onAddProducer();
                  }
                }}
                placeholder="Adicionar produtora e pressionar Enter"
              />
            </DashboardFieldStack>
            <DashboardFieldStack className="md:col-span-2">
              <Label>Estúdios de animação</Label>
              <Input
                className={adjacentMetadataInputClassName}
                value={animationStudioInput}
                onChange={(event) => setAnimationStudioInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onAddAnimationStudio();
                  }
                }}
                placeholder="Adicionar estúdio de animação e pressionar Enter"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {formState.animationStudios.map((studioName, index) => (
                  <Badge
                    key={`${studioName}-${index}`}
                    variant="secondary"
                    onClick={() => onRemoveAnimationStudio(studioName)}
                    className="cursor-pointer"
                  >
                    {studioName}
                  </Badge>
                ))}
              </div>
            </DashboardFieldStack>
            <div className="space-y-2 md:col-span-2">
              <Label>Lista atual de produtoras</Label>
              <div className="flex flex-wrap gap-2">
                {formState.producers.map((producer, index) => (
                  <Badge
                    key={`${producer}-${index}`}
                    variant="secondary"
                    onClick={() => onRemoveProducer(producer)}
                    className="cursor-pointer"
                  >
                    {producer}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AccordionContent>
  </AccordionItem>
);

const areProjectEditorInformationArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const areProjectEditorInformationPropsEqual = (
  previousProps: ProjectEditorInformationSectionProps,
  nextProps: ProjectEditorInformationSectionProps,
) => {
  if (
    previousProps.adjacentMetadataInputClassName !== nextProps.adjacentMetadataInputClassName ||
    previousProps.animationStudioInput !== nextProps.animationStudioInput ||
    previousProps.contentClassName !== nextProps.contentClassName ||
    previousProps.editorSectionBlockClassName !== nextProps.editorSectionBlockClassName ||
    previousProps.editorSectionBlockDividerClassName !==
      nextProps.editorSectionBlockDividerClassName ||
    previousProps.editorSectionBlockTitleClassName !== nextProps.editorSectionBlockTitleClassName ||
    previousProps.genreInput !== nextProps.genreInput ||
    previousProps.genreSuggestions !== nextProps.genreSuggestions ||
    previousProps.genreTranslationMap !== nextProps.genreTranslationMap ||
    previousProps.hasAniListReference !== nextProps.hasAniListReference ||
    previousProps.onAddAnimationStudio !== nextProps.onAddAnimationStudio ||
    previousProps.onAddGenre !== nextProps.onAddGenre ||
    previousProps.onAddProducer !== nextProps.onAddProducer ||
    previousProps.onAddTag !== nextProps.onAddTag ||
    previousProps.onAppendGenreValue !== nextProps.onAppendGenreValue ||
    previousProps.onAppendTagValue !== nextProps.onAppendTagValue ||
    previousProps.onRemoveAnimationStudio !== nextProps.onRemoveAnimationStudio ||
    previousProps.onRemoveGenre !== nextProps.onRemoveGenre ||
    previousProps.onRemoveProducer !== nextProps.onRemoveProducer ||
    previousProps.onRemoveTag !== nextProps.onRemoveTag ||
    previousProps.producerInput !== nextProps.producerInput ||
    previousProps.sectionClassName !== nextProps.sectionClassName ||
    previousProps.setAnimationStudioInput !== nextProps.setAnimationStudioInput ||
    previousProps.setFormState !== nextProps.setFormState ||
    previousProps.setGenreInput !== nextProps.setGenreInput ||
    previousProps.setProducerInput !== nextProps.setProducerInput ||
    previousProps.setTagInput !== nextProps.setTagInput ||
    previousProps.tagInput !== nextProps.tagInput ||
    previousProps.tagSuggestions !== nextProps.tagSuggestions ||
    previousProps.tagTranslationMap !== nextProps.tagTranslationMap ||
    previousProps.triggerClassName !== nextProps.triggerClassName
  ) {
    return false;
  }

  if (
    !areProjectEditorInformationArraysEqual(
      previousProps.formatSelectOptions,
      nextProps.formatSelectOptions,
    ) ||
    !areProjectEditorInformationArraysEqual(previousProps.statusOptions, nextProps.statusOptions) ||
    !areProjectEditorInformationArraysEqual(
      previousProps.translatedSortedEditorGenres,
      nextProps.translatedSortedEditorGenres,
    ) ||
    !areProjectEditorInformationArraysEqual(
      previousProps.translatedSortedEditorTags,
      nextProps.translatedSortedEditorTags,
    )
  ) {
    return false;
  }

  const previousFormState = previousProps.formState;
  const nextFormState = nextProps.formState;

  return (
    previousFormState.id === nextFormState.id &&
    previousFormState.title === nextFormState.title &&
    previousFormState.titleOriginal === nextFormState.titleOriginal &&
    previousFormState.titleEnglish === nextFormState.titleEnglish &&
    previousFormState.forceHero === nextFormState.forceHero &&
    previousFormState.synopsis === nextFormState.synopsis &&
    previousFormState.type === nextFormState.type &&
    previousFormState.status === nextFormState.status &&
    previousFormState.year === nextFormState.year &&
    previousFormState.season === nextFormState.season &&
    previousFormState.studio === nextFormState.studio &&
    previousFormState.episodes === nextFormState.episodes &&
    previousFormState.country === nextFormState.country &&
    previousFormState.source === nextFormState.source &&
    previousFormState.discordRoleId === nextFormState.discordRoleId &&
    areProjectEditorInformationArraysEqual(
      previousFormState.animationStudios,
      nextFormState.animationStudios,
    ) &&
    areProjectEditorInformationArraysEqual(previousFormState.producers, nextFormState.producers) &&
    areProjectEditorInformationArraysEqual(previousFormState.tags, nextFormState.tags) &&
    areProjectEditorInformationArraysEqual(previousFormState.genres, nextFormState.genres)
  );
};

export const ProjectEditorInformationSection = memo(
  ProjectEditorInformationSectionComponent,
  areProjectEditorInformationPropsEqual,
);

ProjectEditorInformationSection.displayName = "ProjectEditorInformationSection";

export default ProjectEditorInformationSection;
