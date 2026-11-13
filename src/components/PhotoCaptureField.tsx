import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, Trash2, Upload, User, X } from 'lucide-react';
import { PhotoPreviewModal } from './PhotoPreviewModal';

interface PhotoCaptureFieldProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  readyLabel?: string;
  previewTitle?: string;
}

function resizeCanvasToJpeg(
  source: HTMLVideoElement | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  mirrorHorizontal = false
): string {
  const maxDim = 512;
  const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
  const targetW = Math.max(1, Math.round(sourceWidth * scale));
  const targetH = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (mirrorHorizontal) {
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', 0.88);
}

const CAMERA_GRANTED_KEY = 'gymmanager_camera_granted';
const CAMERA_DEVICE_PREFIX = 'gymmanager_camera_device_';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, val: string | null) {
  try {
    if (val === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, val);
    }
  } catch {
    // Ignore storage quota / private mode restrictions
  }
}

export function PhotoCaptureField({
  value,
  onChange,
  label = 'Member Profile Photo (Optional)',
  readyLabel = 'Photo ready for Digital Member ID',
  previewTitle = 'Member Profile Photo',
}: PhotoCaptureFieldProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [startingCamera, setStartingCamera] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(
    () => readStorage(CAMERA_GRANTED_KEY) === 'true'
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setVideoReady(false);
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // Sync with browser Permissions API so granted users never see repeated permission notices
  useEffect(() => {
    let active = true;
    let statusRef: PermissionStatus | null = null;
    let handleChange: (() => void) | null = null;

    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((status) => {
          if (!active) return;
          statusRef = status;
          const syncState = () => {
            if (status.state === 'granted') {
              setPermissionGranted(true);
              writeStorage(CAMERA_GRANTED_KEY, 'true');
              setCameraError(null);
            } else if (status.state === 'denied') {
              setPermissionGranted(false);
              writeStorage(CAMERA_GRANTED_KEY, null);
            }
          };
          syncState();
          handleChange = syncState;
          status.addEventListener('change', syncState);
        })
        .catch(() => {
          // Safari / Firefox may not support permissions.query({ name: 'camera' })
        });
    }

    return () => {
      active = false;
      if (statusRef && handleChange) {
        statusRef.removeEventListener('change', handleChange);
      }
    };
  }, []);

  // Reliably bind active MediaStream after the camera modal mounts <video>
  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return;
    const videoEl = videoRef.current;
    videoEl.srcObject = streamRef.current;

    const handleReady = () => {
      if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        setVideoReady(true);
      }
    };

    videoEl.addEventListener('loadedmetadata', handleReady);
    videoEl.addEventListener('playing', handleReady);
    videoEl.play().catch((err) => {
      console.warn('Video autoplay warning:', err);
    });

    if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      setVideoReady(true);
    }

    return () => {
      videoEl.removeEventListener('loadedmetadata', handleReady);
      videoEl.removeEventListener('playing', handleReady);
    };
  }, [cameraOpen]);

  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    setStartingCamera(true);
    setVideoReady(false);
    stopStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Camera capture is not supported in this browser. Please upload a photo file instead.'
      );
      setStartingCamera(false);
      return;
    }

    try {
      // If permission was previously granted, check enumerated devices to target the authorized camera directly
      let preferredDeviceId = readStorage(`${CAMERA_DEVICE_PREFIX}${mode}`);
      if (permissionGranted && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
          if (
            preferredDeviceId &&
            !videoDevices.some((d) => d.deviceId === preferredDeviceId)
          ) {
            preferredDeviceId = null;
          }
        } catch {
          // Ignore enumerateDevices failure and proceed with facingMode
        }
      }

      const primaryConstraints: MediaTrackConstraints = preferredDeviceId
        ? { deviceId: { ideal: preferredDeviceId } }
        : { facingMode: { ideal: mode } };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: primaryConstraints,
          audio: false,
        });
      } catch (err: unknown) {
        const errName = err instanceof Error ? err.name : '';
        // Never re-prompt when the user denied or dismissed camera access
        if (
          errName === 'NotAllowedError' ||
          errName === 'PermissionDeniedError' ||
          errName === 'SecurityError'
        ) {
          throw err;
        }
        // Only fall back to generic video constraints if specific camera/facingMode failed
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      const activeTrack = stream.getVideoTracks()[0];
      const activeDeviceId = activeTrack?.getSettings()?.deviceId;
      setPermissionGranted(true);
      writeStorage(CAMERA_GRANTED_KEY, 'true');
      if (activeDeviceId) {
        writeStorage(`${CAMERA_DEVICE_PREFIX}${mode}`, activeDeviceId);
      }

      streamRef.current = stream;
      setCameraOpen(true);

      // Also attach immediately if already mounted (e.g., camera flip)
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setPermissionGranted(false);
        writeStorage(CAMERA_GRANTED_KEY, null);
        setCameraError(
          'Camera access was denied. Allow camera permission in your browser or upload an image file.'
        );
      } else {
        setCameraError(
          'Could not access camera device. Please check your webcam or upload a photo.'
        );
      }
      setCameraOpen(false);
    } finally {
      setStartingCamera(false);
    }
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const dataUrl = resizeCanvasToJpeg(
      video,
      video.videoWidth,
      video.videoHeight,
      facingMode === 'user'
    );
    if (dataUrl) {
      onChange(dataUrl);
    }
    stopStream();
    setCameraOpen(false);
  };

  const handleFlipCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    stopStream();
    // Give Android/iOS hardware camera brief time to release before reopening opposite lens
    await new Promise((resolve) => setTimeout(resolve, 180));
    await startCamera(nextMode);
  };

  const handleCloseCamera = () => {
    stopStream();
    setCameraOpen(false);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);

    if (file.size > 25 * 1024 * 1024) {
      setCameraError('Please select an image smaller than 25 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const img = new Image();
      img.onload = () => {
        const compressed = resizeCanvasToJpeg(img, img.width, img.height);
        onChange(compressed || (reader.result as string));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
      <div className="flex flex-wrap items-center gap-4">
        {value ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            title="Click to view full face photo"
            aria-label="View full member photo preview"
            className="shrink-0 cursor-zoom-in rounded-xl transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <img
              src={value}
              alt="Member profile preview"
              className="h-20 w-20 rounded-xl border-2 border-emerald-500 object-cover shadow-xs"
            />
          </button>
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white text-neutral-400 shrink-0">
            <User className="h-7 w-7" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-xs font-semibold text-neutral-900">
              {label}
            </p>
            <p className="text-xs text-neutral-500">
              {value ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  {readyLabel}
                </span>
              ) : (
                'Upload from device or capture live using your camera'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-100 whitespace-nowrap">
              <Upload className="h-3.5 w-3.5 text-emerald-600" />
              <span>{value ? 'Upload New' : 'Upload Photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              disabled={startingCamera}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-neutral-950 to-emerald-950 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
            >
              <Camera className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                {startingCamera
                  ? 'Starting Camera...'
                  : value
                  ? 'Retake with Camera'
                  : 'Use Camera'}
              </span>
            </button>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-100 whitespace-nowrap sm:hidden">
              <Camera className="h-3.5 w-3.5 text-emerald-600" />
              <span>Phone Camera</span>
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {cameraError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>{cameraError}</span>
          <label className="inline-flex cursor-pointer items-center gap-1 font-semibold text-emerald-700 underline whitespace-nowrap">
            <span>Open Device Camera</span>
            <input
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Dedicated Full-Visibility Camera Modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3.5">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Capture Profile Photo
                </h4>
                <p className="text-xs text-emerald-400">
                  Position face inside the frame and click Capture
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseCamera}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                aria-label="Close camera"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative h-72 w-full bg-black sm:h-80">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`h-full w-full object-contain ${
                  facingMode === 'user' ? '-scale-x-100' : ''
                }`}
              />

              {!videoReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950/90 text-xs text-neutral-300">
                  <Camera className="h-6 w-6 text-emerald-400" />
                  <span>Initializing live camera feed...</span>
                </div>
              )}

              {/* Subtle Framing Guide */}
              {videoReady && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <div className="h-48 w-48 rounded-2xl border-2 border-dashed border-emerald-400/60" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 px-5 py-4">
              <button
                type="button"
                onClick={handleFlipCamera}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3.5 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 whitespace-nowrap"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Flip Camera
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseCamera}
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={!videoReady}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                >
                  <Camera className="h-4 w-4" />
                  Capture Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PhotoPreviewModal
        photo={
          previewOpen && value
            ? {
                src: value,
                name: previewTitle,
                subtitle: 'Captured / Uploaded Preview',
              }
            : null
        }
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
