/**
 * Layer 1 mobile shell · Offline Queue — "draft & sync".
 *
 * Field work happens where signal does not. A worker who witnesses something at
 * the back of a plant has to be able to file it there and then, or it gets filed
 * late, badly, or not at all — and the spec is explicit that "KPIs are only as
 * good as field capture".
 *
 * This deliberately does NOT make the app a second source of truth. There is
 * one backend and one database and no synchronisation layer: a queued item is a
 * *draft that has not been submitted yet*, not a local copy of a server record.
 * Nothing is ever read back out of this queue as if it were data — it only ever
 * replays a write that has not happened.
 *
 * Photos ride along as local file URIs. The file stays on the device, so the
 * multipart body is rebuilt at flush time rather than base64'd into storage —
 * a handful of site photos would otherwise blow past AsyncStorage's limits.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AxiosInstance } from 'axios';

const QUEUE_KEY = 'hseiq_offline_queue_v1';
const MAX_ATTEMPTS = 5;
const MAX_QUEUE = 200;

export interface QueuedPhoto {
  uri: string;
  name: string;
  type: string;
}

/** Timestamp + random suffix is enough — this id never leaves the device. */
function newRequestId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface QueuedRequest {
  id: string;
  method: 'post' | 'put' | 'patch';
  url: string;
  body: any;
  /** 'json' posts the body as-is. 'multipart' rebuilds FormData with photos. */
  kind: 'json' | 'multipart';
  photos?: QueuedPhoto[];
  /** Which registered axios client to replay through (see registerClient). */
  client: string;
  /** Shown in the "waiting to send" list so a worker knows what is outstanding. */
  label: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

// ── Client registry ───────────────────────────────────────────────────────────
// The worker app and the supervisor/manager shell each have their own axios
// instance with their own token storage, and uploads go through a third with a
// longer timeout. The queue stores a name rather than an instance, because an
// axios object cannot be serialised into AsyncStorage.
const clients: Record<string, AxiosInstance> = {};

export function registerClient(name: string, instance: AxiosInstance): void {
  clients[name] = instance;
}

function resolveClient(name: string): AxiosInstance | null {
  return clients[name] ?? clients.default ?? null;
}

type Listener = (queue: QueuedRequest[]) => void;
const listeners = new Set<Listener>();

function notify(queue: QueuedRequest[]) {
  listeners.forEach(l => {
    try {
      l(queue);
    } catch {
      // A misbehaving subscriber must never break the flush loop.
    }
  });
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function readQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedRequest[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedRequest[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  notify(queue);
}

/** True when the failure looks like "no network" rather than "server said no". */
export function isOfflineError(err: any): boolean {
  if (!err) return false;
  if (err.response) return false; // the server answered — this is a real rejection
  return (
    err.code === 'ERR_NETWORK' ||
    err.code === 'ECONNABORTED' ||
    /network|timeout/i.test(err.message || '')
  );
}

function buildFormData(body: Record<string, any>, photos?: QueuedPhoto[]): FormData {
  const form = new FormData();
  form.append('data', JSON.stringify(body));
  photos?.forEach((photo, i) => {
    // `media_`, not `photo_`: these are photos and videos now. The backend
    // reader accepts both prefixes, so a queued item written by an older
    // build still replays — see app/utils/report_media.py.
    form.append(`media_${i}`, { uri: photo.uri, name: photo.name, type: photo.type } as any);
  });
  return form;
}

export interface EnqueueOptions {
  method?: QueuedRequest['method'];
  kind?: QueuedRequest['kind'];
  photos?: QueuedPhoto[];
  client?: string;
  label: string;
}

export async function enqueue(url: string, body: any, opts: EnqueueOptions, id?: string): Promise<QueuedRequest> {
  const queue = await readQueue();
  const item: QueuedRequest = {
    // Reuse the id from the failed direct attempt when there was one, so a
    // request that fails, gets queued, and is later replayed by flush()
    // carries the same X-Idempotency-Key throughout — never a fresh one per
    // attempt, or the backend's dedup table could never recognise the retry.
    id: id ?? newRequestId(),
    method: opts.method ?? 'post',
    url,
    body,
    kind: opts.kind ?? 'json',
    photos: opts.photos,
    client: opts.client ?? 'default',
    label: opts.label,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  queue.push(item);
  await writeQueue(queue);
  return item;
}

export interface SubmitResult<T> {
  queued: boolean;
  data?: T;
}

/**
 * Submit now, or queue it if the device is offline.
 *
 * Returns { queued: true } when it was stored for later, so the caller can tell
 * the worker their report is saved but not yet submitted — never imply it
 * reached the backend when it did not.
 *
 * A 4xx is a real answer and is rethrown: a rejected payload will be rejected
 * again tomorrow, so queueing it would just hide the problem.
 */
export async function submitOrQueue<T = any>(
  url: string,
  body: any,
  opts: EnqueueOptions,
): Promise<SubmitResult<T>> {
  const method = opts.method ?? 'post';
  const client = resolveClient(opts.client ?? 'default');
  if (!client) throw new Error(`No API client registered for "${opts.client ?? 'default'}"`);

  // Generated before the first attempt and reused on any later replay, so a
  // response lost to a dropped connection after the server already committed
  // the write is recognised as the same request, not treated as a new one.
  const requestId = newRequestId();

  try {
    const payload =
      opts.kind === 'multipart' ? buildFormData(body, opts.photos) : body;
    const res = await client[method](url, payload, { headers: { 'X-Idempotency-Key': requestId } });
    return { queued: false, data: res.data };
  } catch (err: any) {
    if (!isOfflineError(err)) throw err;
    await enqueue(url, body, opts, requestId);
    return { queued: true };
  }
}

export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
}

/**
 * Replay everything queued, oldest first.
 *
 * Order matters — a fatigue declaration must land before the permit request
 * that depends on it — so this stops at the first offline failure rather than
 * skipping ahead and reordering the worker's shift.
 */
export async function flush(): Promise<FlushResult> {
  const queue = await readQueue();
  if (queue.length === 0) return { sent: 0, failed: 0, remaining: 0 };

  const remaining: QueuedRequest[] = [];
  let sent = 0;
  let failed = 0;
  let offline = false;

  for (const item of queue) {
    if (offline) {
      remaining.push(item);
      continue;
    }

    const client = resolveClient(item.client);
    if (!client) {
      remaining.push(item);
      continue;
    }

    try {
      const payload =
        item.kind === 'multipart' ? buildFormData(item.body, item.photos) : item.body;
      await client[item.method](item.url, payload, { headers: { 'X-Idempotency-Key': item.id } });
      sent += 1;
    } catch (err: any) {
      if (isOfflineError(err)) {
        offline = true;
        remaining.push(item);
        continue;
      }
      // The server rejected it. Retrying an unchanged body will not help
      // forever, so keep it briefly for visibility and then drop it.
      const attempts = item.attempts + 1;
      failed += 1;
      if (attempts < MAX_ATTEMPTS) {
        remaining.push({
          ...item,
          attempts,
          lastError: err?.response?.data?.detail
            ? String(err.response.data.detail)
            : err?.message ?? 'rejected',
        });
      }
    }
  }

  await writeQueue(remaining);
  return { sent, failed, remaining: remaining.length };
}

export async function removeItem(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter(q => q.id !== id));
}

export async function clearQueue(): Promise<void> {
  await writeQueue([]);
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}
