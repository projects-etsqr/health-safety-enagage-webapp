import { useState, useEffect, useCallback } from "react";
import axiosInstance from "@/api/axiosInstance";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Tenant {
  id: number;
  name: string;
  status: "active" | "pending" | "suspended" | "inactive";
  org_code: string;
  plan: string;
  admin_name: string;
  admin_email: string;
  created_at: string;
}

export interface TenantListResponse {
  total: number;
  items: Tenant[];
}

export interface OrganisationInvite {
  id: number;
  organisation_name: string;
  admin_name: string;
  admin_email: string;
  status: "pending" | "accepted" | "expired";
  created_at: string;
  updated_at: string;
}

export interface InviteOrganisationPayload {
  organisation_name: string;
  admin_name: string;
  admin_email: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type QueryResult<T> = { data: T | undefined; isLoading: boolean; refetch: () => Promise<void> };
type MutationResult<T> = { data: T } | { error: unknown };
type MutationTuple<TArg, TResult> = [
  (arg: TArg) => Promise<MutationResult<TResult>>,
  { isLoading: boolean },
];

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
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => { void refetch(); }, [refetch]);
  return { data, isLoading, refetch };
}

function useMutation<TArg, TResult = void>(
  apiFn: (arg: TArg) => Promise<TResult>,
): MutationTuple<TArg, TResult> {
  const [isLoading, setIsLoading] = useState(false);
  const mutate = useCallback(async (arg: TArg): Promise<MutationResult<TResult>> => {
    setIsLoading(true);
    try {
      const result = await apiFn(arg);
      return { data: result };
    } catch (error) {
      return { error };
    } finally {
      setIsLoading(false);
    }
  }, [apiFn]);
  return [mutate, { isLoading }];
}

