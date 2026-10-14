import { useEffect, useState } from 'react';
import { Loader2, MessageSquare, Pencil, Plus, PlayCircle, Trash2, X } from 'lucide-react';
import {
  createTrainingVideo,
  deleteTrainingVideo,
  getTrainingVideoComments,
  getTrainingVideos,
  updateTrainingVideo,
  type TrainingVideo,
  type TrainingVideoComment,
} from '../../services/training.service';
import { useAuth } from '../context/AuthContext';
import { SettingsFamilyTabBar } from '../components/audits/SettingsFamilyTabBar';

const ROLE_OPTIONS = [
  { value: 'worker', label: 'Worker' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'manager', label: 'Manager' },
  { value: 'auditor', label: 'Auditor' },
];

const EMPTY_FORM = { title: '', description: '', video_url: '', target_roles: [] as string[] };

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1.5 text-[13px]" style={{ color: '#374151', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

function RolePills({ selected, onToggle }: { selected: string[]; onToggle: (role: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROLE_OPTIONS.map((role) => (
        <button
          key={role.value}
          type="button"
          onClick={() => onToggle(role.value)}
          className="px-2.5 py-1 rounded-full text-[11px] border"
          style={selected.includes(role.value)
            ? { background: '#EFF6FF', borderColor: '#93C5FD', color: '#1D4ED8', fontWeight: 700 }
            : { background: '#fff', borderColor: '#E5E7EB', color: '#6B7280' }}
        >
          {role.label}
        </button>
      ))}
    </div>
  );
}

export function TrainingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TrainingVideo | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [commentsFor, setCommentsFor] = useState<TrainingVideo | null>(null);
  const [comments, setComments] = useState<TrainingVideoComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getTrainingVideos()
      .then(setVideos)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load training videos.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleRole = (role: string) => {
    setForm((prev) => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter((r) => r !== role)
        : [...prev.target_roles, role],
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (video: TrainingVideo) => {
    setEditing(video);
    setForm({
      title: video.title,
      description: video.description ?? '',
      video_url: video.video_url,
      target_roles: video.target_roles,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.video_url.trim()) { setFormError('Video link is required.'); return; }
    if (form.target_roles.length === 0) { setFormError('Select at least one target role.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        video_url: form.video_url.trim(),
        target_roles: form.target_roles,
      };
      if (editing) {
        await updateTrainingVideo(editing.id, payload);
      } else {
        await createTrainingVideo(payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save training video.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this training video? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteTrainingVideo(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete training video.');
    } finally {
      setDeletingId(null);
    }
  };

  const openComments = (video: TrainingVideo) => {
    setCommentsFor(video);
    setLoadingComments(true);
    getTrainingVideoComments(video.id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false));
  };

  return (
    <div className="space-y-6">
      <SettingsFamilyTabBar />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1>Training</h1>
          <p className="text-[13px] mt-1" style={{ color: '#4A5568' }}>
            Add safety training videos and target them at worker, supervisor, manager or auditor.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px]"
            style={{ background: 'linear-gradient(135deg, #0B3D91, #1D4ED8)', fontWeight: 600 }}
          >
            <Plus className="w-4 h-4" /> Add Training Video
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: '#FFF1F2', color: '#BE123C', fontWeight: 500 }}>
          {error}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-5" style={{ borderColor: '#E6EEFF' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#1D4ED8' }} />
          </div>
        ) : videos.length === 0 ? (
          <div className="py-10 text-center text-[13px]" style={{ color: '#9CA3AF' }}>
            No training videos yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Title', 'Target Roles', 'Link', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] uppercase" style={{ color: '#64748B', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td className="px-3 py-3 align-top">
                      <div className="text-[13px]" style={{ color: '#0F172A', fontWeight: 600 }}>{v.title}</div>
                      {v.description && (
                        <div className="text-[12px] mt-0.5 max-w-[360px] truncate" style={{ color: '#6B7280' }}>{v.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-1">
                        {v.target_roles.map((r) => (
                          <span key={r} className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700 }}>
                            {ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <a href={v.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px]" style={{ color: '#1D4ED8' }}>
                        <PlayCircle className="w-3.5 h-3.5" /> Open
                      </a>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openComments(v)} className="p-1.5 rounded-lg hover:bg-gray-100" title="View comments">
                          <MessageSquare className="w-4 h-4" style={{ color: '#6B7280' }} />
                        </button>
                        {isAdmin && (
                          <>
                            <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Edit">
                              <Pencil className="w-4 h-4" style={{ color: '#6B7280' }} />
                            </button>
                            <button
                              onClick={() => handleDelete(v.id)}
                              disabled={deletingId === v.id}
                              className="p-1.5 rounded-lg hover:bg-gray-100"
                              title="Delete"
                            >
                              {deletingId === v.id
                                ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#DC2626' }} />
                                : <Trash2 className="w-4 h-4" style={{ color: '#DC2626' }} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowForm(false)} />
          <div
            className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-[560px] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white"
            style={{ boxShadow: '0px 8px 32px rgba(0,0,0,0.16)' }}
          >
            <div className="px-8 py-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[17px]" style={{ color: '#0A0A0A', fontWeight: 700 }}>
                  {editing ? 'Edit Training Video' : 'Add Training Video'}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg" style={{ color: '#6B7280' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 rounded-lg px-3 py-2 text-[12px]" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <FormField label="Title *">
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Heat Stress Prevention"
                    className="w-full h-10 px-3 rounded-lg border text-[13px]"
                    style={{ borderColor: '#D6E4FF' }}
                  />
                </FormField>
                <FormField label="Description">
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What does this video cover?"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border text-[13px]"
                    style={{ borderColor: '#D6E4FF' }}
                  />
                </FormField>
                <FormField label="Video Link *">
                  <input
                    value={form.video_url}
                    onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="w-full h-10 px-3 rounded-lg border text-[13px]"
                    style={{ borderColor: '#D6E4FF' }}
                  />
                </FormField>
                <FormField label="Target Audience *">
                  <RolePills selected={form.target_roles} onToggle={toggleRole} />
                </FormField>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-[13px]" style={{ color: '#6B7280', fontWeight: 500 }}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="px-6 py-2 rounded-lg text-white text-[13px] disabled:opacity-60"
                  style={{ background: '#4A57B9', fontWeight: 600 }}
                >
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Training Video'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Comments viewer — read-only */}
      {commentsFor && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setCommentsFor(null)} />
          <div
            className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-[520px] max-h-[80vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white"
            style={{ boxShadow: '0px 8px 32px rgba(0,0,0,0.16)' }}
          >
            <div className="px-8 py-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[17px]" style={{ color: '#0A0A0A', fontWeight: 700 }}>Comments</h2>
                <button onClick={() => setCommentsFor(null)} className="p-1.5 rounded-lg" style={{ color: '#6B7280' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[12.5px] mb-4" style={{ color: '#6B7280' }}>{commentsFor.title}</p>

              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#1D4ED8' }} />
                </div>
              ) : comments.length === 0 ? (
                <div className="py-6 text-center text-[13px]" style={{ color: '#9CA3AF' }}>No comments yet.</div>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-lg border p-3" style={{ borderColor: '#E6EEFF' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[12.5px]" style={{ color: '#0F172A', fontWeight: 700 }}>{c.author_name ?? 'Anonymous'}</span>
                        <span className="text-[11px]" style={{ color: '#9CA3AF' }}>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-[13px] mt-1" style={{ color: '#334155' }}>{c.comment_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
