import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { validateAttachmentFile } from '../api';

export const Dropzone = ({ onUpload, isUploading: externalIsUploading = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const inputRef = useRef(null);

  const isUploading = externalIsUploading || uploadProgress !== null;

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    // Validate size (10MB) and allowed extension before firing any request
    const validation = validateAttachmentFile(file);
    if (!validation.valid) {
      const err = validation.error || 'Invalid file';
      setErrorMessage(err);
      toast.error(err);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setErrorMessage('');
    setSelectedFileName(file.name);
    setUploadProgress(0);

    try {
      if (typeof onUpload === 'function') {
        await onUpload(file, (percent) => {
          setUploadProgress(percent);
        });
      }
    } catch (err) {
      // Error handling is handled in mutation / caller, but keep state clean
      const msg = err?.response?.data?.message || err?.message || 'Upload failed';
      setErrorMessage(msg);
    } finally {
      setUploadProgress(null);
      setSelectedFileName('');
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleClick = () => {
    if (!isUploading && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        data-testid="dropzone-file-input"
        className="hidden"
        onChange={handleInputChange}
        disabled={isUploading}
      />

      <div
        role="button"
        tabIndex={0}
        data-testid="attachments-dropzone"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label="Upload file attachment"
        className={`relative w-full border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
          isDragging
            ? 'border-sky-500 bg-sky-50/70 scale-[1.01]'
            : 'border-slate-200 hover:border-sky-400 bg-white/70 hover:bg-slate-50/60'
        } ${isUploading ? 'opacity-75 pointer-events-none' : ''}`}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
              isDragging
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'bg-sky-50 text-sky-600'
            }`}
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <UploadCloud className="w-5 h-5" />
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800">
              <span className="text-sky-600 hover:underline">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Images, PDFs, Docs, Archives up to 10MB
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {uploadProgress !== null && (
          <div className="mt-4 pt-3 border-t border-slate-100" data-testid="upload-progress-container">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span className="truncate max-w-[200px] flex items-center gap-1.5">
                <File className="w-3.5 h-3.5 text-sky-600" />
                {selectedFileName || 'Uploading file...'}
              </span>
              <span className="text-sky-600 font-bold">{uploadProgress}%</span>
            </div>
            <div
              className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"
              data-testid="upload-progress-bar"
            >
              <div
                className="bg-gradient-to-r from-sky-500 to-indigo-600 h-2 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div
            role="alert"
            data-testid="dropzone-error"
            className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-center gap-1.5 font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dropzone;
