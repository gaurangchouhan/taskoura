export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  mentionedUserIds?: string[];
}

export interface CreateCommentRequest {
  content: string;
}
