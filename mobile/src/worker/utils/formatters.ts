export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

export function formatDueDate(iso: string): string {
  const now = new Date();
  const due = new Date(iso);
  const diffMs = due.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffH = Math.round(diffMs / 3600000);
  const diffD = Math.round(diffMs / 86400000);

  if (diffMin < 0) return 'Overdue';
  if (diffMin < 60) return `Due in ${diffMin}m`;
  if (diffH < 24) return `Due in ${diffH}h`;
  if (diffD === 0) return 'Due Today';
  if (diffD === 1) return 'Due Tomorrow';
  return `Due in ${diffD} days`;
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

export function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

/**
 * A Date as local wall-clock time for the API — deliberately not toISOString().
 *
 * The backend reads observation timestamps as the time on the worker's clock.
 * `risk_workflow._is_night_shift` tests the hour directly against 22:00-06:00,
 * `event_assessment._finish` starts the response SLA from it, and every other
 * timestamp in that database is written with `datetime.now()` rather than
 * `utcnow()`. toISOString() converts to UTC first, so a sighting at 23:40 in
 * IST arrives as 18:10 — losing the night-shift uplift on a risk report, and
 * moving a near miss's response deadline by the size of the offset.
 */
export function toLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
