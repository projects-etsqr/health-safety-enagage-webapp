import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { TrainingCourse, TrainingComment } from '../types';

export const trainingService = {
  async getCourses(): Promise<TrainingCourse[]> {
    const { data } = await apiClient.get<TrainingCourse[]>(ENDPOINTS.TRAINING.LIST);
    return data;
  },

  async getComments(courseId: number): Promise<TrainingComment[]> {
    const { data } = await apiClient.get<TrainingComment[]>(ENDPOINTS.TRAINING.COMMENTS(courseId));
    return data;
  },

  async postComment(courseId: number, commentText: string): Promise<TrainingComment> {
    const { data } = await apiClient.post<TrainingComment>(ENDPOINTS.TRAINING.COMMENTS(courseId), {
      comment_text: commentText,
    });
    return data;
  },
};
