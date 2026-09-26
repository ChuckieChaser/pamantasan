// --- IMPORTS ---
import { useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, Camera, CheckCircle2, RotateCcw, Send, Upload } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadingSpinner } from '../components/feedback/LoadingSpinner';
import { submitMobileScan } from '../features/document/services/ocrService';
import logoImage from '../assets/logo.jpg';


// --- COMPONENTS ---
export const MobileSyncCapturePage = () => {
    const { sessionId } = useParams();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const [capturedImage, setCapturedImage] = useState(null);
    const [capturedFile, setCapturedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [sentCount, setSentCount] = useState(0);

    const isUrlInvalid = !sessionId || !token;

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCapturedFile(file);
        setErrorMessage(null);
        setSuccessMessage(null);

        const reader = new FileReader();
        reader.onload = (event) => {
            setCapturedImage(event.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleRetake = () => {
        setCapturedImage(null);
        setCapturedFile(null);
        setErrorMessage(null);
        setSuccessMessage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handleUpload = async () => {
        if (!capturedFile || isUploading) return;

        setIsUploading(true);
        setErrorMessage(null);
        try {
            await submitMobileScan({
                sessionId,
                token,
                file: capturedFile,
            });

            setSentCount((prev) => prev + 1);
            setSuccessMessage('Page successfully streamed to desktop repository!');
            setCapturedImage(null);
            setCapturedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
        } catch (err) {
            setErrorMessage(err?.message || 'Failed to submit document capture.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-between p-4 sm:p-6 bg-background text-text select-none">
            {/* Header */}
            <div className="w-full max-w-md flex items-center justify-between py-2 border-b border-surface-border">
                <div className="flex items-center gap-2.5">
                    <img src={logoImage} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
                    <div>
                        <h1 className="text-sm font-bold text-text">Pamantasan Mobile Sync</h1>
                        <p className="text-[11px] text-text-muted">Live Document Scanner</p>
                    </div>
                </div>
                {sentCount > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        {sentCount} {sentCount === 1 ? 'Page' : 'Pages'} Synced
                    </span>
                )}
            </div>

            {/* Main Area */}
            <div className="w-full max-w-md my-auto py-6 flex flex-col gap-5">
                {isUrlInvalid ? (
                    <Card className="p-6 text-center flex flex-col items-center gap-3">
                        <AlertCircle className="h-10 w-10 text-error" />
                        <h2 className="text-base font-bold text-text">Invalid Scanner Session</h2>
                        <p className="text-xs text-text-muted">
                            Please scan the QR code displayed in the desktop document uploader to connect your phone.
                        </p>
                    </Card>
                ) : (
                    <>
                        {/* Hidden file inputs */}
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {/* Capture View / Preview */}
                        {!capturedImage ? (
                            <div className="flex flex-col gap-4">
                                <Card
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-accent border-2 border-dashed border-surface-border text-center transition-colors active:scale-98"
                                >
                                    <div className="h-16 w-16 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                                        <Camera className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-text block">
                                            Take Document Photo
                                        </span>
                                        <span className="text-xs text-text-muted">
                                            Align edges within camera frame
                                        </span>
                                    </div>
                                </Card>

                                <Button
                                    variant="secondary"
                                    leadingIcon={Upload}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full"
                                >
                                    Select from Photo Gallery
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="relative rounded-2xl overflow-hidden border border-surface-border bg-black max-h-[60vh] flex items-center justify-center">
                                    <img
                                        src={capturedImage}
                                        alt="Scanned Preview"
                                        className="w-full h-auto max-h-[60vh] object-contain"
                                    />
                                </div>

                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="secondary"
                                        leadingIcon={RotateCcw}
                                        onClick={handleRetake}
                                        disabled={isUploading}
                                        className="flex-1"
                                    >
                                        Retake
                                    </Button>

                                    <Button
                                        variant="primary"
                                        leadingIcon={Send}
                                        onClick={handleUpload}
                                        isLoading={isUploading}
                                        className="flex-1"
                                    >
                                        Send to Desktop
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Feedback messages */}
                        {successMessage && (
                            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-xs">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                <span>{successMessage}</span>
                            </div>
                        )}

                        {errorMessage && (
                            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-error/10 border border-error/20 text-error text-xs">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{errorMessage}</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="w-full max-w-md py-2 text-center text-[11px] text-text-muted border-t border-surface-border">
                Connected to encrypted Cloud Session
            </div>
        </div>
    );
};
