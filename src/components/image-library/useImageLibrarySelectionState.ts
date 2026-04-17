import { type Dispatch, type SetStateAction, useCallback, useMemo, useRef, useState } from "react";

import { toComparableSelectionKey } from "@/components/image-library/selection";
import type { LibraryImageItem } from "@/components/image-library/types";
import {
  toLibraryItemRenderUrl,
  toLibraryItemRenderVersion,
} from "@/components/image-library/utils";

type PendingRevealRequest = {
  url: string;
  token: number;
  openCrop: boolean;
};

type UseImageLibrarySelectionStateParams = {
  projectImages: LibraryImageItem[];
  selectedUrls: string[];
  uploads: LibraryImageItem[];
};

type UseImageLibrarySelectionStateResult = {
  allItems: Map<string, LibraryImageItem>;
  allItemsByComparableKey: Map<string, LibraryImageItem>;
  pendingRevealRequest: PendingRevealRequest | null;
  primarySelectedRenderKey: string;
  primarySelectedRenderUrl: string;
  primarySelectedUrl: string;
  requestRevealUpload: (url: string, options?: { openCrop?: boolean }) => void;
  selectedResolvedUrlSet: Set<string>;
  setPendingRevealRequest: Dispatch<SetStateAction<PendingRevealRequest | null>>;
};

export const useImageLibrarySelectionState = ({
  projectImages,
  selectedUrls,
  uploads,
}: UseImageLibrarySelectionStateParams): UseImageLibrarySelectionStateResult => {
  const [pendingRevealRequest, setPendingRevealRequest] = useState<PendingRevealRequest | null>(
    null,
  );
  const revealRequestTokenRef = useRef(0);

  const allItems = useMemo(() => {
    const map = new Map<string, LibraryImageItem>();
    uploads.forEach((item) => {
      map.set(item.url, item);
    });
    projectImages.forEach((item) => {
      if (!map.has(item.url)) {
        map.set(item.url, item);
      }
    });
    return map;
  }, [projectImages, uploads]);

  const allItemsByComparableKey = useMemo(() => {
    const map = new Map<string, LibraryImageItem>();
    allItems.forEach((item) => {
      const key = toComparableSelectionKey(item.url);
      if (!map.has(key)) {
        map.set(key, item);
      }
    });
    return map;
  }, [allItems]);

  const selectedResolvedUrlSet = useMemo(() => {
    const set = new Set<string>();
    selectedUrls.forEach((url) => {
      const trimmed = String(url || "").trim();
      if (!trimmed) {
        return;
      }
      const matchedItem =
        allItems.get(trimmed) ?? allItemsByComparableKey.get(toComparableSelectionKey(trimmed));
      if (!matchedItem?.url) {
        return;
      }
      set.add(matchedItem.url);
    });
    return set;
  }, [allItems, allItemsByComparableKey, selectedUrls]);

  const primarySelectedUrl = selectedUrls[0] || "";
  const primarySelectedItem = useMemo(() => {
    const trimmed = String(primarySelectedUrl || "").trim();
    if (!trimmed) {
      return null;
    }
    return (
      allItems.get(trimmed) ??
      allItemsByComparableKey.get(toComparableSelectionKey(trimmed)) ??
      null
    );
  }, [allItems, allItemsByComparableKey, primarySelectedUrl]);

  const primarySelectedRenderUrl = useMemo(() => {
    if (primarySelectedItem) {
      return toLibraryItemRenderUrl(primarySelectedItem);
    }
    return primarySelectedUrl;
  }, [primarySelectedItem, primarySelectedUrl]);

  const primarySelectedRenderKey = useMemo(() => {
    if (primarySelectedItem) {
      return `${primarySelectedItem.url}:${toLibraryItemRenderVersion(primarySelectedItem)}`;
    }
    return primarySelectedRenderUrl;
  }, [primarySelectedItem, primarySelectedRenderUrl]);

  const requestRevealUpload = useCallback((url: string, options?: { openCrop?: boolean }) => {
    const trimmedUrl = String(url || "").trim();
    if (!trimmedUrl) {
      return;
    }
    revealRequestTokenRef.current += 1;
    setPendingRevealRequest({
      url: trimmedUrl,
      token: revealRequestTokenRef.current,
      openCrop: options?.openCrop === true,
    });
  }, []);

  return {
    allItems,
    allItemsByComparableKey,
    pendingRevealRequest,
    primarySelectedRenderKey,
    primarySelectedRenderUrl,
    primarySelectedUrl,
    requestRevealUpload,
    selectedResolvedUrlSet,
    setPendingRevealRequest,
  };
};

export default useImageLibrarySelectionState;
