/**
 * Org Setup Wizard API hooks.
 * Provides RTK-Query-compatible hook signatures using axios + useState/useEffect
 * so the OrgSetupWizardPage can call them without Redux / RTK Query.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import axiosInstance from "@/api/axiosInstance";

// ── Envelope helper (matches backend expectation) ─────────────────────────────
const cmd = (body: unknown) => ({ data: body });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrgSetupProgress {
  steps_completed: number[];
  steps_total: number;
  percent: number;
  activated: boolean;
}

export interface Step1Data {
  organisationId: string;
  organisationName: string;
  country: string;
  industrySector: string;
  numberOfEmployees: string | number;
  headquartersLocation: string;
  parentCompany: string;
  iso45001Status: string;
  regulatoryAuthority: string;
  establishmentDate: string;
  dataEntryOption: "manual" | "excel" | "api";
}

export interface Step2Data {
  applicableStandards: string[];
  regulatoryRegion: string;
  incidentSeverityMatrix: { level: string; description: string }[];
  auditFrequency: string;
  capaSlaCriticalDays: number;
  capaSlaStandardDays: number;
  permitTypes: string[];
}

export interface Site {
  id: string;
  name: string;
  type: string;
  address: string;
  postcode?: string;
  city?: string;
  region?: string;
  operationalStatus?: string;
  workingStations?: number | string;
  capacity?: number | string;
  primaryProducts?: string;
  hazardClassification?: string;
}

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status?: string;
}

export interface Step5Data {
  workflows: { name: string; enabled: boolean; config: string }[];
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  size: string;
}

export interface DataImport {
  id: string;
  dataType: string;
  method: string;
  importedAt: string;
  records: number;
}

export interface Step7Data {
  aiFeatures: { name: string; enabled: boolean }[];
}

export interface ActivateOrgData {
  confirmed: boolean;
}

export interface HrmsImportPayload {
  url: string;
  token?: string;
}

export interface OrgApiConnectPayload {
  url: string;
  api_key?: string;
  token?: string;
}

export interface OrgDetailsFromExternal {
  organisationId?: string;
  organisationName?: string;
  country?: string;
  industrySector?: string;
  numberOfEmployees?: string;
  headquartersLocation?: string;
  parentCompany?: string;
  iso45001Status?: string;
  regulatoryAuthority?: string;
  establishmentDate?: string;
  _error?: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

type QueryResult<T> = { data: T | undefined; isLoading: boolean; refetch: () => Promise<void> };
type MutationResult<T> = { data: T } | { error: unknown };
type MutationTuple<TArg, TResult> = [(arg: TArg) => Promise<MutationResult<TResult>>, { isLoading: boolean }];

function useQuery<T>(url: string, transform?: (raw: unknown) => T): QueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(url);
      const raw = res.data;
      setData(transform ? transform(raw) : (raw as T));
    } catch {
      // silent — component handles empty state
    } finally {
      setIsLoading(false);
    }
  }, [url]); // url is static per hook, safe

  useEffect(() => { void refetch(); }, [refetch]);

  return { data, isLoading, refetch };
}

function useMutation<TArg, TResult = void>(
  apiFn: (arg: TArg) => Promise<TResult>,
): MutationTuple<TArg, TResult> {
  const [isLoading, setIsLoading] = useState(false);
  const fnRef = useRef(apiFn);
  fnRef.current = apiFn;

  const mutate = useCallback(async (arg: TArg): Promise<MutationResult<TResult>> => {
    setIsLoading(true);
    try {
      const result = await fnRef.current(arg);
      return { data: result };
    } catch (error) {
      return { error };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return [mutate, { isLoading }];
}

function toArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const envelope = raw as { items?: T[] } | null;
  return envelope?.items ?? [];
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useGetOrgSetupProgressQuery() {
  return useQuery<OrgSetupProgress>("/org-setup/progress");
}

export function useGetOrgSetupStep1Query() {
  return useQuery<Partial<Step1Data>>("/org-setup/step1");
}

export function useGetOrgSetupStep2Query() {
  return useQuery<Partial<Step2Data>>("/org-setup/step2");
}

export function useGetOrgSetupStep3SitesQuery() {
  return useQuery<Site[]>("/org-setup/step3/sites", toArray<Site>);
}

export function useGetOrgSetupStep4UsersQuery() {
  return useQuery<OrgUser[]>("/org-setup/step4/users", toArray<OrgUser>);
}

export function useGetOrgSetupStep5Query() {
  return useQuery<Partial<Step5Data>>("/org-setup/step5");
}

export function useGetOrgSetupStep6DocumentsQuery() {
  return useQuery<KnowledgeDocument[]>("/org-setup/step6/documents", toArray<KnowledgeDocument>);
}

export function useGetOrgSetupStep6aImportsQuery() {
  return useQuery<DataImport[]>("/org-setup/step6a/imports", toArray<DataImport>);
}

export function useGetOrgSetupStep7Query() {
  return useQuery<Partial<Step7Data>>("/org-setup/step7");
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useSaveOrgSetupStep1Mutation(): MutationTuple<Partial<Step1Data>, void> {
  return useMutation(async (data) => {
    await axiosInstance.post("/org-setup/step1", cmd(data));
  });
}

export function useSaveOrgSetupStep2Mutation(): MutationTuple<Partial<Step2Data>, void> {
  return useMutation(async (data) => {
    await axiosInstance.post("/org-setup/step2", cmd(data));
  });
}

export function useCreateOrgSetupSiteMutation(): MutationTuple<Omit<Site, "id">, Site> {
  return useMutation(async (data) => {
    const res = await axiosInstance.post("/org-setup/step3/site", cmd(data));
    return res.data as Site;
  });
}

export function useBulkUploadOrgSetupSitesMutation(): MutationTuple<FormData, { count?: number; error?: string }> {
  return useMutation(async (formData) => {
    const res = await axiosInstance.post("/org-setup/step3/bulk", formData);
    return res.data as { count?: number; error?: string };
  });
}

export function useCreateOrgSetupUserMutation(): MutationTuple<Omit<OrgUser, "id">, OrgUser> {
  return useMutation(async (data) => {
    const res = await axiosInstance.post("/org-setup/step4/user", cmd(data));
    return res.data as OrgUser;
  });
}

export function useBulkUploadOrgSetupUsersMutation(): MutationTuple<FormData, { count?: number; error?: string; users?: OrgUser[] }> {
  return useMutation(async (formData) => {
    const res = await axiosInstance.post("/org-setup/step4/bulk", formData);
    return res.data as { count?: number; error?: string; users?: OrgUser[] };
  });
}

export function useSaveOrgSetupStep5Mutation(): MutationTuple<Partial<Step5Data>, void> {
  return useMutation(async (data) => {
    await axiosInstance.post("/org-setup/step5", cmd(data));
  });
}

export function useUploadOrgSetupKnowledgeMutation(): MutationTuple<FormData, KnowledgeDocument> {
  return useMutation(async (formData) => {
    const res = await axiosInstance.post("/org-setup/step6/upload", formData);
    return res.data as KnowledgeDocument;
  });
}

export function useImportOrgSetupDataMutation(): MutationTuple<Record<string, unknown>, DataImport> {
  return useMutation(async (data) => {
    const res = await axiosInstance.post("/org-setup/step6a/import", cmd(data));
    return res.data as DataImport;
  });
}

export function useBulkImportModuleMutation(): MutationTuple<{ module: string; file: File }, { count: number; errors?: string[] }> {
  return useMutation(async ({ module, file }) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await axiosInstance.post(
      `/org-setup/onboarding-bulk?module=${encodeURIComponent(module)}`,
      fd,
    );
    return res.data as { count: number; errors?: string[] };
  });
}

export function useSaveOrgSetupStep7Mutation(): MutationTuple<Partial<Step7Data>, void> {
  return useMutation(async (data) => {
    await axiosInstance.post("/org-setup/step7", cmd(data));
  });
}

export function useActivateOrganizationMutation(): MutationTuple<ActivateOrgData, { success: boolean }> {
  return useMutation(async (data) => {
    const res = await axiosInstance.post("/org-setup/activate", cmd(data));
    return res.data as { success: boolean };
  });
}

export function useHrmsImportMutation(): MutationTuple<HrmsImportPayload, { count: number; error?: string }> {
  return useMutation(async (data) => {
    const res = await axiosInstance.post("/org-setup/step4/hrms-import", data);
    return res.data as { count: number; error?: string };
  });
}

export function useParseOrgExcelMutation(): MutationTuple<FormData, OrgDetailsFromExternal> {
  return useMutation(async (formData) => {
    const res = await axiosInstance.post("/org-setup/step1/parse-excel", formData);
    return res.data as OrgDetailsFromExternal;
  });
}

export function useConnectOrgApiMutation(): MutationTuple<OrgApiConnectPayload, OrgDetailsFromExternal> {
  return useMutation(async (data) => {
    const res = await axiosInstance.post("/org-setup/step1/api-connect", data);
    return res.data as OrgDetailsFromExternal;
  });
}

export async function resetOrgSetupWizard(): Promise<void> {
  await axiosInstance.post("/org-setup/reset", {});
}
