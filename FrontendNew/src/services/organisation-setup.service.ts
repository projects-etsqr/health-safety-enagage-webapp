import axiosInstance from '../api/axiosInstance';

export interface SetupCheckResponse {
  needs_setup: boolean;
  organisation_name?: string;
  admin_name?: string;
  invite_id?: number;
}

export interface SheetEvent {
  type: 'start' | 'processing' | 'done' | 'error' | 'complete' | 'fatal';
  index?: number;
  key?: string;
  label?: string;
  count?: number;
  error?: string;
  total?: number;
  results?: Record<string, number>;
  errors?: Record<string, string>;
  total_rows?: number;
  has_errors?: boolean;
}

export const checkOrgSetupRequired = (email: string) =>
  axiosInstance
    .get<SetupCheckResponse>('/organisation/setup/check', { params: { email } })
    .then((r) => r.data)
    .catch(() => ({ needs_setup: false } as SetupCheckResponse));

/**
 * Upload an Excel file and consume the SSE stream.
 * Calls onEvent for every parsed event, calls onComplete when done.
 */
export async function uploadExcelStream(
  email: string,
  file: File,
  onEvent: (event: SheetEvent) => void,
): Promise<void> {
  const token = localStorage.getItem('hse_jwt_token') ?? '';
  const baseUrl = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

  const form = new FormData();
  form.append('file', file);

  const response = await fetch(
    `${baseUrl}/organisation/setup/upload-stream?email=${encodeURIComponent(email)}`,
    {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const json = await response.json();
      detail = json.detail || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Streaming not supported by browser');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE lines: "data: {...}\n\n"
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith('data: ')) {
        try {
          const evt: SheetEvent = JSON.parse(line.slice(6));
          onEvent(evt);
        } catch {
          // malformed event — skip
        }
      }
    }
  }
}
