import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef } from "react";

import {
  areSelectionsSemanticallyEqual,
  buildSelectionSeed,
  toComparableSelectionKey,
  toSelectionSignature,
} from "@/components/image-library/selection";
import type { LibraryImageItem } from "@/components/image-library/types";

type UseImageLibrarySelectionLifecycleParams = {
  allItems: Map<string, LibraryImageItem>;
  allItemsByComparableKey: Map<string, LibraryImageItem>;
  currentSelectionUrl?: string;
  currentSelectionUrls?: string[];
  isLibraryHydratedForOpen: boolean;
  mode: "single" | "multiple";
  open: boolean;
  setIsCropDialogOpen: Dispatch<SetStateAction<boolean>>;
  setIsDragActive: Dispatch<SetStateAction<boolean>>;
  setSelectedUrls: Dispatch<SetStateAction<string[]>>;
};

export const useImageLibrarySelectionLifecycle = ({
  allItems,
  allItemsByComparableKey,
  currentSelectionUrl,
  currentSelectionUrls,
  isLibraryHydratedForOpen,
  mode,
  open,
  setIsCropDialogOpen,
  setIsDragActive,
  setSelectedUrls,
}: UseImageLibrarySelectionLifecycleParams) => {
  const selectionSeedRef = useRef<string[]>([]);

  const selectionSeed = useMemo(
    () =>
      buildSelectionSeed({
        currentSelectionUrls,
        currentSelectionUrl,
        mode,
      }),
    [currentSelectionUrl, currentSelectionUrls, mode],
  );

  const selectionSeedSignature = useMemo(
    () => toSelectionSignature(selectionSeed),
    [selectionSeed],
  );

  useEffect(() => {
    selectionSeedRef.current = selectionSeed;
  }, [selectionSeed, selectionSeedSignature]);

  const reconcileSelectionWithLibrary = useCallback(
    (urls: string[]) => {
      const reconciled: string[] = [];
      const seen = new Set<string>();
      urls.forEach((url) => {
        const trimmed = String(url || "").trim();
        if (!trimmed) {
          return;
        }
        const matched =
          allItems.get(trimmed) ?? allItemsByComparableKey.get(toComparableSelectionKey(trimmed));
        if (!matched) {
          return;
        }
        const matchedKey = toComparableSelectionKey(matched.url);
        if (seen.has(matchedKey)) {
          return;
        }
        seen.add(matchedKey);
        reconciled.push(matched.url);
      });
      if (mode === "multiple") {
        return reconciled;
      }
      return reconciled.length > 0 ? [reconciled[0]] : [];
    },
    [allItems, allItemsByComparableKey, mode],
  );

  useEffect(() => {
    if (!open) {
      setIsDragActive(false);
      return;
    }
    setSelectedUrls([...selectionSeedRef.current]);
    setIsCropDialogOpen(false);
  }, [open, selectionSeedSignature, setIsCropDialogOpen, setIsDragActive, setSelectedUrls]);

  useEffect(() => {
    if (!open || !isLibraryHydratedForOpen) {
      return;
    }
    setSelectedUrls((prev) => {
      const reconciled = reconcileSelectionWithLibrary(prev);
      return areSelectionsSemanticallyEqual(prev, reconciled) ? prev : reconciled;
    });
  }, [isLibraryHydratedForOpen, open, reconcileSelectionWithLibrary, setSelectedUrls]);
};

export default useImageLibrarySelectionLifecycle;
