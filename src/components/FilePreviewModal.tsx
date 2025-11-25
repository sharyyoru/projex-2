"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type FilePreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
};

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function getFileType(fileName: string): "image" | "pdf" | "word" | "excel" | "other" {
  const ext = getFileExtension(fileName);
  
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) {
    return "image";
  }
  if (ext === "pdf") {
    return "pdf";
  }
  if (["doc", "docx"].includes(ext)) {
    return "word";
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return "excel";
  }
  return "other";
}

function FileIcon({ type, className }: { type: string; className?: string }) {
  if (type === "image") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    );
  }
  if (type === "pdf") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M10 12h4" />
        <path d="M10 16h4" />
        <path d="M8 12h.01" />
        <path d="M8 16h.01" />
      </svg>
    );
  }
  if (type === "word") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M8 13h8" />
        <path d="M8 17h8" />
        <path d="M8 9h2" />
      </svg>
    );
  }
  if (type === "excel") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M8 13h2" />
        <path d="M8 17h2" />
        <path d="M14 13h2" />
        <path d="M14 17h2" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export default function FilePreviewModal({
  isOpen,
  onClose,
  fileUrl,
  fileName,
}: FilePreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fileType = getFileType(fileName);
  const ext = getFileExtension(fileName);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
    }
  }, [isOpen, fileUrl]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.click();
  };

  // Google Docs Viewer URL for Office files
  const getOfficeViewerUrl = (url: string) => {
    return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${
              fileType === "image" ? "bg-gradient-to-br from-pink-100 to-rose-100 text-pink-600" :
              fileType === "pdf" ? "bg-gradient-to-br from-red-100 to-orange-100 text-red-600" :
              fileType === "word" ? "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600" :
              fileType === "excel" ? "bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-600" :
              "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600"
            }`}>
              <FileIcon type={fileType} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">{fileName}</h3>
              <p className="text-[11px] text-slate-500 uppercase">{ext} file</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-[12px] font-medium text-white shadow-sm transition-all hover:shadow-lg hover:shadow-emerald-500/25"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-all hover:bg-red-100 hover:text-red-600"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-100 p-4 min-h-[60vh]">
          {fileType === "image" ? (
            <div className="flex items-center justify-center h-full">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                  <div className="text-sm text-slate-500">Loading preview...</div>
                </div>
              )}
              <Image
                src={fileUrl}
                alt={fileName}
                width={1200}
                height={800}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError("Failed to load image");
                }}
              />
            </div>
          ) : fileType === "pdf" ? (
            <iframe
              src={fileUrl}
              className="w-full h-full min-h-[60vh] rounded-lg shadow-lg bg-white"
              title={fileName}
              onLoad={() => setLoading(false)}
            />
          ) : fileType === "word" || fileType === "excel" ? (
            <div className="h-full min-h-[60vh]">
              <iframe
                src={getOfficeViewerUrl(fileUrl)}
                className="w-full h-full min-h-[60vh] rounded-lg shadow-lg bg-white"
                title={fileName}
                onLoad={() => setLoading(false)}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[40vh] gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500">
                <FileIcon type={fileType} className="h-10 w-10" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">Preview not available</p>
                <p className="mt-1 text-[12px] text-slate-500">
                  This file type cannot be previewed. Click download to view it.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-5 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Download File
              </button>
            </div>
          )}
          
          {error && (
            <div className="flex flex-col items-center justify-center h-full min-h-[40vh] gap-4">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-2 text-[12px] font-medium text-white shadow-sm"
              >
                Download Instead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { getFileType, getFileExtension, FileIcon };
