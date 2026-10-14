export interface TrainingCourse {
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

