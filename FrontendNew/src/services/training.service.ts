import axiosInstance from '../api/axiosInstance';

export interface TrainingVideo {
  id: number;
  title: string;
  description: string | null;
  video_url: string;
  target_roles: string[];
  created_at: string;
  updated_at: string;
}

export interface TrainingVideoComment {
  id: number;
  training_video_id: number;
  comment_text: string;
  author_id: number | null;
  author_name: string | null;
  created_at: string;
}

export interface CreateTrainingVideoPayload {
  title: string;
  description?: string;
  video_url: string;
  target_roles: string[];
}

export type UpdateTrainingVideoPayload = Partial<CreateTrainingVideoPayload>;

export const getTrainingVideos = () =>
  axiosInstance.get<TrainingVideo[]>('/training-videos/').then((r) => r.data);

export const createTrainingVideo = (payload: CreateTrainingVideoPayload) =>
  axiosInstance.post<TrainingVideo>('/training-videos/', payload).then((r) => r.data);

export const updateTrainingVideo = (id: number, payload: UpdateTrainingVideoPayload) =>
  axiosInstance.put<TrainingVideo>(`/training-videos/${id}`, payload).then((r) => r.data);

export const deleteTrainingVideo = (id: number) =>
  axiosInstance.delete(`/training-videos/${id}`).then((r) => r.data);

export const getTrainingVideoComments = (id: number) =>
  axiosInstance.get<TrainingVideoComment[]>(`/training-videos/${id}/comments`).then((r) => r.data);
