import { apiClient } from './api';
import { Comment, CreateCommentRequest } from '../types/comment';

export const getComments = async (taskId: string): Promise<Comment[]> => {
  const { data } = await apiClient.get<Comment[]>(`/tasks/${taskId}/comments`);
  return data;
};

export const addComment = async (
  taskId: string,
  payload: CreateCommentRequest
): Promise<Comment> => {
  const { data } = await apiClient.post<Comment>(
    `/tasks/${taskId}/comments`,
    payload
  );
  return data;
};

export const commentService = {
  getComments,
  addComment,
};

export default commentService;
