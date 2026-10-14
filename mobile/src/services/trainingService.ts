/**
 * Training videos — one module shared by the supervisor, manager and auditor
 * apps (worker keeps its own copy in worker/services/trainingService.ts,
 * since worker's api/client.ts has its own silent-refresh-on-401 behaviour
 * that this top-level client does not).
 *
 * Note the apiClient response interceptor unwraps { success, data }, so these
 * read res.data and never res.data.data.
 */
import { apiClient } from '../api/client';

export interface TrainingVideo {
  id: number;
  title: string;
  description: string | null;
  video_url: string;
  target_roles: string[];
  created_at: string;
}

export interface TrainingComment {
  id: number;
  training_video_id: number;
  comment_text: string;
  author_id: number | null;
  author_name: string | null;
  created_at: string;
}

export const trainingService = {
  async getVideos(): Promise<TrainingVideo[]> {
    const { data } = await apiClient.get<TrainingVideo[]>('/training-videos/mine');
    return data;
  },

  async getComments(videoId: number): Promise<TrainingComment[]> {
    const { data } = await apiClient.get<TrainingComment[]>(`/training-videos/${videoId}/comments`);
    return data;
  },

  async postComment(videoId: number, commentText: string): Promise<TrainingComment> {
    const { data } = await apiClient.post<TrainingComment>(`/training-videos/${videoId}/comments`, {
      comment_text: commentText,
    });
    return data;
  },
};
