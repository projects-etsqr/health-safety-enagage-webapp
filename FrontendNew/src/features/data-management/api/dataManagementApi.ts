/**
 * Data Management API hooks — custom useQuery/useMutation wrappers
 * (no Redux / RTK Query required).
 */
import { useState, useEffect, useCallback } from "react";
import axiosInstance from "@/api/axiosInstance";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ImportRecord {
  id: number;
  file_name: string;
  import_type: string;
  data_type: string;
  records_total: number;
  records_success: number;
  records_failed: number;
  status: string;
  uploaded_by: string;
  created_at: string;
}

export interface ValidationLogRecord {
  id: number;
  file_name: string;
  rule: string;
  status: "pass" | "warning" | "fail";
  records_affected: number;
  message: string | null;
  timestamp: string;
}

export interface ApiIntegrationRecord {
  id: number;
  name: string;
  type: string;
  endpoint_url?: string;
  auth_type?: string;
  is_active: boolean;
  sync_frequency?: string;
  description?: string;
  last_sync?: string;
  created_at?: string;
}

export interface SheetImportResult {
  sheet: string;
  agent: string;
  processed: number;
  failed: number;
  errors: string[];
}

export interface FullImportResult {
  total_processed: number;
  total_failed: number;
  per_sheet: SheetImportResult[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function unwrap<T>(res: { data: unknown }): T {
  const payload = (res.data as { data?: T } | T);
  return (payload as { data?: T }).data !== undefined
    ? (payload as { data: T }).data
    : (payload as T);
}

function unwrapList<T>(res: { data: unknown }): T[] {
  const payload = res.data as { data?: T[] | { items?: T[] } } | T[];
  if (Array.isArray(payload)) return payload;
  const inner = (payload as { data?: T[] | { items?: T[] } }).data;
  if (!inner) return [];
  if (Array.isArray(inner)) return inner;
  return (inner as { items?: T[] }).items ?? [];
}

// ── useListImportsQuery ────────────────────────────────────────────────────────

export function useListImportsQuery() {
  const [data, setData] = useState<ImportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/org-admin/data-management/imports");
      setData(unwrapList<ImportRecord>(res));
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  return { data, isLoading, refetch };
}

// ── useCreateImportMutation ────────────────────────────────────────────────────

export function useCreateImportMutation(): [
  (payload: {
    file_name: string;
    import_type: string;
    data_type: string;
    records_estimated?: number;
    status?: string;
  }) => Promise<{ unwrap: () => ImportRecord }>,
  { isLoading: boolean }
] {
  const [isLoading, setIsLoading] = useState(false);

  const mutate = async (payload: {
    file_name: string;
    import_type: string;
    data_type: string;
    records_estimated?: number;
    status?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.post("/org-admin/data-management/imports", { data: payload });
      const record = unwrap<ImportRecord>(res);
      return { unwrap: () => record };
    } finally {
      setIsLoading(false);
    }
  };

  return [mutate, { isLoading }];
}

// ── useListValidationLogsQuery ─────────────────────────────────────────────────

export function useListValidationLogsQuery() {
  const [data, setData] = useState<ValidationLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/org-admin/data-management/validation-logs");
      setData(unwrapList<ValidationLogRecord>(res));
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  return { data, isLoading, refetch };
}

// ── useListApiIntegrationsQuery ────────────────────────────────────────────────

export function useListApiIntegrationsQuery() {
  const [data, setData] = useState<ApiIntegrationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/org-admin/data-management/integrations");
      setData(unwrapList<ApiIntegrationRecord>(res));
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  return { data, isLoading, refetch };
}

// ── useCreateApiIntegrationMutation ───────────────────────────────────────────

export function useCreateApiIntegrationMutation(): [
  (payload: {
    name: string;
    type: string;
    endpoint_url?: string;
    auth_type?: string;
    is_active?: boolean;
    sync_frequency?: string;
    description?: string;
  }) => Promise<{ unwrap: () => ApiIntegrationRecord }>,
  { isLoading: boolean }
] {
  const [isLoading, setIsLoading] = useState(false);

  const mutate = async (payload: {
    name: string;
    type: string;
    endpoint_url?: string;
    auth_type?: string;
    is_active?: boolean;
    sync_frequency?: string;
    description?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.post("/org-admin/data-management/integrations", { data: payload });
      const record = unwrap<ApiIntegrationRecord>(res);
      return { unwrap: () => record };
    } finally {
      setIsLoading(false);
    }
  };

  return [mutate, { isLoading }];
}

// ── useDeleteApiIntegrationMutation ───────────────────────────────────────────

export function useDeleteApiIntegrationMutation(): [
  (id: number) => Promise<void>,
  { isLoading: boolean }
] {
  const [isLoading, setIsLoading] = useState(false);

  const mutate = async (id: number) => {
    setIsLoading(true);
    try {
      await axiosInstance.delete(`/org-admin/data-management/integrations/${id}`);
    } finally {
      setIsLoading(false);
    }
  };

  return [mutate, { isLoading }];
}

// ── useFullImportMutation ──────────────────────────────────────────────────────

export function useFullImportMutation(): [
  (formData: FormData) => Promise<{ unwrap: () => FullImportResult }>,
  { isLoading: boolean }
] {
  const [isLoading, setIsLoading] = useState(false);

  const mutate = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.post(
        "/org-admin/data-management/full-import",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const result = (res.data as { data?: FullImportResult } | FullImportResult);
      const data: FullImportResult =
        (result as { data?: FullImportResult }).data !== undefined
          ? (result as { data: FullImportResult }).data
          : (result as FullImportResult);
      return { unwrap: () => data };
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })
          ?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        "Import failed";
      throw { data: { detail: msg }, message: msg };
    } finally {
      setIsLoading(false);
    }
  };

  return [mutate, { isLoading }];
}

// ── downloadFullTemplate ───────────────────────────────────────────────────────

export async function downloadFullTemplate(): Promise<void> {
  const API_BASE = ((import.meta.env.VITE_API_URL as string) || "/api/v1").replace(/\/$/, "");
  const jwt = localStorage.getItem("hse_jwt_token");
  const headers: Record<string, string> = {};
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

  const res = await fetch(`${API_BASE}/org-admin/data-management/full-template`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: "HSE_Full_Import_Template.xlsx",
  });
  a.click();
  URL.revokeObjectURL(url);
}
