import { useState, useCallback } from 'react';
import { trainingService } from '../services/trainingService';
import { TrainingCourse, TrainingComment } from '../types';

export function useTraining() {
  const [courses,   setCourses]   = useState<TrainingCourse[]>([]);
  const [isLoading, setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const [comments, setComments] = useState<TrainingComment[]>([]);
  const [isLoadingComments, setLoadingComments] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCourses(await trainingService.getCourses());
    } catch (err: any) {
      setError(err?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchComments = useCallback(async (courseId: number) => {
    setLoadingComments(true);
    try {
      setComments(await trainingService.getComments(courseId));
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const postComment = useCallback(async (courseId: number, text: string) => {
    const comment = await trainingService.postComment(courseId, text);
    setComments((prev) => [comment, ...prev]);
  }, []);

  return { courses, isLoading, error, fetchCourses, comments, isLoadingComments, fetchComments, postComment };
}
