import { createPortal } from 'react-dom';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
    X,
    PenTool,
    Copy,
    Trash2,
    RotateCcw,
    RotateCw,
    ZoomIn,
    ZoomOut,
    ChevronLeft,
    ChevronRight,
    Plus,
    Lock,
    Sparkles,
    AlertCircle,
    Loader2,
    FileCheck2,
    Move,
    Clock,
    Check,
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { formatSignatoryName } from '../utils/fileNameUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const ROTATE_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26' fill='none'%3E%3Cpath d='M6.5 5.5L2.5 9.5L6.5 13.5' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M3.5 9.5C4.5 5.5 8.5 3 13.5 3C19 3 23 7 23 12.5C23 18 19 22 13.5 22C8.5 22 5 19 4 15.5' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M6.5 5.5L2.5 9.5L6.5 13.5' stroke='%230f172a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M3.5 9.5C4.5 5.5 8.5 3 13.5 3C19 3 23 7 23 12.5C23 18 19 22 13.5 22C8.5 22 5 19 4 15.5' stroke='%230f172a' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 10 10, crosshair`;

const OfficerSignatureStampModal = ({
    isOpen,
    onClose,
    documentItem,
    shareItem,
    activeVersion,
    currentUser,
    effectiveIsMandatorySign: propIsMandatorySign = false,
    onConfirmApprove,
    isSubmitting = false,
    queue = null,
}) => {
    // 1. ALL STATE HOOKS AT TOP (strict React ordering)
    const [queueIndex, setQueueIndex] = useState(0);
    const [isStampEnabled, setIsStampEnabled] = useState(true);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [numPages, setNumPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1); // 1-based for UI
    const [zoomScale, setZoomScale] = useState(1.15);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);
    const [pdfError, setPdfError] = useState('');

    const [signatureUrl, setSignatureUrl] = useState('');
    const [signatureAspectRatio, setSignatureAspectRatio] = useState(2.6);
    const [isLoadingSignature, setIsLoadingSignature] = useState(false);
    const [signatureError, setSignatureError] = useState('');

    // Each stamp: { id, type ('signature'|'timestamp'), dateText, timeText, pageIndex (0-based), pageNumber (1-based), xRatio, yRatio, widthRatio, heightRatio, rotationDeg, aspectRatio }
    const [stamps, setStamps] = useState([]);
    const [selectedStampId, setSelectedStampId] = useState(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    const canvasRef = useRef(null);
    const pageContainerRef = useRef(null);
    const renderTaskRef = useRef(null);
    const interactionRef = useRef(null);

    // Derived current task from queue
    const currentTask = queue && queue.length > 0 ? queue[queueIndex] : null;
    const effectiveItem = currentTask?.item ?? documentItem;
    const effectiveShareRecord = currentTask?.shareRecord ?? shareItem;
    const effectiveActiveVersion = currentTask?.activeVersion ?? activeVersion;
    const effectiveIsMandatorySign = currentTask ? Boolean(currentTask.effectiveIsMandatorySign) : propIsMandatorySign;
    const effectiveNextVersionNumber = (effectiveActiveVersion?.version || 1) + 1;
    const effectiveStampEnabled = effectiveIsMandatorySign ? true : isStampEnabled;
    const signatoryName = formatSignatoryName(currentUser);

    // Reset queue index when modal opens
    useEffect(() => {
        if (isOpen) {
            setQueueIndex(0);
            setCurrentPage(1);
            setStamps([]);
            setCanvasSize({ width: 0, height: 0 });
            setPdfError('');
            setSignatureError('');
            setIsStampEnabled(true);
        }
    }, [isOpen, queue]);

    // Reset stamps and page on queue task transition
    useEffect(() => {
        setCurrentPage(1);
        setStamps([]);
        setCanvasSize({ width: 0, height: 0 });
        setSelectedStampId(null);
    }, [queueIndex]);

    // Body scroll lock while modal is open
    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen]);

    // Load Officer's transparent PNG signature
    useEffect(() => {
        if (!isOpen) return;
        const sigPath = currentUser?.signaturePath;
        if (!sigPath) {
            setSignatureUrl('');
            setSignatureError('No official signature found on your Officer profile. Please upload your signature in Account Settings first.');
            return;
        }

        let revoked = false;
        let objectUrl = '';
        setIsLoadingSignature(true);
        setSignatureError('');

        (async () => {
            try {
                const blob = await storageService.getFileBlob(sigPath);
                if (revoked) return;
                objectUrl = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    if (revoked) return;
                    const rawRatio = img.naturalWidth && img.naturalHeight
                        ? img.naturalWidth / img.naturalHeight
                        : 2.6;
                    const viewW = 360;
                    const sigH = Math.round(viewW / Math.max(1.2, rawRatio));
                    const nameH = signatoryName ? Math.max(42, Math.round(sigH * 0.30)) : 0;
                    const compositeRatio = Number((viewW / (sigH + nameH)).toFixed(4));
                    setSignatureAspectRatio(compositeRatio);
                    setSignatureUrl(objectUrl);
                    setIsLoadingSignature(false);

                    setStamps((prev) =>
                        prev.map((s) => {
                            if (s.type !== 'signature') return s;
                            const newHeight = computeHeightRatioForWidth(s.widthRatio, compositeRatio);
                            return {
                                ...s,
                                aspectRatio: compositeRatio,
                                heightRatio: newHeight,
                            };
                        })
                    );
                };
                img.onerror = () => {
                    if (revoked) return;
                    setSignatureUrl(objectUrl);
                    setIsLoadingSignature(false);
                };
                img.src = objectUrl;
            } catch (err) {
                if (revoked) return;
                console.error('Failed to load Officer signature blob:', err);
                setSignatureError('Unable to load your signature image from storage.');
                setIsLoadingSignature(false);
            }
        })();

        return () => {
            revoked = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [isOpen, currentUser?.signaturePath]);

    // Load PDF document via pdfjs-dist
    useEffect(() => {
        const pdfPath = effectiveActiveVersion?.path || effectiveItem?.path || effectiveItem?.storagePath;
        if (!isOpen) return;
        if (!pdfPath) {
            setPdfError('No PDF storage path found for this document.');
            return;
        }
        const isPdfDoc = /\.pdf(?:[?#]|$)/i.test(pdfPath) || String(effectiveActiveVersion?.mimeType || effectiveItem?.mimeType || '').includes('pdf');
        if (!isPdfDoc) {
            setPdfError('Signature stamping is only supported for PDF documents. Please approve non-PDF files directly.');
            return;
        }
        let cancelled = false;
        let loadedPdf = null;
        setIsLoadingPdf(true);
        setPdfError('');

        (async () => {
            try {
                const pdfBlob = await storageService.getFileBlob(pdfPath);
                if (cancelled) return;
                const arrayBuffer = await pdfBlob.arrayBuffer();
                if (cancelled) return;

                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                loadedPdf = await loadingTask.promise;
                if (cancelled) return;

                setPdfDoc(loadedPdf);
                setNumPages(loadedPdf.numPages || 1);
                setCurrentPage(1);
                setIsLoadingPdf(false);
            } catch (err) {
                if (cancelled) return;
                console.error('Failed to load PDF for signature stamping:', err);
                setPdfError(err?.message || 'Failed to render PDF preview.');
                setIsLoadingPdf(false);
            }
        })();

        return () => {
            cancelled = true;
            if (renderTaskRef.current) {
                try {
                    renderTaskRef.current.cancel();
                } catch {
                    // ignore
                }
            }
            if (loadedPdf) {
                try {
                    loadedPdf.destroy();
                } catch {
                    // ignore
                }
            }
        };
    }, [isOpen, effectiveActiveVersion?.path, effectiveItem?.path, effectiveItem?.storagePath]);

    // Render current PDF page onto <canvas>
    useEffect(() => {
        if (!isOpen || !pdfDoc || !canvasRef.current) return;
        let cancelled = false;

        (async () => {
            try {
                if (renderTaskRef.current) {
                    try {
                        renderTaskRef.current.cancel();
                    } catch {
                        // ignore
                    }
                }
                const page = await pdfDoc.getPage(currentPage);
                if (cancelled) return;

                const viewport = page.getViewport({ scale: zoomScale });
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');

                canvas.width = viewport.width;
                canvas.height = viewport.height;
                setCanvasSize({ width: viewport.width, height: viewport.height });

                const renderTask = page.render({
                    canvasContext: ctx,
                    viewport,
                });
                renderTaskRef.current = renderTask;
                await renderTask.promise;
            } catch (err) {
                if (err?.name !== 'RenderingCancelledException' && !cancelled) {
                    console.warn('PDF page render warning:', err);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isOpen, pdfDoc, currentPage, zoomScale]);

    // Initialize default stamp on current page when canvas size and signature aspect ratio are ready
    useEffect(() => {
        if (!isOpen || canvasSize.width <= 0 || canvasSize.height <= 0) return;
        setStamps((prev) => {
            if (prev.length > 0) return prev;
            const pageAspect = canvasSize.width / canvasSize.height;
            const defaultWidthRatio = 0.24;
            const defaultHeightRatio = clamp(
                (defaultWidthRatio * pageAspect) / (signatureAspectRatio || 2.5),
                0.04,
                0.35
            );
            const initialId = `stamp-${Date.now()}`;
            setSelectedStampId(initialId);
            const initialStamp = {
                id: initialId,
                type: 'signature',
                pageIndex: 0,
                pageNumber: 1,
                xRatio: 0.62,
                yRatio: clamp(0.78, 0.05, 1 - defaultHeightRatio - 0.04),
                widthRatio: defaultWidthRatio,
                heightRatio: defaultHeightRatio,
                aspectRatio: signatureAspectRatio || 2.5,
                rotationDeg: 0,
            };
            return [initialStamp];
        });
    }, [isOpen, canvasSize.width, canvasSize.height, signatureAspectRatio]);

    // Reset when modal closes
    useEffect(() => {
        if (!isOpen) {
            setStamps([]);
            setSelectedStampId(null);
            setPdfDoc(null);
        }
    }, [isOpen]);

    const computeHeightRatioForWidth = useCallback(
        (widthRatio, aspectRatio = null) => {
            const pageAspect =
                canvasSize.width > 0 && canvasSize.height > 0
                    ? canvasSize.width / canvasSize.height
                    : 0.77;
            const effRatio = aspectRatio || signatureAspectRatio || 2.5;
            return clamp(
                (widthRatio * pageAspect) / effRatio,
                0.03,
                0.8
            );
        },
        [canvasSize.width, canvasSize.height, signatureAspectRatio]
    );

    // Add a new stamp on current page
    const handleAddStampOnCurrentPage = useCallback(
        (template = null) => {
            const pageIdx = currentPage - 1;
            const isTs = template?.type === 'timestamp';
            const baseWidthRatio = template?.widthRatio ?? (isTs ? 0.22 : 0.24);
            const baseHeightRatio =
                template?.heightRatio ?? computeHeightRatioForWidth(baseWidthRatio, template?.aspectRatio || (isTs ? 2.8 : null));
            const baseRotation = template?.rotationDeg ?? 0;

            const existingOnPage = stamps.filter((s) => s.pageIndex === pageIdx);
            const offsetStep = (existingOnPage.length % 5) * 0.035;

            const baseX = template?.xRatio !== undefined ? template.xRatio + 0.035 : 0.58 + offsetStep;
            const baseY = template?.yRatio !== undefined ? template.yRatio + 0.035 : 0.72 + offsetStep;

            const newId = `${isTs ? 'ts' : 'stamp'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const newStamp = {
                id: newId,
                type: template?.type || 'signature',
                dateText: template?.dateText,
                timeText: template?.timeText,
                aspectRatio: template?.aspectRatio || (isTs ? 2.8 : signatureAspectRatio || 2.5),
                pageIndex: pageIdx,
                pageNumber: currentPage,
                xRatio: clamp(baseX, 0.02, 1 - baseWidthRatio - 0.02),
                yRatio: clamp(baseY, 0.02, 1 - baseHeightRatio - 0.02),
                widthRatio: baseWidthRatio,
                heightRatio: baseHeightRatio,
                rotationDeg: baseRotation,
            };

            setStamps((prev) => [...prev, newStamp]);
            setSelectedStampId(newId);
        },
        [currentPage, stamps, computeHeightRatioForWidth, signatureAspectRatio]
    );

    // Add a 2-line timestamp stamp
    const handleAddTimestampOnCurrentPage = useCallback(() => {
        const pageIdx = currentPage - 1;
        const now = new Date();
        const dateText = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const timeText = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        const baseWidthRatio = 0.22;
        const baseHeightRatio = computeHeightRatioForWidth(baseWidthRatio, 2.8);

        const existingOnPage = stamps.filter((s) => s.pageIndex === pageIdx);
        const offsetStep = (existingOnPage.length % 5) * 0.035;

        const newId = `ts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newStamp = {
            id: newId,
            type: 'timestamp',
            dateText,
            timeText,
            pageIndex: pageIdx,
            pageNumber: currentPage,
            xRatio: clamp(0.58 + offsetStep, 0.02, 1 - baseWidthRatio - 0.02),
            yRatio: clamp(0.72 + offsetStep, 0.02, 1 - baseHeightRatio - 0.02),
            widthRatio: baseWidthRatio,
            heightRatio: baseHeightRatio,
            aspectRatio: 2.8,
            rotationDeg: 0,
        };

        setStamps((prev) => [...prev, newStamp]);
        setSelectedStampId(newId);
    }, [currentPage, stamps, computeHeightRatioForWidth]);

    // Duplicate stamp
    const handleDuplicateStamp = useCallback(
        (stamp) => {
            if (!stamp) return;
            handleAddStampOnCurrentPage(stamp);
        },
        [handleAddStampOnCurrentPage]
    );

    // Resize stamp by factor
    const handleResizeStampByStep = useCallback(
        (stampId, scaleFactor) => {
            setStamps((prev) =>
                prev.map((s) => {
                    if (s.id !== stampId) return s;
                    const newWidthRatio = clamp(s.widthRatio * scaleFactor, 0.08, 0.75);
                    const newHeightRatio = computeHeightRatioForWidth(newWidthRatio, s.aspectRatio);
                    return {
                        ...s,
                        widthRatio: newWidthRatio,
                        heightRatio: newHeightRatio,
                        xRatio: clamp(s.xRatio, 0, 1 - newWidthRatio),
                        yRatio: clamp(s.yRatio, 0, 1 - newHeightRatio),
                    };
                })
            );
        },
        [computeHeightRatioForWidth]
    );

    // Rotate stamp by degrees
    const handleRotateStampByStep = useCallback((stampId, deltaDeg) => {
        setStamps((prev) =>
            prev.map((s) => {
                if (s.id !== stampId) return s;
                const nextRot = ((s.rotationDeg + deltaDeg + 540) % 360) - 180;
                return { ...s, rotationDeg: Math.round(nextRot) };
            })
        );
    }, []);

    const handleResetRotation = useCallback((stampId) => {
        setStamps((prev) =>
            prev.map((s) => (s.id === stampId ? { ...s, rotationDeg: 0 } : s))
        );
    }, []);

    const handleDeleteStamp = useCallback(
        (stampId) => {
            setStamps((prev) => {
                const filtered = prev.filter((s) => s.id !== stampId);
                if (selectedStampId === stampId) {
                    setSelectedStampId(filtered[filtered.length - 1]?.id ?? null);
                }
                return filtered;
            });
        },
        [selectedStampId]
    );

    // Pointer drag / resize / rotate interaction handler
    const startInteraction = (e, stamp, mode, corner = null) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedStampId(stamp.id);

        const containerRect = pageContainerRef.current?.getBoundingClientRect();
        if (!containerRect || containerRect.width <= 0 || containerRect.height <= 0) return;

        const centerX =
            containerRect.left + (stamp.xRatio + stamp.widthRatio / 2) * containerRect.width;
        const centerY =
            containerRect.top + (stamp.yRatio + stamp.heightRatio / 2) * containerRect.height;

        interactionRef.current = {
            mode,
            corner,
            stampId: stamp.id,
            startClientX: e.clientX,
            startClientY: e.clientY,
            containerRect,
            initialStamp: { ...stamp },
            centerX,
            centerY,
            startAngleRad: Math.atan2(e.clientY - centerY, e.clientX - centerX),
        };

        const handlePointerMove = (moveEvent) => {
            const state = interactionRef.current;
            if (!state) return;
            const {
                mode: activeMode,
                corner: activeCorner,
                stampId: activeId,
                startClientX,
                startClientY,
                containerRect: rect,
                initialStamp,
                centerX: cx,
                centerY: cy,
                startAngleRad,
            } = state;

            const dxRatio = (moveEvent.clientX - startClientX) / rect.width;
            const dyRatio = (moveEvent.clientY - startClientY) / rect.height;

            if (activeMode === 'move') {
                setStamps((prev) =>
                    prev.map((s) => {
                        if (s.id !== activeId) return s;
                        return {
                            ...s,
                            xRatio: clamp(initialStamp.xRatio + dxRatio, 0, 1 - s.widthRatio),
                            yRatio: clamp(initialStamp.yRatio + dyRatio, 0, 1 - s.heightRatio),
                        };
                    })
                );
            } else if (activeMode === 'resize') {
                const signX = activeCorner?.includes('w') ? -1 : 1;
                const newWidthRatio = clamp(
                    initialStamp.widthRatio + dxRatio * signX,
                    0.07,
                    0.75
                );
                const newHeightRatio = computeHeightRatioForWidth(newWidthRatio, initialStamp.aspectRatio);

                let nextXRatio = initialStamp.xRatio;
                let nextYRatio = initialStamp.yRatio;
                if (activeCorner?.includes('w')) {
                    nextXRatio =
                        initialStamp.xRatio + (initialStamp.widthRatio - newWidthRatio);
                }
                if (activeCorner?.includes('n')) {
                    nextYRatio =
                        initialStamp.yRatio + (initialStamp.heightRatio - newHeightRatio);
                }

                setStamps((prev) =>
                    prev.map((s) => {
                        if (s.id !== activeId) return s;
                        return {
                            ...s,
                            widthRatio: newWidthRatio,
                            heightRatio: newHeightRatio,
                            xRatio: clamp(nextXRatio, 0, 1 - newWidthRatio),
                            yRatio: clamp(nextYRatio, 0, 1 - newHeightRatio),
                        };
                    })
                );
            } else if (activeMode === 'rotate') {
                const currentAngleRad = Math.atan2(
                    moveEvent.clientY - cy,
                    moveEvent.clientX - cx
                );
                const deltaDeg = ((currentAngleRad - startAngleRad) * 180) / Math.PI;
                const rawRot = initialStamp.rotationDeg + deltaDeg;
                let normalizedRot = ((rawRot + 540) % 360) - 180;
                if (moveEvent.shiftKey) {
                    normalizedRot = Math.round(normalizedRot / 15) * 15;
                }
                setStamps((prev) =>
                    prev.map((s) =>
                        s.id === activeId
                            ? { ...s, rotationDeg: Math.round(normalizedRot) }
                            : s
                    )
                );
            }
        };

        const handlePointerUp = () => {
            interactionRef.current = null;
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    if (!isOpen) return null;

    const currentPageIndex = currentPage - 1;
    const stampsOnCurrentPage = stamps.filter((s) => s.pageIndex === currentPageIndex);
    const sigStampsCount = stamps.filter((s) => s.type !== 'timestamp').length;
    const canSubmitApproval =
        !isSubmitting &&
        (!effectiveStampEnabled ||
            (!isLoadingPdf &&
                !pdfError &&
                stamps.length > 0 &&
                (!effectiveIsMandatorySign || (Boolean(signatureUrl) && sigStampsCount > 0))));

    const modalNode = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-150"
            onClick={() => {
                if (!isSubmitting) onClose();
            }}
        >
            <div
                className="relative flex flex-col w-full max-w-5xl h-[92vh] rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-zinc-800/90 bg-zinc-900/70">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <PenTool className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-sm sm:text-base font-semibold text-zinc-100 truncate">
                                    Approve &amp; Stamp Official PDF
                                </h2>
                                {queue && queue.length > 1 && (
                                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                        Queue: {queueIndex + 1} of {queue.length}
                                    </span>
                                )}
                                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    v{effectiveActiveVersion?.version || 1}.0 →{' '}
                                    {effectiveStampEnabled
                                        ? `v${effectiveNextVersionNumber}.0 (Signed)`
                                        : `v${effectiveActiveVersion?.version || 1}.0`}
                                </span>
                                {effectiveIsMandatorySign && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        <Lock className="w-2.5 h-2.5" />
                                        Mandatory Signature
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">
                                {effectiveItem?.name || effectiveItem?.title || 'Document.pdf'}
                            </p>
                        </div>
                    </div>

                    {/* Stamp Official Signature Toggle */}
                    <div className="flex items-center gap-3">
                        <div
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-colors ${
                                effectiveStampEnabled
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                            }`}
                            title={
                                effectiveIsMandatorySign
                                    ? 'Mandatory signature required for this document.'
                                    : 'Toggle whether to stamp your signature onto this PDF.'
                            }
                        >
                            <button
                                type="button"
                                role="switch"
                                aria-checked={effectiveStampEnabled}
                                disabled={effectiveIsMandatorySign || isSubmitting}
                                onClick={() => {
                                    if (!effectiveIsMandatorySign) {
                                        setIsStampEnabled((prev) => !prev);
                                    }
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                    effectiveStampEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                                } ${
                                    effectiveIsMandatorySign
                                        ? 'cursor-not-allowed opacity-90'
                                        : 'cursor-pointer'
                                }`}
                            >
                                <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                        effectiveStampEnabled ? 'translate-x-4' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                            <div className="flex flex-col text-left">
                                <span className="text-xs font-medium leading-none flex items-center gap-1">
                                    Stamp Official Signature
                                    {effectiveIsMandatorySign && (
                                        <Lock className="w-3 h-3 text-amber-400 inline" />
                                    )}
                                </span>
                                <span className="text-[10px] text-zinc-400 mt-0.5">
                                    {effectiveIsMandatorySign
                                        ? 'Locked ON (Mandatory)'
                                        : effectiveStampEnabled
                                        ? 'ON — Creates signed version'
                                        : 'OFF — Approve without stamp'}
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={onClose}
                            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
                            title="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Secondary Toolbar: Page Navigation, Zoom, Add Signature & Add Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-zinc-800/80 bg-zinc-900/40 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/90 p-0.5">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage <= 1 || isLoadingPdf}
                                className="p-1.5 rounded-md text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
                                title="Previous Page"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2.5 font-medium text-zinc-300 select-none">
                                Page {currentPage} of {numPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                                disabled={currentPage >= numPages || isLoadingPdf}
                                className="p-1.5 rounded-md text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
                                title="Next Page"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/90 p-0.5">
                            <button
                                type="button"
                                onClick={() =>
                                    setZoomScale((z) => clamp(Number((z - 0.15).toFixed(2)), 0.7, 2.0))
                                }
                                className="p-1.5 rounded-md text-zinc-300 hover:bg-zinc-800"
                                title="Zoom Out"
                            >
                                <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 font-mono text-[11px] text-zinc-300 select-none">
                                {Math.round(zoomScale * 100)}%
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setZoomScale((z) => clamp(Number((z + 0.15).toFixed(2)), 0.7, 2.0))
                                }
                                className="p-1.5 rounded-md text-zinc-300 hover:bg-zinc-800"
                                title="Zoom In"
                            >
                                <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {effectiveStampEnabled ? (
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => handleAddStampOnCurrentPage(null)}
                                disabled={!signatureUrl}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-medium transition-colors disabled:opacity-40"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Signature Stamp
                            </button>
                            <button
                                type="button"
                                onClick={handleAddTimestampOnCurrentPage}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 font-medium transition-colors"
                                title="Add official date &amp; time stamp"
                            >
                                <Clock className="w-3.5 h-3.5" />
                                Add Timestamp
                            </button>
                            <span className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
                                {stamps.length} {stamps.length === 1 ? 'stamp' : 'stamps'} placed
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-amber-300/90 text-xs">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>
                                Stamping is toggled OFF. Document will be approved as-is.
                            </span>
                        </div>
                    )}
                </div>

                {/* Main PDF Canvas Workspace */}
                <div
                    className="relative flex-1 overflow-auto bg-zinc-950/95 flex items-start justify-center p-6 select-none"
                    onClick={() => setSelectedStampId(null)}
                >
                    {(isLoadingPdf || isLoadingSignature) && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-xs gap-2">
                            <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
                            <p className="text-xs text-zinc-300">
                                Loading PDF &amp; signature stamp...
                            </p>
                        </div>
                    )}

                    {(pdfError || (effectiveStampEnabled && signatureError)) && (
                        <div className="my-auto max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                            <p className="text-xs font-medium text-red-200">
                                {pdfError || signatureError}
                            </p>
                        </div>
                    )}

                    <div
                        ref={pageContainerRef}
                        onClick={() => setSelectedStampId(null)}
                        className="relative shadow-2xl rounded-sm bg-white border border-zinc-700/70"
                        style={{
                            width: canvasSize.width > 0 ? `${canvasSize.width}px` : 'auto',
                            height: canvasSize.height > 0 ? `${canvasSize.height}px` : 'auto',
                        }}
                    >
                        <canvas ref={canvasRef} className="block" />

                        {effectiveStampEnabled &&
                            canvasSize.width > 0 &&
                            stampsOnCurrentPage.map((stamp) => {
                                const isSelected = stamp.id === selectedStampId;
                                const leftPx = stamp.xRatio * canvasSize.width;
                                const topPx = stamp.yRatio * canvasSize.height;
                                const widthPx = stamp.widthRatio * canvasSize.width;
                                const heightPx = stamp.heightRatio * canvasSize.height;
                                const showToolbarBelow = stamp.yRatio < 0.12;

                                return (
                                    <div
                                        key={stamp.id}
                                        style={{
                                            position: 'absolute',
                                            left: `${leftPx}px`,
                                            top: `${topPx}px`,
                                            width: `${widthPx}px`,
                                            height: `${heightPx}px`,
                                            zIndex: isSelected ? 25 : 15,
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedStampId(stamp.id);
                                        }}
                                    >
                                        {/* Floating Action Toolbar on Selected Stamp */}
                                        {isSelected && (
                                            <div
                                                className={`absolute left-1/2 -translate-x-1/2 ${
                                                    showToolbarBelow
                                                        ? 'top-full mt-2.5'
                                                        : 'bottom-full mb-6'
                                                } z-40 flex items-center gap-1 px-2 py-1 rounded-xl bg-zinc-900/95 border border-zinc-700 shadow-xl whitespace-nowrap text-zinc-100`}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div
                                                    onPointerDown={(e) => startInteraction(e, stamp, 'move')}
                                                    className="p-1 rounded-md hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-move"
                                                    title="Drag to Move"
                                                >
                                                    <Move className="w-3.5 h-3.5" />
                                                </div>

                                                <div className="h-3.5 w-px bg-zinc-700 mx-0.5" />

                                                <button
                                                    type="button"
                                                    onClick={() => handleResizeStampByStep(stamp.id, 0.88)}
                                                    className="p-1 rounded-md hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                                    title="Shrink Stamp (-)"
                                                >
                                                    <ZoomOut className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleResizeStampByStep(stamp.id, 1.12)}
                                                    className="p-1 rounded-md hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                                    title="Enlarge Stamp (+)"
                                                >
                                                    <ZoomIn className="w-3.5 h-3.5" />
                                                </button>

                                                <div className="h-3.5 w-px bg-zinc-700 mx-0.5" />

                                                <button
                                                    type="button"
                                                    onClick={() => handleRotateStampByStep(stamp.id, -15)}
                                                    className="p-1 rounded-md hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                                    title="Rotate CCW (-15°)"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRotateStampByStep(stamp.id, 15)}
                                                    className="p-1 rounded-md hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                                    title="Rotate CW (+15°)"
                                                >
                                                    <RotateCw className="w-3.5 h-3.5" />
                                                </button>
                                                {stamp.rotationDeg !== 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleResetRotation(stamp.id)}
                                                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 text-emerald-300"
                                                        title="Reset Rotation to 0°"
                                                    >
                                                        {stamp.rotationDeg}°
                                                    </button>
                                                )}

                                                <div className="h-3.5 w-px bg-zinc-700 mx-0.5" />

                                                <button
                                                    type="button"
                                                    onClick={() => handleDuplicateStamp(stamp)}
                                                    className="p-1 rounded-md hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                                    title="Duplicate Stamp"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteStamp(stamp.id)}
                                                    disabled={
                                                        effectiveIsMandatorySign && stamp.type !== 'timestamp' && sigStampsCount <= 1
                                                    }
                                                    className="p-1 rounded-md hover:bg-red-500/20 text-red-400 hover:text-red-300 disabled:opacity-30 disabled:pointer-events-none"
                                                    title={
                                                        effectiveIsMandatorySign && stamp.type !== 'timestamp' && sigStampsCount <= 1
                                                            ? 'At least one signature stamp is required for mandatory sign PDFs'
                                                            : 'Remove stamp'
                                                    }
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Rotated Stamp Content Box */}
                                        <div
                                            onPointerDown={(e) => startInteraction(e, stamp, 'move')}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                transform: `rotate(${stamp.rotationDeg || 0}deg)`,
                                                transformOrigin: 'center center',
                                            }}
                                            className={`relative group rounded cursor-move transition-shadow ${
                                                isSelected
                                                    ? 'border border-emerald-400 ring-2 ring-emerald-400/30 shadow-md'
                                                    : 'border border-transparent hover:border-emerald-400/50 hover:bg-emerald-500/5'
                                            }`}
                                        >
                                            {stamp.type === 'timestamp' ? (
                                                <svg
                                                    viewBox="0 0 280 100"
                                                    preserveAspectRatio="xMidYMid meet"
                                                    className="w-full h-full pointer-events-none select-none overflow-visible"
                                                >
                                                    <text
                                                        x="140"
                                                        y="38"
                                                        textAnchor="middle"
                                                        dominantBaseline="middle"
                                                        fill="#0f172a"
                                                        style={{
                                                            fontSize: '26px',
                                                            fontWeight: 700,
                                                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                                        }}
                                                    >
                                                        {stamp.dateText}
                                                    </text>
                                                    <text
                                                        x="140"
                                                        y="72"
                                                        textAnchor="middle"
                                                        dominantBaseline="middle"
                                                        fill="#334155"
                                                        style={{
                                                            fontSize: '22px',
                                                            fontWeight: 600,
                                                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                                        }}
                                                    >
                                                        {stamp.timeText}
                                                    </text>
                                                </svg>
                                            ) : (
                                                signatureUrl ? (
                                                    (() => {
                                                        const viewW = 360;
                                                        const viewH = Math.round(viewW / (stamp.aspectRatio || signatureAspectRatio || 2.0));
                                                        const hasName = Boolean(signatoryName);
                                                        const nameH = hasName ? Math.max(42, Math.round(viewH * 0.30)) : 0;
                                                        const sigH = viewH - nameH;
                                                        const cleanName = (signatoryName || '').trim().toUpperCase();
                                                        const maxCharFit = Math.floor((viewW - 24) / Math.max(cleanName.length, 1) / 0.58);
                                                        const fontSize = hasName ? Math.min(24, Math.max(14, maxCharFit)) : 20;

                                                        return (
                                                            <svg
                                                                viewBox={`0 0 ${viewW} ${viewH}`}
                                                                preserveAspectRatio="xMidYMid meet"
                                                                className="w-full h-full pointer-events-none select-none overflow-visible"
                                                            >
                                                                <image
                                                                    href={signatureUrl}
                                                                    x="0"
                                                                    y="0"
                                                                    width={viewW}
                                                                    height={sigH}
                                                                    preserveAspectRatio="xMidYMid meet"
                                                                />
                                                                {hasName && (
                                                                    <text
                                                                        x={viewW / 2}
                                                                        y={sigH + nameH / 2}
                                                                        textAnchor="middle"
                                                                        dominantBaseline="middle"
                                                                        fill="#0f172a"
                                                                        style={{
                                                                            fontSize: `${fontSize}px`,
                                                                            fontWeight: 700,
                                                                            letterSpacing: '0.02em',
                                                                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                                                        }}
                                                                    >
                                                                        {cleanName}
                                                                    </text>
                                                                )}
                                                            </svg>
                                                        );
                                                    })()
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-500/10 text-emerald-600 p-2 text-center pointer-events-none select-none">
                                                        <span className="text-xs font-semibold">Officer Signature</span>
                                                        {signatoryName && (
                                                            <span className="text-xs font-bold text-zinc-800 mt-1 uppercase tracking-wide">
                                                                {signatoryName}
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            )}

                                            {/* Corner Resize & Rotation Handles */}
                                            {isSelected && (
                                                <>
                                                    {['nw', 'ne', 'se', 'sw'].map((corner) => {
                                                        const posClass = {
                                                             nw: '-top-1.5 -left-1.5',
                                                             ne: '-top-1.5 -right-1.5',
                                                             se: '-bottom-1.5 -right-1.5',
                                                             sw: '-bottom-1.5 -left-1.5',
                                                        }[corner];
                                                        const cursorClass = {
                                                             nw: 'cursor-nwse-resize',
                                                             ne: 'cursor-nesw-resize',
                                                             se: 'cursor-nwse-resize',
                                                             sw: 'cursor-nesw-resize',
                                                        }[corner];

                                                        // Outer rotation hit zone positioned just outside the corner
                                                        const rotateZonePosClass = {
                                                             nw: '-top-5 -left-5',
                                                             ne: '-top-5 -right-5',
                                                             se: '-bottom-5 -right-5',
                                                             sw: '-bottom-5 -left-5',
                                                        }[corner];

                                                        return (
                                                            <React.Fragment key={corner}>
                                                                {/* Outward Rotation Hit Zone (hovering just outside corner) */}
                                                                <div
                                                                    onPointerDown={(e) =>
                                                                        startInteraction(e, stamp, 'rotate', corner)
                                                                    }
                                                                    style={{ cursor: ROTATE_CURSOR, touchAction: 'none' }}
                                                                    className={`absolute ${rotateZonePosClass} w-7 h-7 z-20 select-none`}
                                                                    title="Click and drag to rotate (Shift to snap 15°)"
                                                                />

                                                                {/* Inner Corner Resize Square Handle */}
                                                                <div
                                                                    onPointerDown={(e) =>
                                                                        startInteraction(e, stamp, 'resize', corner)
                                                                    }
                                                                    className={`absolute ${posClass} w-3 h-3 bg-white border-2 border-emerald-500 rounded-xs shadow-md ${cursorClass} z-30`}
                                                                    title="Drag to resize"
                                                                />
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-zinc-800 bg-zinc-900/80">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                        {effectiveStampEnabled ? (
                            <span>
                                Approving will composite{' '}
                                <strong className="text-zinc-200">
                                    {stamps.length} stamp{stamps.length === 1 ? '' : 's'}
                                </strong>{' '}
                                onto <strong className="text-zinc-200">v{effectiveNextVersionNumber}.0</strong>{' '}
                                and preserve <strong className="text-zinc-200">v{effectiveActiveVersion?.version || 1}.0</strong> untouched.
                            </span>
                        ) : (
                            <span>
                                Approving without a signature stamp will mark{' '}
                                <strong className="text-zinc-200">
                                    v{effectiveActiveVersion?.version || 1}.0
                                </strong>{' '}
                                as Approved directly.
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5 ml-auto">
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={!canSubmitApproval}
                            onClick={() => {
                                if (!onConfirmApprove) return;
                                const isLast = !queue || queueIndex >= queue.length - 1;
                                onConfirmApprove({
                                    item: effectiveItem,
                                    shareId: currentTask?.shareId ?? effectiveShareRecord?.id,
                                    deptId: currentTask?.deptId,
                                    shouldStamp: effectiveStampEnabled,
                                    stamps: effectiveStampEnabled ? stamps : [],
                                    isLastInQueue: isLast,
                                    queueIndex,
                                    advanceQueue: () => {
                                        if (queue && queueIndex < queue.length - 1) {
                                            setQueueIndex((prev) => prev + 1);
                                        }
                                    },
                                });
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>
                                        {effectiveStampEnabled
                                            ? `Stamping & Creating v${effectiveNextVersionNumber}.0...`
                                            : 'Approving Document...'}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <FileCheck2 className="w-4 h-4" />
                                    <span>
                                        {queue && queue.length > 1
                                            ? (queueIndex === queue.length - 1
                                                ? `Stamp & Finish (${queue.length}/${queue.length})`
                                                : `Stamp & Next (${queueIndex + 1}/${queue.length})`)
                                            : (effectiveStampEnabled
                                                ? `Stamp Signature & Approve (v${effectiveNextVersionNumber}.0)`
                                                : 'Approve Without Signature')}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};

export { OfficerSignatureStampModal };
export default OfficerSignatureStampModal;

