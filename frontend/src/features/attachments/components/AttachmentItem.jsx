import React, { useState } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  FileArchive, 
  FileCode, 
  Paperclip, 
  Trash2, 
  ExternalLink 
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';
import { timeAgo } from '../../../lib/datetime';

export function formatTimeAgo(dateStr) {
  if (!dateStr) return 'just now';
  return timeAgo(dateStr);
}

export function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
    return null;
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function getFileIcon(fileName = '', fileType = '') {
  const lowerName = fileName.toLowerCase();
  const ext = lowerName.split('.').pop() || '';

  if (ext === 'pdf' || fileType.includes('pdf')) {
    return <FileText className="w-5 h-5 text-rose-500" />;
  }
  if (['doc', 'docx', 'txt', 'rtf', 'odt', 'md'].includes(ext)) {
    return <FileText className="w-5 h-5 text-sky-500" />;
  }
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
  }
  if (['zip', 'tar', 'gz', '7z'].includes(ext)) {
    return <FileArchive className="w-5 h-5 text-amber-500" />;
  }
  if (['json', 'xml', 'yaml', 'yml'].includes(ext)) {
    return <FileCode className="w-5 h-5 text-indigo-500" />;
  }
  return <Paperclip className="w-5 h-5 text-slate-500" />;
}

export const AttachmentItem = ({
  attachment,
  onDelete,
  isProjectOwner = false,
  isDeleting = false,
}) => {
  const { user } = useAuth();
  const [imageError, setImageError] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeletingLocal, setIsDeletingLocal] = useState(false);

  // Current user upload check
  const isUploader = Boolean(
    user &&
      (user.id === attachment.uploadedBy ||
        user.email === attachment.uploadedBy ||
        (attachment.uploadedByName && user.name === attachment.uploadedByName))
  );

  // Permission: Only the uploader or project owner
  const canDelete = isUploader || Boolean(isProjectOwner);

  const isImage =
    !imageError &&
    (attachment.fileType?.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(attachment.fileName || ''));

  const formattedSize = formatFileSize(attachment.fileSize || attachment.size);
  const timeAgo = formatTimeAgo(attachment.uploadedAt);

  const handleDeleteConfirm = async () => {
    setIsDeletingLocal(true);
    try {
      if (typeof onDelete === 'function') {
        await onDelete(attachment.id);
      }
      setIsConfirmOpen(false);
    } catch {
      // Error handled by mutation toast
    } finally {
      setIsDeletingLocal(false);
    }
  };

  const downloadUrl = attachment.id
    ? `/api/attachments/${attachment.id}/download`
    : attachment.fileUrl;

  return (
    <>
      <div
        data-testid={`attachment-item-${attachment.id}`}
        className="group flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Thumbnail for images OR file icon */}
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center shrink-0 overflow-hidden">
            {isImage ? (
              <img
                src={attachment.fileUrl}
                alt={attachment.fileName}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              getFileIcon(attachment.fileName, attachment.fileType)
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`attachment-link-${attachment.id}`}
              className="text-sm font-semibold text-slate-800 hover:text-sky-600 transition-colors truncate block flex items-center gap-1"
              title={attachment.fileName}
            >
              <span className="truncate">{attachment.fileName}</span>
              <ExternalLink className="w-3 h-3 shrink-0 text-slate-400 group-hover:text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>

            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span className="truncate font-medium text-slate-600">
                {attachment.uploadedByName || 'Unknown'}
              </span>
              <span>•</span>
              <span>{timeAgo}</span>
              {formattedSize && (
                <>
                  <span>•</span>
                  <span>{formattedSize}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Delete Control: ONLY shown when user is uploader or project owner */}
        {canDelete && (
          <button
            type="button"
            aria-label="Delete attachment"
            data-testid={`delete-attachment-${attachment.id}`}
            onClick={() => setIsConfirmOpen(true)}
            disabled={isDeleting || isDeletingLocal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {isConfirmOpen && (
        <ConfirmDialog
          isOpen={isConfirmOpen}
          title="Delete Attachment"
          message={`Are you sure you want to delete "${attachment.fileName}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          isPending={isDeleting || isDeletingLocal}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </>
  );
};

export default AttachmentItem;
