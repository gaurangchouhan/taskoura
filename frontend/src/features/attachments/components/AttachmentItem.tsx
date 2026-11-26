import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  FileText, 
  FileSpreadsheet, 
  FileArchive, 
  FileCode, 
  Paperclip, 
  Trash2, 
  ExternalLink,
  Lock,
  Fingerprint,
  Eye,
  Download,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  Mail,
  WifiOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';
import { timeAgo } from '../../../lib/datetime';
import { useBiolockStatus } from '../../../hooks/useBiolock';
import { useDocumentAccess } from '../../../hooks/useDocumentAccess';
import { documentAccessService } from '../../../services/documentAccessService';
import { queryKeys } from '../../../lib/queryKeys';
import { Attachment } from '../../../types';

export function formatTimeAgo(dateStr?: string) {
  if (!dateStr) return 'just now';
  return timeAgo(dateStr);
}

export function formatFileSize(bytes?: number | null) {
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

export function getFileIcon(fileName: string = '', fileType: string = '') {
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

export interface AttachmentItemProps {
  attachment: Attachment & {
    restricted?: boolean;
    locked?: boolean;
    fileSize?: number;
    size?: number;
  };
  taskId?: string;
  projectId?: string;
  onDelete?: (id: string) => Promise<void> | void;
  isProjectOwner?: boolean;
  isDeleting?: boolean;
}

export const AttachmentItem: React.FC<AttachmentItemProps> = ({
  attachment,
  taskId,
  onDelete,
  isProjectOwner = false,
  isDeleting = false,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [imageError, setImageError] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeletingLocal, setIsDeletingLocal] = useState(false);
  const [isTogglingRestrict, setIsTogglingRestrict] = useState(false);

  const { data: biolockStatus } = useBiolockStatus();
  const biolockEnabled = Boolean(biolockStatus?.enabled);

  const {
    accessState,
    requestSecondsRemaining,
    accessSecondsRemaining,
    leaderNotified,
    deviceOnline,
    failureReason,
    isLoadingBlob,
    previewUrl,
    requestAccess,
    cancelRequest,
    viewContent,
    closePreview,
    downloadContent,
  } = useDocumentAccess({
    attachmentId: attachment.id,
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    restricted: Boolean(attachment.restricted),
    locked: Boolean(attachment.locked),
    isProjectOwner,
    biolockEnabled,
  });

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
  const timeAgoStr = formatTimeAgo(attachment.uploadedAt);

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

  const handleToggleRestrict = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextRestricted = e.target.checked;
    setIsTogglingRestrict(true);
    try {
      await documentAccessService.restrictAttachment(attachment.id, nextRestricted);
      const effectiveTaskId = taskId || attachment.taskId;
      if (effectiveTaskId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.attachments(effectiveTaskId) });
      }
      toast.success(
        nextRestricted
          ? 'Document protected with fingerprint'
          : 'Document restriction removed'
      );
    } catch {
      toast.error('Failed to change document protection');
    } finally {
      setIsTogglingRestrict(false);
    }
  };

  const isRestrictedDoc = Boolean(biolockEnabled && attachment.restricted);

  return (
    <>
      <div
        data-testid={`attachment-item-${attachment.id}`}
        className={`group flex flex-col gap-2.5 p-3.5 rounded-2xl bg-white border transition-all ${
          isRestrictedDoc
            ? 'border-indigo-100 shadow-2xs bg-gradient-to-r from-white to-slate-50/50'
            : 'border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
        }`}
      >
        {/* Main Item Row */}
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Thumbnail for images OR file icon */}
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center shrink-0 overflow-hidden relative">
              {isRestrictedDoc ? (
                <div className="relative">
                  {getFileIcon(attachment.fileName, attachment.fileType)}
                  <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-2xs">
                    <Lock className="w-2.5 h-2.5" />
                  </div>
                </div>
              ) : isImage && attachment.fileUrl ? (
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

            {/* Details & Link/Name */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {/* For non-restricted or unrestricted files, use direct link */}
                {!isRestrictedDoc ? (
                  <a
                    href={`/api/attachments/${attachment.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`attachment-link-${attachment.id}`}
                    className="text-sm font-semibold text-slate-800 hover:text-sky-600 transition-colors truncate block flex items-center gap-1"
                    title={attachment.fileName}
                  >
                    <span className="truncate">{attachment.fileName}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 text-slate-400 group-hover:text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ) : (
                  /* Restricted files NEVER use direct permanent file URL */
                  <span
                    data-testid={`attachment-name-${attachment.id}`}
                    className="text-sm font-semibold text-slate-800 truncate"
                    title={attachment.fileName}
                  >
                    {attachment.fileName}
                  </span>
                )}

                {isRestrictedDoc && (
                  <span
                    data-testid={`restricted-badge-${attachment.id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0"
                  >
                    <Fingerprint className="w-3 h-3" />
                    BioLock
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="truncate font-medium text-slate-600">
                  {attachment.uploadedByName || 'Unknown'}
                </span>
                <span>•</span>
                <span>{timeAgoStr}</span>
                {formattedSize && (
                  <>
                    <span>•</span>
                    <span>{formattedSize}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls: Protect toggle (for owner) + Delete button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Project owner toggle: "Protect with fingerprint" */}
            {isProjectOwner && biolockEnabled && (
              <label
                data-testid={`protect-toggle-${attachment.id}`}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer pr-1"
                title="Protect document with fingerprint"
              >
                <span className="hidden sm:inline font-medium text-[11px]">
                  {attachment.restricted ? 'Protected' : 'Protect'}
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(attachment.restricted)}
                  onChange={handleToggleRestrict}
                  disabled={isTogglingRestrict}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </label>
            )}

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
        </div>

        {/* BioLock Interactive Access States for Restricted Documents */}
        {isRestrictedDoc && (
          <div className="pt-2 border-t border-slate-100 text-xs">
            {/* 1. LOCKED STATE (Member has not yet requested access) */}
            {accessState === 'LOCKED' && (
              <div
                data-testid="access-locked-box"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Biometric authorization required to view or download.</span>
                </div>
                <button
                  type="button"
                  data-testid="request-access-button"
                  onClick={requestAccess}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  Request Leader Fingerprint Access
                </button>
              </div>
            )}

            {/* 2. REQUESTING / WAITING_FOR_LEADER STATE */}
            {(accessState === 'REQUESTING' || accessState === 'WAITING_FOR_LEADER') && (
              <div
                data-testid="access-waiting-box"
                className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 space-y-2 animate-fade-in"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600 shrink-0" />
                    <span className="font-semibold text-sky-950">
                      Waiting for Project Leader's fingerprint verification...
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {requestSecondsRemaining !== null && (
                      <span
                        data-testid="request-countdown"
                        className="inline-flex items-center gap-1 font-mono font-bold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-md"
                      >
                        <Clock className="w-3 h-3" />
                        {requestSecondsRemaining}s
                      </span>
                    )}
                    <button
                      type="button"
                      data-testid="cancel-access-request"
                      onClick={cancelRequest}
                      className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-sky-800 pt-0.5">
                  {leaderNotified && (
                    <span
                      data-testid="leader-notified-badge"
                      className="inline-flex items-center gap-1 text-sky-700 font-medium"
                    >
                      <Mail className="w-3 h-3 text-sky-600" />
                      Your leader was emailed
                    </span>
                  )}
                  {!deviceOnline && (
                    <span
                      data-testid="device-offline-badge"
                      className="inline-flex items-center gap-1 text-amber-700 font-medium"
                    >
                      <WifiOff className="w-3 h-3 text-amber-600" />
                      The leader's device looks offline
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 3. APPROVED STATE (or LEADER unconditional access) */}
            {(accessState === 'APPROVED' || accessState === 'LEADER') && (
              <div
                data-testid="access-approved-box"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-semibold block text-emerald-900">
                      {accessState === 'LEADER' ? 'Owner Access Granted' : 'Access Approved'}
                    </span>
                    {accessState === 'APPROVED' && accessSecondsRemaining !== null && (
                      <span className="text-[11px] text-emerald-700 font-medium">
                        Remaining access:{' '}
                        {Math.floor(accessSecondsRemaining / 60)}m{' '}
                        {accessSecondsRemaining % 60}s
                      </span>
                    )}
                  </div>
                </div>

                {/* View & Download buttons fetch blob via Axios */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="view-content-button"
                    onClick={viewContent}
                    disabled={isLoadingBlob}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isLoadingBlob ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    View
                  </button>

                  <button
                    type="button"
                    data-testid="download-content-button"
                    onClick={downloadContent}
                    disabled={isLoadingBlob}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    {isLoadingBlob ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Download
                  </button>
                </div>
              </div>
            )}

            {/* 4. DENIED STATE */}
            {accessState === 'DENIED' && (
              <div
                data-testid="access-denied-box"
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Access Denied{failureReason ? `: ${failureReason}` : ''}</span>
                </div>
                <button
                  type="button"
                  data-testid="request-again-button"
                  onClick={requestAccess}
                  className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Request again
                </button>
              </div>
            )}

            {/* 5. EXPIRED STATE */}
            {accessState === 'EXPIRED' && (
              <div
                data-testid="access-expired-box"
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Access request expired without approval.</span>
                </div>
                <button
                  type="button"
                  data-testid="request-again-button"
                  onClick={requestAccess}
                  className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Request again
                </button>
              </div>
            )}

            {/* 6. ERROR STATE */}
            {accessState === 'ERROR' && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                <span>Failed to verify access permissions.</span>
                <button
                  type="button"
                  onClick={requestAccess}
                  className="font-bold underline text-rose-900"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Dialog (revokes object URL on close) */}
      {previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="document-preview-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePreview();
          }}
        >
          <div className="w-full max-w-4xl bg-white rounded-3xl p-5 border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                <h4 className="text-sm font-bold text-slate-800 truncate">{attachment.fileName}</h4>
              </div>
              <button
                type="button"
                onClick={closePreview}
                data-testid="close-preview-button"
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center min-h-[300px] bg-slate-50 rounded-2xl p-2">
              {attachment.fileType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment.fileName) ? (
                <img
                  src={previewUrl}
                  alt={attachment.fileName}
                  className="max-w-full max-h-[70vh] object-contain rounded-xl"
                />
              ) : (
                <iframe
                  src={previewUrl}
                  title={attachment.fileName}
                  className="w-full h-[70vh] rounded-xl border border-slate-200"
                />
              )}
            </div>
          </div>
        </div>
      )}

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
