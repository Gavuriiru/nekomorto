import ImageLibraryProjectSection from "@/components/image-library/ImageLibraryProjectSection";
import ImageLibraryUploadSection from "@/components/image-library/ImageLibraryUploadSection";
import type {
  LibraryImageItem,
  ProjectImageGroup,
  UploadFolderGroup,
} from "@/components/image-library/types";
import type { Dispatch, SetStateAction } from "react";

export type ImageLibraryBrowserPaneProps = {
  allowUploadManagementActions: boolean;
  beginAltTextEdit: (item: LibraryImageItem) => void;
  beginFocalPointEdit: (item: LibraryImageItem) => void;
  cropAvatar: boolean;
  filteredProjectImages: LibraryImageItem[];
  includeProjectImages: boolean;
  isDeleting: boolean;
  isLoading: boolean;
  mode: "single" | "multiple";
  normalizedSearch: string;
  openUploadFolderKeysByGroup: Record<string, string[]>;
  openProjectFolderKeysByGroup: Record<string, string[]>;
  openProjectGroupKeys: string[];
  openUploadGroupKeys: string[];
  projectImageGroups: ProjectImageGroup[];
  projectImagesView: "flat" | "by-project";
  selectedResolvedUrlSet: Set<string>;
  selectedUrlsCount: number;
  setOpenUploadFolderKeysByGroup: Dispatch<SetStateAction<Record<string, string[]>>>;
  setOpenProjectFolderKeysByGroup: Dispatch<SetStateAction<Record<string, string[]>>>;
  setOpenProjectGroupKeys: (value: string[]) => void;
  setOpenUploadGroupKeys: (value: string[]) => void;
  setProjectCardRef: (url: string, node: HTMLButtonElement | null) => void;
  setSelection: (url: string, options?: { openCrop?: boolean }) => void;
  setSortMode: (value: "recent" | "oldest" | "name") => void;
  setUploadCardRef: (url: string, node: HTMLButtonElement | null) => void;
  setUploadsFolderFilter: (value: string) => void;
  shouldRenderUploadsFolderFilter: boolean;
  shouldShowAllFoldersFilterOption: boolean;
  sortMode: "recent" | "oldest" | "name";
  uploadFolderFilterOptionLabels: Record<string, string>;
  uploadFolderFilterOptions: string[];
  uploadFolderGroups: UploadFolderGroup[];
  uploadsFolderFilter: string;
  uploadsLoadError: string;
  onRequestDelete: (item: LibraryImageItem) => void;
  onRequestRename: (item: LibraryImageItem) => void;
};

const ImageLibraryBrowserPane = ({
  allowUploadManagementActions,
  beginAltTextEdit,
  beginFocalPointEdit,
  cropAvatar,
  filteredProjectImages,
  includeProjectImages,
  isDeleting,
  isLoading,
  mode,
  normalizedSearch,
  openUploadFolderKeysByGroup,
  openProjectFolderKeysByGroup,
  openProjectGroupKeys,
  openUploadGroupKeys,
  projectImageGroups,
  projectImagesView,
  selectedResolvedUrlSet,
  selectedUrlsCount,
  setOpenUploadFolderKeysByGroup,
  setOpenProjectFolderKeysByGroup,
  setOpenProjectGroupKeys,
  setOpenUploadGroupKeys,
  setProjectCardRef,
  setSelection,
  setSortMode,
  setUploadCardRef,
  setUploadsFolderFilter,
  shouldRenderUploadsFolderFilter,
  shouldShowAllFoldersFilterOption,
  sortMode,
  uploadFolderFilterOptionLabels,
  uploadFolderFilterOptions,
  uploadFolderGroups,
  uploadsFolderFilter,
  uploadsLoadError,
  onRequestDelete,
  onRequestRename,
}: ImageLibraryBrowserPaneProps) => (
  <div
    className="mt-3 min-h-0 min-w-0 flex-1 space-y-6 overflow-auto no-scrollbar touch-scroll-y sm:mt-4 sm:space-y-8"
    data-remove-scroll-ignore=""
  >
    <ImageLibraryUploadSection
      allowUploadManagementActions={allowUploadManagementActions}
      beginAltTextEdit={beginAltTextEdit}
      beginFocalPointEdit={beginFocalPointEdit}
      cropAvatar={cropAvatar}
      isDeleting={isDeleting}
      isLoading={isLoading}
      mode={mode}
      normalizedSearch={normalizedSearch}
      openUploadFolderKeysByGroup={openUploadFolderKeysByGroup}
      openUploadGroupKeys={openUploadGroupKeys}
      onRequestDelete={onRequestDelete}
      onRequestRename={onRequestRename}
      selectedResolvedUrlSet={selectedResolvedUrlSet}
      selectedUrlsCount={selectedUrlsCount}
      setOpenUploadFolderKeysByGroup={setOpenUploadFolderKeysByGroup}
      setOpenUploadGroupKeys={setOpenUploadGroupKeys}
      setSelection={setSelection}
      setSortMode={setSortMode}
      setUploadCardRef={setUploadCardRef}
      setUploadsFolderFilter={setUploadsFolderFilter}
      shouldRenderUploadsFolderFilter={shouldRenderUploadsFolderFilter}
      shouldShowAllFoldersFilterOption={shouldShowAllFoldersFilterOption}
      sortMode={sortMode}
      uploadFolderFilterOptionLabels={uploadFolderFilterOptionLabels}
      uploadFolderFilterOptions={uploadFolderFilterOptions}
      uploadFolderGroups={uploadFolderGroups}
      uploadsFolderFilter={uploadsFolderFilter}
      uploadsLoadError={uploadsLoadError}
    />
    {includeProjectImages ? (
      <ImageLibraryProjectSection
        allowUploadManagementActions={allowUploadManagementActions}
        beginAltTextEdit={beginAltTextEdit}
        beginFocalPointEdit={beginFocalPointEdit}
        cropAvatar={cropAvatar}
        filteredProjectImages={filteredProjectImages}
        isDeleting={isDeleting}
        isLoading={isLoading}
        mode={mode}
        normalizedSearch={normalizedSearch}
        onRequestDelete={onRequestDelete}
        onRequestRename={onRequestRename}
        openProjectFolderKeysByGroup={openProjectFolderKeysByGroup}
        openProjectGroupKeys={openProjectGroupKeys}
        projectImageGroups={projectImageGroups}
        projectImagesView={projectImagesView}
        selectedResolvedUrlSet={selectedResolvedUrlSet}
        setOpenProjectFolderKeysByGroup={setOpenProjectFolderKeysByGroup}
        setOpenProjectGroupKeys={setOpenProjectGroupKeys}
        setProjectCardRef={setProjectCardRef}
        setSelection={setSelection}
        sortMode={sortMode}
      />
    ) : null}
  </div>
);

export default ImageLibraryBrowserPane;
