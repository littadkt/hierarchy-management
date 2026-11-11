"use client";

import React, { useRef, useState } from "react";
import {
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  Download,
  ExternalLink,
  Trash2,
  UploadCloud,
  Loader2,
  Paperclip,
  AlertCircle,
} from "lucide-react";
import { TaskAttachment } from "@/lib/types";
import { tasksApi, attachmentsApi, getErrorMessage, api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { RoleBadge } from "./RoleBadge";

interface TaskAttachmentsViewProps {
  taskId: string;
  subtaskId?: string;
  subtaskTitle?: string;
  attachments: TaskAttachment[];
  onAttachmentsChanged: () => void;
  canUpload?: boolean;
  canDelete?: boolean;
  compact?: boolean;
}

export const TaskAttachmentsView: React.FC<TaskAttachmentsViewProps> = ({
  taskId,
  subtaskId,
  subtaskTitle,
  attachments = [],
  onAttachmentsChanged,
  canUpload = true,
  canDelete = true,
  compact = false,
}) => {
  const { user } = useAuth();
  const { confirm, alert } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (filename: string, contentType?: string | null) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const mime = (contentType || "").toLowerCase();

    if (
      mime.startsWith("image/") ||
      ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
    ) {
      return <FileImage className="w-5 h-5 text-indigo-500 shrink-0" />;
    }
    if (
      mime.includes("pdf") ||
      ext === "pdf"
    ) {
      return <FileText className="w-5 h-5 text-rose-500 shrink-0" />;
    }
    if (
      mime.includes("sheet") ||
      mime.includes("excel") ||
      ["xlsx", "xls", "csv"].includes(ext)
    ) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />;
    }
    if (
      mime.includes("zip") ||
      mime.includes("compressed") ||
      ["zip", "rar", "7z", "tar", "gz"].includes(ext)
    ) {
      return <FileArchive className="w-5 h-5 text-amber-500 shrink-0" />;
    }
    if (
      ["js", "ts", "jsx", "tsx", "py", "json", "html", "css", "sql"].includes(ext)
    ) {
      return <FileCode className="w-5 h-5 text-sky-500 shrink-0" />;
    }
    return <File className="w-5 h-5 text-slate-500 shrink-0" />;
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    // Check individual 50MB limit
    const oversized = fileArray.find((f) => f.size > 50 * 1024 * 1024);
    if (oversized) {
      setUploadError(`File "${oversized.name}" exceeds the 50MB maximum size limit.`);
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const uploader = attachmentsApi?.upload || tasksApi?.uploadAttachments;
      if (uploader) {
        await uploader(taskId, fileArray, subtaskId);
      }
      onAttachmentsChanged();
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canUpload) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!canUpload) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleDownload = async (att: TaskAttachment) => {
    setDownloadingId(att.id);
    try {
      const downloader = attachmentsApi?.downloadBlob || tasksApi?.downloadAttachmentBlob;
      if (downloader) {
        await downloader(att.id, att.filename);
      }
    } catch (err) {
      await alert({
        title: "Download Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (att: TaskAttachment) => {
    setPreviewingId(att.id);
    try {
      const response = await api.get(`/tasks/attachments/${att.id}/download?download=false`, {
        responseType: "blob",
      });
      const mimeType =
        att.content_type ||
        (typeof response.headers["content-type"] === "string"
          ? response.headers["content-type"]
          : "application/octet-stream");
      const blob = new Blob([response.data], { type: mimeType });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (err) {
      await alert({
        title: "Preview Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setPreviewingId(null);
    }
  };

  const handleDelete = async (att: TaskAttachment) => {
    const ok = await confirm({
      title: "Delete Attachment",
      message: `Are you sure you want to remove attachment "${att.filename}"? This action cannot be undone.`,
      confirmText: "Delete File",
      type: "danger",
    });
    if (!ok) return;

    setDeletingId(att.id);
    try {
      const deleter = attachmentsApi?.delete || tasksApi?.deleteAttachment;
      if (deleter) {
        await deleter(att.id);
      }
      onAttachmentsChanged();
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const canUserDelete = (att: TaskAttachment) => {
    if (!canDelete || !user) return false;
    if (user.role === "SUPER_ADMIN") return true;
    return att.uploaded_by_id === user.id;
  };

  return (
    <div className="space-y-4">
      {/* Upload Dropzone (if allowed) */}
      {canUpload && (
        <div>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleUploadFiles(e.target.files);
            }}
          />
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl cursor-pointer transition-all duration-150 flex flex-col items-center justify-center text-center ${
              compact ? "p-3 py-4" : "p-6"
            } ${
              isDragging
                ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.01]"
                : "border-slate-200 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/50 dark:hover:bg-slate-800/70"
            }`}
          >
            {uploading ? (
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs font-semibold">Uploading attachment(s)...</span>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 shadow-xs">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span className="text-indigo-600 dark:text-indigo-400 hover:underline">
                    Click to browse
                  </span>{" "}
                  or drag & drop files here
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Supports documents, PDFs, images, spreadsheets, and archives up to 50MB
                </p>
              </>
            )}
          </div>

          {uploadError && (
            <div className="mt-2.5 p-2.5 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}

      {/* Attachments List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
            <span>
              {subtaskTitle ? `Attachments for "${subtaskTitle}"` : "Attachments"} (
              {attachments.length})
            </span>
          </div>
        </div>

        {attachments.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
            <Paperclip className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              No files attached yet.
            </p>
            {canUpload && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Upload relevant files, specifications, photos, or documents.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="group p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                    {getFileIcon(att.filename, att.content_type)}
                  </div>
                  <div className="min-w-0">
                    <p
                      title={att.filename}
                      className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                    >
                      {att.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 flex-wrap">
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        {formatFileSize(att.file_size)}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(att.created_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {att.uploaded_by && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <span>by {att.uploaded_by.full_name}</span>
                            <RoleBadge role={att.uploaded_by.role} />
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Preview in new tab"
                    disabled={previewingId === att.id}
                    onClick={() => handlePreview(att)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                  >
                    {previewingId === att.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Download file"
                    disabled={downloadingId === att.id}
                    onClick={() => handleDownload(att)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                  >
                    {downloadingId === att.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                  {canUserDelete(att) && (
                    <button
                      type="button"
                      title="Delete attachment"
                      disabled={deletingId === att.id}
                      onClick={() => handleDelete(att)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                    >
                      {deletingId === att.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
