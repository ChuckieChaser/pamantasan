// --- IMPORTS ---
import { useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
    Camera,
    Upload,
    CheckCircle2,
    RotateCcw,
    Send,
    Loader2,
    AlertCircle,
    Building2,
} from 'lucide-react';
import { mobileScanService } from '../services/mobileScanService';

export const MobileSyncCapturePage = () => {
    const { sessionId } = useParams();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const cameraInputReference = useRef(null);
    const galleryInputReference = useRef(null);

    const [capturedImage, setCapturedImage] = useState(null);
    const [capturedFileName, setCapturedFileName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [sentCount, setSentCount] = useState(0);

    const urlError = (!sessionId || !token)
        ? 'Invalid scanner link. Please scan the QR code from your desktop computer.'
        : null;

    const activeError = errorMessage || urlError;


    // Helper: Resize and compress image on canvas to ensure rapid transfer and avoid exceeding payload limits
    const compressAndEncodeImage = (file, maxDimension = 2048, quality = 0.85) => {
        return new Promise((resolve) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                let { width, height } = img;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                // Fallback to FileReader if canvas fails
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve('');
            };

            img.src = objectUrl;
        });
    };

    const handleFileSelected = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const base64Data = await compressAndEncodeImage(file);
            if (!base64Data) {
                throw new Error('Image compression returned empty data');
            }
            setCapturedImage(base64Data);
            setCapturedFileName(file.name || `mobile_scan_${Date.now()}.jpg`);
        } catch {
            setErrorMessage('Could not process captured image. Please try again.');
        } finally {
            if (event.target) {
                event.target.value = '';
            }
        }
    };

    const handleSendToDesktop = async () => {
        if (!capturedImage || !sessionId || !token) return;

        setUploading(true);
        setErrorMessage(null);

        try {
            await mobileScanService.submitScan({
                sessionId,
                token,
                imageBase64: capturedImage,
                fileName: capturedFileName || `scan_page_${sentCount + 1}.jpg`,
            });

            // Trigger device haptic vibration if supported
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([100, 50, 150]);
            }

            setSentCount((prev) => prev + 1);
            setSuccessMessage(`Page ${sentCount + 1} sent to desktop!`);
            setCapturedImage(null);
        } catch (err) {
            console.error('[MobileSyncCapturePage] Upload error:', err);
            const raw = err?.message || '';
            const friendly = raw.includes('INTERNAL')
                ? 'Server connection blip while uploading. Please tap Send to PC again.'
                : raw || 'Failed to send image to desktop. Please try again.';
            setErrorMessage(friendly);
        } finally {
            setUploading(false);
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
        setErrorMessage(null);
        setSuccessMessage(null);
        cameraInputReference.current?.click();
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none">
            {/* Hidden Camera & Gallery Inputs */}
            <input
                ref={cameraInputReference}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelected}
                className="hidden"
            />
            <input
                ref={galleryInputReference}
                type="file"
                accept="image/*"
                onChange={handleFileSelected}
                className="hidden"
            />

            {/* Header */}
            <header className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/60 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center text-white shadow-md font-bold text-sm">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                            Pamantasan Scanner
                        </h1>
                        <p className="text-[11px] text-neutral-400">Wireless Mobile Camera Sync</p>
                    </div>
                </div>

                {sentCount > 0 && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{sentCount} {sentCount === 1 ? 'page' : 'pages'}</span>
                    </div>
                )}
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col items-center justify-center p-5 max-w-md mx-auto w-full">
                {activeError && (
                    <div className="w-full mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{activeError}</span>
                    </div>
                )}

                {successMessage && (
                    <div className="w-full mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span className="font-semibold">{successMessage}</span>
                    </div>
                )}

                {/* State 1: Photo Preview Mode */}
                {capturedImage ? (
                    <div className="w-full flex flex-col items-center gap-5 animate-in zoom-in-95">
                        <div className="relative w-full aspect-3/4 rounded-2xl overflow-hidden border-2 border-accent shadow-2xl bg-neutral-900 flex items-center justify-center">
                            <img
                                src={capturedImage}
                                alt="Document Scan Preview"
                                className="w-full h-full object-contain"
                            />
                            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-neutral-300 font-medium border border-white/10">
                                Ready to Transfer
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3 w-full">
                            <button
                                type="button"
                                onClick={handleRetake}
                                disabled={uploading}
                                className="py-3.5 px-4 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-300 text-sm font-semibold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                <RotateCcw className="h-4 w-4" />
                                <span>Retake</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleSendToDesktop}
                                disabled={uploading}
                                className="py-3.5 px-4 rounded-xl bg-accent text-white text-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-accent/25 disabled:opacity-50"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        <span>Send to PC</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* State 2: Camera Viewfinder / Trigger */
                    <div className="w-full flex flex-col items-center gap-6 text-center">
                        <div
                            onClick={() => cameraInputReference.current?.click()}
                            className="relative w-full aspect-3/4 rounded-2xl border-2 border-dashed border-neutral-700 hover:border-accent bg-neutral-900/80 hover:bg-neutral-900 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer p-6 shadow-xl group"
                        >
                            {/* Document Corner Framing Guides */}
                            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-accent/80 rounded-tl-md"></div>
                            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-accent/80 rounded-tr-md"></div>
                            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-accent/80 rounded-bl-md"></div>
                            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-accent/80 rounded-br-md"></div>

                            <div className="h-20 w-20 rounded-full bg-accent/15 border-2 border-accent flex items-center justify-center text-accent group-hover:scale-105 transition-transform shadow-lg shadow-accent/20">
                                <Camera className="h-9 w-9" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <span className="text-base font-bold text-white">
                                    {sentCount > 0 ? 'Snap Next Page' : 'Tap to Open Camera'}
                                </span>
                                <span className="text-xs text-neutral-400 max-w-xs">
                                    Position your phone over the document under good lighting
                                </span>
                            </div>

                            <span className="px-3 py-1 rounded-full bg-neutral-800 text-[11px] text-neutral-300 font-medium border border-neutral-700">
                                Auto-whitened on transfer
                            </span>
                        </div>

                        {/* Alternate Action: Choose from Library */}
                        <div className="flex items-center justify-center gap-3 w-full">
                            <button
                                type="button"
                                onClick={() => galleryInputReference.current?.click()}
                                className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer py-1"
                            >
                                <Upload className="h-3.5 w-3.5" />
                                <span>Choose existing photo</span>
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="p-4 border-t border-neutral-800 bg-neutral-900/40 text-center">
                <p className="text-[11px] text-neutral-500">
                    Pamantasan ng Lungsod ng Pasig • Records Management System
                </p>
            </footer>
        </div>
    );
};

export default MobileSyncCapturePage;