function toArray<T>(raw: unknown): T[] {
  const env = raw as { items?: T[] } | null;
  return Array.isArray(raw) ? (raw as T[]) : (env?.items ?? []);
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useListTenantsQuery() {
  return useQuery<Tenant[]>("/superadmin/tenants", toArray<Tenant>);
}

export function useListInvitesQuery(skip = 0, limit = 100) {
  return useQuery<{ total: number; items: OrganisationInvite[] }>(
    `/superadmin/invites?skip=${skip}&limit=${limit}`,
  );
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useInviteOrganisationMutation(): MutationTuple<
  InviteOrganisationPayload,
  OrganisationInvite
> {
  return useMutation(async (payload) => {
    const res = await axiosInstance.post<OrganisationInvite>(
      "/superadmin/invite-organisation",
      payload,
    );
    return res.data;
  });
}

export function useUpdateInviteStatusMutation(): MutationTuple<
  { inviteId: number; status: "pending" | "accepted" | "expired" },
  OrganisationInvite
> {
  return useMutation(async ({ inviteId, status }) => {
    const res = await axiosInstance.patch<OrganisationInvite>(
      `/superadmin/invites/${inviteId}/status`,
      null,
      { params: { new_status: status } },
    );
    return res.data;
  });
}

export function useResendInviteMutation(): MutationTuple<number, OrganisationInvite> {
  return useMutation(async (inviteId) => {
    const res = await axiosInstance.post<OrganisationInvite>(
      `/superadmin/invites/${inviteId}/resend`,
    );
    return res.data;
  });
}

export function useDeleteInviteMutation(): MutationTuple<number, void> {
  return useMutation(async (inviteId) => {
    await axiosInstance.delete(`/superadmin/invites/${inviteId}`);
  });
}

// ── Platform Users ────────────────────────────────────────────────────────────

export interface PlatformUser {
  id: number;
  username: string;
  email: string;
  role_name: string;
  role_label: string;
  role_level: number;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface AppRole {
  id: number;
  name: string;
  label: string;
  description?: string;
  level: number;
  user_count?: number;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  role_name: string;
}

export function useListPlatformUsersQuery() {
  return useQuery<{ total: number; items: PlatformUser[] }>("/superadmin/users");
}

export function useListRolesQuery() {
  return useQuery<AppRole[]>("/superadmin/roles", (raw) => Array.isArray(raw) ? raw as AppRole[] : []);
}

export function useToggleUserStatusMutation(): MutationTuple<
  { userId: number; is_active: boolean },
  PlatformUser
> {
  return useMutation(async ({ userId, is_active }) => {
    const res = await axiosInstance.patch<PlatformUser>(
      `/superadmin/users/${userId}/status`,
      null,
      { params: { is_active } },
    );
    return res.data;
  });
}

export function useChangeUserRoleMutation(): MutationTuple<
  { userId: number; role_name: string },
  PlatformUser
> {
  return useMutation(async ({ userId, role_name }) => {
    const res = await axiosInstance.patch<PlatformUser>(
      `/superadmin/users/${userId}/role`,
      null,
      { params: { role_name } },
    );
    return res.data;
  });
}

export function useDeletePlatformUserMutation(): MutationTuple<number, void> {
  return useMutation(async (userId) => {
    await axiosInstance.delete(`/superadmin/users/${userId}`);
  });
}

export function useCreatePlatformUserMutation(): MutationTuple<CreateUserPayload, PlatformUser> {
  return useMutation(async (payload) => {
    const res = await axiosInstance.post<PlatformUser>("/superadmin/users", payload);
    return res.data;
  });
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export interface Subscription {
  id: number;
  invite_id: number | null;
  org_name: string;
  admin_email: string;
  plan_name: "trial" | "standard" | "premium" | "enterprise";
  plan_label: string;
  status: "trial" | "active" | "cancelled" | "expired";
  billing_cycle: "monthly" | "annual";
  amount: number;
  seats: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionListResponse {
  total: number;
  items: Subscription[];
  mrr: number;
  arr: number;
}

export interface CreateSubscriptionPayload {
  invite_id?: number | null;
  plan_name: string;
  billing_cycle: string;
  amount?: number;
  seats?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

export function useListSubscriptionsQuery() {
  return useQuery<SubscriptionListResponse>("/superadmin/subscriptions");
}

export function useCreateSubscriptionMutation(): MutationTuple<CreateSubscriptionPayload, Subscription> {
  return useMutation(async (payload) => {
    const res = await axiosInstance.post<Subscription>("/superadmin/subscriptions", payload);
    return res.data;
  });
}

export function useUpdateSubscriptionMutation(): MutationTuple<
  { subId: number } & Partial<CreateSubscriptionPayload> & { status?: string },
  Subscription
> {
  return useMutation(async ({ subId, ...rest }) => {
    const res = await axiosInstance.patch<Subscription>(`/superadmin/subscriptions/${subId}`, rest);
    return res.data;
  });
}

export function useDeleteSubscriptionMutation(): MutationTuple<number, void> {
  return useMutation(async (subId) => {
    await axiosInstance.delete(`/superadmin/subscriptions/${subId}`);
  });
}

// ── Platform Analytics ────────────────────────────────────────────────────────

export interface PlatformAnalytics {
  overview: {
    total_users: number; active_users: number;
    total_tenants: number; active_tenants: number; pending_tenants: number;
    total_subs: number; active_subs: number;
    mrr: number; arr: number;
  };
  role_distribution:  { role: string; count: number }[];
  plan_distribution:  { plan: string; count: number; revenue: number }[];
  tenant_status:      { status: string; count: number }[];
  tenant_growth:      { month: string; tenants: number }[];
  user_growth:        { month: string; users: number }[];
  recent_tenants:     { id: number; name: string; status: string; created_at: string }[];
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface PlatformNotification {
  id: number;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "maintenance" | "announcement";
  target_type: "all" | "specific";
  target_invite_id: number | null;
  target_org_name: string | null;
  status: "draft" | "sent" | "failed";
  email_sent_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationListResponse {
  total: number;
  stats: { total: number; sent: number; draft: number; failed: number };
  items: PlatformNotification[];
}

export interface CreateNotificationPayload {
  title: string;
  message: string;
  type: string;
  target_type: string;
  target_invite_id?: number | null;
}

export function useListNotificationsQuery() {
  return useQuery<NotificationListResponse>("/superadmin/notifications");
}

export function useCreateNotificationMutation(): MutationTuple<CreateNotificationPayload, PlatformNotification> {
  return useMutation(async (payload) => {
    const res = await axiosInstance.post<PlatformNotification>("/superadmin/notifications", payload);
    return res.data;
  });
}

export function useSendNotificationMutation(): MutationTuple<number, PlatformNotification> {
  return useMutation(async (notifId) => {
    const res = await axiosInstance.post<PlatformNotification>(`/superadmin/notifications/${notifId}/send`);
    return res.data;
  });
}

export function useDeleteNotificationMutation(): MutationTuple<number, void> {
  return useMutation(async (notifId) => {
    await axiosInstance.delete(`/superadmin/notifications/${notifId}`);
  });
}

export function usePlatformAnalyticsQuery() {
  return useQuery<PlatformAnalytics>("/superadmin/analytics");
}

export function useUpdateRoleMutation(): MutationTuple<
  { roleId: number; label: string; description: string },
  AppRole
> {
  return useMutation(async ({ roleId, label, description }) => {
    const res = await axiosInstance.patch<AppRole>(`/superadmin/roles/${roleId}`, { label, description });
    return res.data;
  });
}

// ── Tenant mutations (tenant id == invite id) ─────────────────────────────────

export function useUpdateTenantStatusMutation(): MutationTuple<
  { tenantId: number; status: "active" | "pending" | "suspended" },
  Tenant
> {
  return useMutation(async ({ tenantId, status }) => {
    const inviteStatus = status === "active" ? "accepted" : status === "suspended" ? "expired" : "pending";
    const res = await axiosInstance.patch<Tenant>(
      `/superadmin/invites/${tenantId}/status`,
      null,
      { params: { new_status: inviteStatus } },
    );
    return res.data;
  });
}

export function useDeleteTenantMutation(): MutationTuple<number, void> {
  return useMutation(async (tenantId) => {
    await axiosInstance.delete(`/superadmin/invites/${tenantId}`);
  });
}
