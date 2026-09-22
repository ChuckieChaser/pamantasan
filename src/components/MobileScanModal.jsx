// --- IMPORTS ---
import { useState, useEffect, useRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
    Smartphone,
    CheckCircle2,
    Copy,
    Check,
    Loader2,
    RefreshCw,
    X,
    Sparkles,
    ShieldCheck,
    Camera,
    Wifi,
} from 'lucide-react';
import { mobileScanService } from '../services/mobileScanService';

export const MobileScanModal = ({
    isOpen,
    onClose,
    onImageReceived,
    currentFolderLabel = 'Current Folder',
}) => {
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const [loading, setLoading] = useState(true);
    const [sessionData, setSessionData] = useState(null);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [receivedCount, setReceivedCount] = useState(0);
    const [lastReceivedName, setLastReceivedName] = useState('');
    const [lanHost, setLanHost] = useState(isLocalhost ? '192.186.57.9:5173' : '');
    const unsubscribeReference = useRef(null);
    const onImageReceivedRef = useRef(onImageReceived);
    const activeSessionIdRef = useRef(null);

    useEffect(() => {
        onImageReceivedRef.current = onImageReceived;
    }, [onImageReceived]);

    const activeSyncUrl = useMemo(() => {
        if (!sessionData?.sessionId || !sessionData?.token) return '';
        if (isLocalhost && lanHost.trim()) {
            const protocol = window.location.protocol;
            return `${protocol}//${lanHost.trim()}/mobile-sync/${sessionData.sessionId}?token=${sessionData.token}`;
        }
        return sessionData.syncUrl || '';
    }, [sessionData, lanHost, isLocalhost]);

    // Initialize session asynchronously when modal opens
    useEffect(() => {
        let isMounted = true;

        if (!isOpen) {
            if (unsubscribeReference.current) {
                unsubscribeReference.current();
                unsubscribeReference.current = null;
            }
            if (activeSessionIdRef.current) {
                mobileScanService.closeSession(activeSessionIdRef.current);
                activeSessionIdRef.current = null;
            }
            return;
        }

        const startSession = async () => {
            try {
                const data = await mobileScanService.createSession();
                if (!isMounted) return;

                activeSessionIdRef.current = data.sessionId;
                setSessionData(data);
                setError(null);
                setLoading(false);

                if (unsubscribeReference.current) {
                    unsubscribeReference.current();
                }

                unsubscribeReference.current = mobileScanService.listenToSession(
                    data.sessionId,
                    (scanResult) => {
                        if (!isMounted) return;
                        setReceivedCount((prev) => prev + 1);
                        setLastReceivedName(scanResult.fileName);
                        if (onImageReceivedRef.current) {
                            onImageReceivedRef.current(scanResult.file);
                        }
                    },
                    (err) => {
                        console.error('[MobileScanModal] Realtime error:', err);
                    }
                );
            } catch (err) {
                if (!isMounted) return;
                console.error('[MobileScanModal] Session initialization failed:', err);
                const raw = err?.message || '';
                const displayMsg = raw.includes('INTERNAL')
                    ? 'Connection reset while starting pairing session. Click Try Again.'
                    : raw || 'Could not create mobile pairing session.';
                setError(displayMsg);
                setLoading(false);
            }
        };

        startSession();

        return () => {
            isMounted = false;
            if (unsubscribeReference.current) {
                unsubscribeReference.current();
            }
        };
    }, [isOpen]);


    const handleRefreshSession = async () => {
        setLoading(true);
        setError(null);
        setReceivedCount(0);
        setLastReceivedName('');

        try {
            const data = await mobileScanService.createSession();
            setSessionData(data);

            if (unsubscribeReference.current) {
                unsubscribeReference.current();
            }

            unsubscribeReference.current = mobileScanService.listenToSession(
                data.sessionId,
                (scanResult) => {
                    setReceivedCount((prev) => prev + 1);
                    setLastReceivedName(scanResult.fileName);
                    if (onImageReceivedRef.current) {
                        onImageReceivedRef.current(scanResult.file);
                    }
                },
                (err) => {
                    console.error('[MobileScanModal] Realtime error:', err);
                }
            );
        } catch (err) {
            const raw = err?.message || '';
            const displayMsg = raw.includes('INTERNAL')
                ? 'Connection reset while starting pairing session. Click Try Again.'
                : raw || 'Could not refresh session.';
            setError(displayMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = async () => {
        const targetUrl = activeSyncUrl || sessionData?.syncUrl;
        if (!targetUrl) return;
        try {
            await navigator.clipboard.writeText(targetUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);

        } catch {
            // Fallback for browsers blocking clipboard
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-md rounded-2xl bg-surface border border-surface-border shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-hover/30">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30">
                            <Smartphone className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-text">Scan with Phone Camera</h3>
                            <p className="text-[11px] text-text-muted">Direct wireless capture & OCR</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                        title="Close scanner modal"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 flex flex-col items-center text-center gap-4">
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-3 text-text-muted">
                            <Loader2 className="h-8 w-8 animate-spin text-accent" />
                            <span className="text-xs font-medium">Generating secure pairing session...</span>
                        </div>
                    ) : error ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-3 text-error">
                            <p className="text-xs font-medium max-w-xs">{error}</p>
                            <button
                                type="button"
                                onClick={handleRefreshSession}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-surface-border hover:bg-surface-hover text-xs font-semibold text-text cursor-pointer transition-colors"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                <span>Try Again</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* QR Code Container */}
                            <div className="p-4 rounded-2xl bg-white border border-surface-border shadow-md flex items-center justify-center">
                                <QRCodeSVG
                                    value={activeSyncUrl || ''}
                                    size={180}
                                    level="M"
                                    includeMargin={false}
                                />
                            </div>

                            {/* Optional Local LAN Helper for dev mode */}
                            {isLocalhost && (
                                <div className="w-full px-2.5 py-1.5 rounded-lg bg-surface-hover/60 border border-surface-border flex items-center justify-between gap-2 text-[11px]">
                                    <span className="text-text-muted shrink-0 flex items-center gap-1 font-medium">
                                        <Wifi className="h-3 w-3 text-accent" />
                                        <span>Phone Wi-Fi Host:</span>
                                    </span>
                                    <input
                                        type="text"
                                        value={lanHost}
                                        onChange={(e) => setLanHost(e.target.value)}
                                        placeholder="192.168.x.x:5173"
                                        className="flex-1 max-w-[150px] px-2 py-0.5 text-xs rounded bg-surface border border-surface-border text-text font-mono focus:outline-none focus:border-accent text-center"
                                        title="Local IP address so your phone can reach this computer over local Wi-Fi"
                                    />
                                </div>
                            )}

                            {/* Status Indicator */}
                            <div className="flex flex-col items-center gap-1.5 w-full">
                                {receivedCount > 0 ? (
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/15 border border-success/30 text-success text-xs font-semibold animate-in zoom-in-95">
                                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                                        <span>
                                            {receivedCount} {receivedCount === 1 ? 'photo' : 'photos'} received!
                                            {lastReceivedName ? ` (${lastReceivedName})` : ''}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-medium">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                                        </span>
                                        <span>Ready • Scan with camera app</span>
                                    </div>
                                )}

                                <p className="text-[11px] text-text-muted max-w-xs mt-1 leading-relaxed">
                                    Open your phone camera, point it at this QR code, and snap the physical document. Photos transfer instantly into <strong className="text-text font-medium">{currentFolderLabel}</strong>.
                                </p>
                            </div>

                            {/* Features highlights */}
                            <div className="grid grid-cols-2 gap-2 w-full pt-1">
                                <div className="p-2.5 rounded-xl bg-surface-hover/50 border border-surface-border flex items-center gap-2 text-left">
                                    <Camera className="h-4 w-4 text-accent shrink-0" />
                                    <span className="text-[10px] text-text-muted leading-tight">
                                        Native smartphone camera resolution
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-surface-hover/50 border border-surface-border flex items-center gap-2 text-left">
                                    <ShieldCheck className="h-4 w-4 text-success shrink-0" />
                                    <span className="text-[10px] text-text-muted leading-tight">
                                        No phone login or app install required
                                    </span>
                                </div>
                            </div>

                            {/* Action Bar: Copy Link / Refresh */}
                            <div className="flex items-center justify-between w-full pt-2 border-t border-surface-border">
                                <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors cursor-pointer"
                                    title="Copy mobile link to clipboard"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="h-3.5 w-3.5 text-success" />
                                            <span className="text-success font-medium">Link Copied</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3.5 w-3.5" />
                                            <span>Copy Scanner Link</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleRefreshSession}
                                    className="flex items-center gap-1 text-[11px] text-text-muted hover:text-accent transition-colors cursor-pointer"
                                    title="Refresh pairing session"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    <span>New QR</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-surface-hover/40 border-t border-surface-border flex items-center justify-between">
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-accent" />
                        Auto-whitened & OCR converted
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg bg-accent text-text-inverted text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                    >
                        {receivedCount > 0 ? 'Done • View Staged' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileScanModal;
