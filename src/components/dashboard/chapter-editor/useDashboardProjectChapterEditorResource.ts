import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import { apiFetch } from "@/lib/api-client";

import {
  DEFAULT_API_CAPABILITIES,
  normalizeApiContractBuildMetadata,
  normalizeApiContractCapabilities,
} from "@/lib/project-epub";
import type { ApiContractBuildMetadata, ApiContractCapabilities } from "@/types/api-contract";
import type { EpubRouteStatus } from "@/lib/project-epub";
import { extractEpubTempImportIdsFromPayload } from "@/lib/project-epub";

export type DashboardProjectChapterEditorResourceState = {
  backendBuildMetadata: ApiContractBuildMetadata | null;
  backendCapabilities: ApiContractCapabilities | null;
  backendCapabilitiesError: string | null;
  clearPendingEpubImportIds: () => void;
  cleanupPendingEpubImports: () => void;
  epubRouteStatus: EpubRouteStatus;
  pendingEpubImportIdsRef: MutableRefObject<Set<string>>;
  registerPendingEpubImportIds: (payload: unknown) => void;
  setEpubRouteStatus: (nextValue: EpubRouteStatus) => void;
};

export const useDashboardProjectChapterEditorResource = (
  apiBase: string,
): DashboardProjectChapterEditorResourceState => {
  const [backendCapabilities, setBackendCapabilities] =
    useState<ApiContractCapabilities | null>(null);
  const [backendBuildMetadata, setBackendBuildMetadata] =
    useState<ApiContractBuildMetadata | null>(null);
  const [backendCapabilitiesError, setBackendCapabilitiesError] = useState<string | null>(null);
  const [epubRouteStatus, setEpubRouteStatus] = useState<EpubRouteStatus>("unknown");
  const pendingEpubImportIdsRef = useRef<Set<string>>(new Set());

  const clearPendingEpubImportIds = useCallback(() => {
    pendingEpubImportIdsRef.current.clear();
  }, []);

  const registerPendingEpubImportIds = useCallback((payload: unknown) => {
    extractEpubTempImportIdsFromPayload(payload).forEach((importId) => {
      pendingEpubImportIdsRef.current.add(importId);
    });
  }, []);

  const cleanupPendingEpubImports = useCallback(() => {
    const importIds = Array.from(pendingEpubImportIdsRef.current)
      .map((importId) => String(importId || "").trim())
      .filter(Boolean);
    if (!importIds.length) {
      return;
    }
    pendingEpubImportIdsRef.current.clear();
    void apiFetch(apiBase, "/api/projects/epub/import/cleanup", {
      method: "POST",
      auth: true,
      keepalive: true,
      json: { importIds },
    });
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const loadApiContract = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/contracts/v1.json", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`api_contract_${response.status}`);
        }
        const data = await response.json();
        if (!isActive) {
          return;
        }
        setBackendCapabilities(normalizeApiContractCapabilities(data?.capabilities));
        setBackendBuildMetadata(normalizeApiContractBuildMetadata(data?.build));
        setBackendCapabilitiesError(null);
        setEpubRouteStatus("ok");
      } catch {
        if (!isActive) {
          return;
        }
        setBackendCapabilities(DEFAULT_API_CAPABILITIES);
        setBackendBuildMetadata(null);
        setBackendCapabilitiesError("api_contract_unavailable");
        setEpubRouteStatus("unknown");
      }
    };
    void loadApiContract();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  return {
    backendBuildMetadata,
    backendCapabilities,
    backendCapabilitiesError,
    clearPendingEpubImportIds,
    cleanupPendingEpubImports,
    epubRouteStatus,
    pendingEpubImportIdsRef,
    registerPendingEpubImportIds,
    setEpubRouteStatus,
  };
};

export default useDashboardProjectChapterEditorResource;
