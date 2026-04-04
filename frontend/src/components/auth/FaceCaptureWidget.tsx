import { useRef, useEffect, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { Loader2, CheckCircle2, XCircle, RefreshCw, ScanFace, Camera } from 'lucide-react';
import { Button } from '../ui/button';

type WidgetStatus =
  | 'loading-models' // downloading model weights
  | 'starting'       // getUserMedia in flight
  | 'detecting'      // camera live, scanning
  | 'locking'        // face found, counting down before capture
  | 'captured'       // descriptor ready
  | 'error';         // something went wrong

const MODELS_URL = '/models';
const LOCK_DELAY_MS = 1000; // ms of stable detection → auto-capture

interface FaceCaptureWidgetProps {
  onCapture: (descriptor: number[]) => void;
  onCancel?: () => void;
  /** login: auto-submits on capture. register: shows Confirm / Retake buttons */
  mode?: 'login' | 'register';
}

// Cache model loads so repeated mounts don't re-download
let modelsLoaded = false;
const loadModels = (() => {
  let p: Promise<void> | null = null;
  return () => {
    if (!p) {
      p = Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
      ]).then(() => { modelsLoaded = true; });
    }
    return p;
  };
})();

export default function FaceCaptureWidget({
  onCapture,
  onCancel,
  mode = 'login',
}: FaceCaptureWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<WidgetStatus>(modelsLoaded ? 'starting' : 'loading-models');
  const [errorMsg, setErrorMsg] = useState('');
  const [faceInFrame, setFaceInFrame] = useState(false);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);

  // ── Stop everything ───────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    if (lockTimerRef.current) { clearTimeout(lockTimerRef.current); lockTimerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, []);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setStatus('starting');
    setFaceInFrame(false);
    setCapturedDescriptor(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus('detecting');
    } catch (err: any) {
      setStatus('error');
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErrorMsg('Camera access denied. Please allow camera access in your browser settings.');
      } else if (err?.name === 'NotFoundError') {
        setErrorMsg('No camera found. Please connect a camera and try again.');
      } else {
        setErrorMsg('Could not activate camera. Please try again.');
      }
    }
  }, []);

  // ── Load models then auto-start camera ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (modelsLoaded) {
      startCamera();
      return;
    }
    loadModels()
      .then(() => { if (!cancelled) startCamera(); })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg('Could not load face recognition models. Please refresh and try again.');
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => stopAll(), [stopAll]);

  // ── Detection loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'detecting' && status !== 'locking') return;

    const detect = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const result = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      // Draw overlay on canvas
      const canvas = canvasRef.current;
      if (canvas && video) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (result) {
          const resized = faceapi.resizeResults(result, { width: video.videoWidth, height: video.videoHeight });
          const { x, y, width, height } = resized.detection.box;
          const isLocking = status === 'locking';

          // Box
          ctx.strokeStyle = isLocking ? '#22c55e' : '#3b82f6';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, width, height);

          // Corner accents
          const cl = 20;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4;
          const corners: [number, number, number, number][] = [
            [x, y, 1, 1], [x + width, y, -1, 1],
            [x, y + height, 1, -1], [x + width, y + height, -1, -1],
          ];
          corners.forEach(([cx, cy, dx, dy]) => {
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * cl, cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + dy * cl); ctx.stroke();
          });

          // Score bar
          const score = Math.round(resized.detection.score * 100);
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(x, y - 24, 70, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px sans-serif';
          ctx.fillText(`Face ${score}%`, x + 4, y - 8);
        }
      }

      const hasFace = !!result;
      setFaceInFrame(hasFace);

      if (hasFace && status === 'detecting') {
        setStatus('locking');
        lockTimerRef.current = setTimeout(() => {
          if (result) {
            const desc = Array.from(result.descriptor);
            setCapturedDescriptor(desc);
            stopAll();
            setStatus('captured');
            if (mode === 'login') onCapture(desc);
          }
        }, LOCK_DELAY_MS);
      } else if (!hasFace && status === 'locking') {
        if (lockTimerRef.current) { clearTimeout(lockTimerRef.current); lockTimerRef.current = null; }
        setStatus('detecting');
      }
    };

    loopRef.current = setInterval(detect, 200);
    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, [status, mode, onCapture, stopAll]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const cameraVisible = status === 'starting' || status === 'detecting' || status === 'locking';

  const retry = () => {
    stopAll();
    setCapturedDescriptor(null);
    setFaceInFrame(false);
    startCamera();
  };

  // ── Banner ────────────────────────────────────────────────────────────────
  const Banner = ({ icon, text, color }: { icon: React.ReactNode; text: string; color: 'blue' | 'green' | 'red' | 'gray' }) => {
    const cls = {
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      green: 'bg-green-50 text-green-700 border-green-200',
      red: 'bg-red-50 text-red-700 border-red-200',
      gray: 'bg-slate-50 text-slate-600 border-slate-200',
    }[color];
    return (
      <div className={`flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${cls}`}>
        {icon} <span>{text}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Camera viewport */}
      <div
        className="relative w-full rounded-2xl overflow-hidden bg-slate-900 shadow-inner"
        style={{ aspectRatio: '4/3', maxHeight: 300 }}
      >
        {/* Live feed */}
        <video
          ref={videoRef}
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: cameraVisible ? 'block' : 'none', transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ display: cameraVisible ? 'block' : 'none', transform: 'scaleX(-1)' }}
        />

        {/* Idle / result overlay */}
        {!cameraVisible && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            {status === 'loading-models' && (
              <>
                <Loader2 size={40} className="animate-spin text-blue-400" />
                <p className="text-sm text-white/70">Loading face recognition…</p>
              </>
            )}
            {status === 'captured' && (
              <>
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 size={48} className="text-green-400" />
                </div>
                <p className="text-sm font-medium text-green-300">Face captured</p>
              </>
            )}
            {status === 'error' && (
              <>
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle size={48} className="text-red-400" />
                </div>
                <p className="text-xs text-red-300 text-center px-6">{errorMsg}</p>
              </>
            )}
          </div>
        )}

        {/* Starting spinner overlay */}
        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 z-10">
            <Loader2 size={36} className="animate-spin text-blue-400" />
            <p className="text-sm text-white/70">Activating camera…</p>
          </div>
        )}

        {/* Locking animation ring */}
        {status === 'locking' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div className="w-32 h-32 rounded-full border-4 border-green-400 animate-ping opacity-25" />
          </div>
        )}

        {/* Top-left status chip */}
        {(status === 'detecting' || status === 'locking') && (
          <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold z-20
            ${status === 'locking' ? 'bg-green-500 text-white' : faceInFrame ? 'bg-blue-500 text-white' : 'bg-black/50 text-white/80'}`}>
            {status === 'locking'
              ? <><Loader2 size={12} className="animate-spin" /> Hold still…</>
              : faceInFrame
                ? <><ScanFace size={12} /> Face detected</>
                : <><Camera size={12} /> Position your face</>
            }
          </div>
        )}
      </div>

      {/* Status banner */}
      {status === 'error' && (
        <Banner icon={<XCircle size={16} />} text={errorMsg} color="red" />
      )}
      {status === 'captured' && mode === 'register' && (
        <Banner icon={<CheckCircle2 size={16} />} text="Face captured! Click Confirm to save, or Retake to redo." color="green" />
      )}
      {status === 'captured' && mode === 'login' && (
        <Banner icon={<CheckCircle2 size={16} />} text="Face recognised — logging in…" color="green" />
      )}

      {/* Action buttons */}
      <div className="flex gap-2 w-full">
        {status === 'error' && (
          <Button type="button" onClick={retry} className="flex-1 h-11 rounded-xl font-semibold bg-[#1F3A8A] hover:bg-[#172c6e] text-white">
            <RefreshCw size={16} className="mr-2" /> Try Again
          </Button>
        )}

        {status === 'captured' && mode === 'register' && (
          <>
            <Button type="button" variant="outline" onClick={retry} className="flex-1 h-11 rounded-xl">
              <RefreshCw size={15} className="mr-1.5" /> Retake
            </Button>
            <button
              type="button"
              onClick={() => { if (capturedDescriptor) onCapture(capturedDescriptor); }}
              className="flex-1 h-11 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors"
              style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#15803d')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#16a34a')}
            >
              <CheckCircle2 size={16} /> Confirm
            </button>
          </>
        )}

        {status === 'captured' && mode === 'login' && (
          <Button type="button" variant="outline" onClick={retry} className="flex-1 h-11 rounded-xl">
            <RefreshCw size={15} className="mr-1.5" /> Try Again
          </Button>
        )}

        {onCancel && status !== 'starting' && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => { stopAll(); onCancel(); }}
            className="h-11 px-4 rounded-xl text-slate-500 hover:text-slate-700"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
