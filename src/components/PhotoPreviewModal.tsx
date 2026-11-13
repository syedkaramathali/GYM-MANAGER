import { useEffect } from 'react';
import { X } from 'lucide-react';

export interface PhotoPreviewTarget {
  src: string;
  name: string;
  subtitle?: string;
}

interface PhotoPreviewModalProps {
  photo: PhotoPreviewTarget | null;
  onClose: () => void;
}

export function PhotoPreviewModal({ photo, onClose }: PhotoPreviewModalProps) {
  useEffect(() => {
    if (!photo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, onClose]);

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${photo.name} profile photo`}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 text-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-neutral-800 px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-white">
              {photo.name}
            </h3>
            {photo.subtitle && (
              <p className="mt-0.5 truncate font-mono text-xs text-emerald-400">
                {photo.subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo preview"
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-center bg-black p-4">
          <img
            src={photo.src}
            alt={photo.name}
            referrerPolicy="no-referrer"
            className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
          />
        </div>

        <div className="flex justify-end border-t border-neutral-800 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-700 px-4 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
