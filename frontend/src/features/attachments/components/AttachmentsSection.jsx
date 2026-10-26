import React from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { useAttachments, useUploadAttachment, useDeleteAttachment } from '../hooks';
import { useCurrentMembership } from '../../../hooks/useMembers';
import { Dropzone } from './Dropzone';
import { AttachmentItem } from './AttachmentItem';

export const AttachmentsSection = ({
  taskId,
  projectId,
  isProjectOwner = false,
}) => {
  const { data: attachments = [], isLoading, isError } = useAttachments(taskId);
  const { mutateAsync: uploadAttachmentMutation, isPending: isUploading } = useUploadAttachment(taskId, projectId);
  const { mutateAsync: deleteAttachmentMutation, isPending: isDeleting } = useDeleteAttachment(taskId, projectId);

  const { isOwner: membershipIsOwner } = useCurrentMembership(projectId);
  const isOwner = isProjectOwner || Boolean(membershipIsOwner);

  const handleUpload = async (file, onProgress) => {
    await uploadAttachmentMutation({ file, onUploadProgress: onProgress });
  };

  const handleDelete = async (attachmentId) => {
    await deleteAttachmentMutation(attachmentId);
  };

  return (
    <div
      data-testid="section-attachments"
      className="p-4 sm:p-5 rounded-3xl border border-slate-200/90 bg-slate-50/60 shadow-xs space-y-4"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-sky-600" />
          <h3 className="font-bold text-sm text-slate-800 tracking-tight">
            Attachments
          </h3>
        </div>

        <span
          data-testid="attachments-count"
          className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200"
        >
          {attachments.length}
        </span>
      </div>

      {/* Upload Dropzone */}
      <Dropzone onUpload={handleUpload} isUploading={isUploading} />

      {/* Attachments List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
            <span className="text-xs font-medium">Loading attachments...</span>
          </div>
        ) : isError ? (
          <div className="py-3 px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-medium">
            Failed to load attachments.
          </div>
        ) : attachments.length === 0 ? (
          <div
            data-testid="empty-attachments"
            className="py-5 text-center border border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400 text-xs font-medium"
          >
            No attachments yet. Upload files above.
          </div>
        ) : (
          attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              isProjectOwner={isOwner}
              isDeleting={isDeleting}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default AttachmentsSection;
