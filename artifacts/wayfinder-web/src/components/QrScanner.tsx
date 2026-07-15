import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Props {
  /** Called once with the decoded QR text (scanner stops itself). */
  onResult: (text: string) => void;
  onClose: () => void;
}

/**
 * Full-screen in-browser QR scanner: rear camera via getUserMedia, frames
 * decoded with jsQR on a canvas. Lets a visitor scan an entrance poster
 * from inside the app (instead of the iPhone camera app).
 */
export function QrScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      const video = videoRef.current;
      if (!done && video && ctx && video.readyState >= video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          done = true;
          onResult(code.data);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available in this browser.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => undefined);
        }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setError('Camera access was denied. Allow camera access and try again.'));

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />

      {/* Viewfinder frame */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-3xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
      </div>

      <div className="relative z-10 p-4 safe-area-pt flex justify-end">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full bg-black/50 backdrop-blur-md text-white border-white/10 hover:bg-black/70"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="relative z-10 mt-auto p-8 safe-area-pb text-center">
        {error ? (
          <p className="text-white/90 font-medium">{error}</p>
        ) : (
          <p className="text-white/80 font-medium">Point your camera at the entrance QR code</p>
        )}
      </div>
    </div>
  );
}
