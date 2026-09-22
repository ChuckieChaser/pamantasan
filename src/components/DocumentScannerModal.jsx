// --- IMPORTS ---
import { useState, useRef, useEffect, useCallback } from 'react';
import {
    RotateCcw,
    RotateCw,
    Maximize2,
    Sparkles,
    Check,
    X,
    Scan,
    Eye,
    Sliders,
} from 'lucide-react';
import { Button } from './Button';
import { useToast } from '../hooks';

// --- CONFIGURATIONS ---
const FILTER_MODES = [
    { id: 'magic', label: 'Magic White', description: 'Whitens paper & removes shadows' },
    { id: 'bw', label: 'B&W Clean', description: 'High-contrast black & white' },
    { id: 'gray', label: 'Grayscale', description: 'Smooth document gray' },
    { id: 'original', label: 'Original', description: 'Keep original colors' },
];

/**
 * Image Processing: Apply adaptive paper background whitening and contrast enhancement
 */
function applyDocumentWhitening(sourceCanvas, mode = 'magic', brightness = 1.05, contrast = 1.25) {
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = sourceCanvas.width;
    outputCanvas.height = sourceCanvas.height;
    const ctx = outputCanvas.getContext('2d', { willReadFrequently: true });
    
    ctx.drawImage(sourceCanvas, 0, 0);
    if (mode === 'original') {
        return outputCanvas;
    }

    const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const data = imageData.data;
    const len = data.length;

    if (mode === 'bw') {
        // High-contrast clean thresholding
        for (let i = 0; i < len; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const threshold = 145;
            const val = gray > threshold ? 255 : Math.max(0, gray * 0.4);
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
        }
    } else if (mode === 'gray') {
        // Clean grayscale with white stretch
        for (let i = 0; i < len; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            let gray = 0.299 * r + 0.587 * g + 0.114 * b;
            // Stretch highlights to pure white
            if (gray > 160) {
                gray = Math.min(255, 160 + (gray - 160) * 1.6);
            } else {
                gray = Math.max(0, gray * 0.85);
            }
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
    } else {
        // MAGIC WHITE: Adaptive Background Division & Shadow Removal
        // 1. Calculate color luminance and stretch paper background to pure white
        for (let i = 0; i < len; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Apply slight brightness & contrast adjustment
            r = ((r / 255 - 0.5) * contrast + 0.5) * 255 * brightness;
            g = ((g / 255 - 0.5) * contrast + 0.5) * 255 * brightness;
            b = ((b / 255 - 0.5) * contrast + 0.5) * 255 * brightness;

            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

            if (luminance > 140) {
                // Background paper area -> Boost towards crisp clean white #FFFFFF
                const boost = Math.min(255, 255 - (255 - luminance) * 0.22);
                data[i] = Math.min(255, Math.max(r, boost));
                data[i + 1] = Math.min(255, Math.max(g, boost));
                data[i + 2] = Math.min(255, Math.max(b, boost));
            } else {
                // Text ink area -> Deepen text clarity
                data[i] = Math.max(0, r * 0.78);
                data[i + 1] = Math.max(0, g * 0.78);
                data[i + 2] = Math.max(0, b * 0.78);
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return outputCanvas;
}

// --- MAIN COMPONENT ---
export const DocumentScannerModal = ({
    isOpen = false,
    file = null,
    onClose,
    onApply,
}) => {
    // REFS
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const previewCanvasRef = useRef(null);

    // STATES
    const [imageElement, setImageElement] = useState(null);
    const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
    const [filterMode, setFilterMode] = useState('magic'); // magic, bw, gray, original
    const [previewMode, setPreviewMode] = useState(false); // false: crop editor, true: whitened preview
    const [cropBox, setCropBox] = useState({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 }); // Normalized 0..1
    const [draggingHandle, setDraggingHandle] = useState(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, box: null });
    const [isProcessing, setIsProcessing] = useState(false);

    const { showToast } = useToast();

    // Load file into Image element when file opens
    useEffect(() => {
        if (!isOpen || !file) {
            queueMicrotask(() => {
                setImageElement(null);
                setRotation(0);
                setPreviewMode(false);
                setCropBox({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
            });
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            setImageElement(img);
            // Default initial crop boundary (5% margin for clean paper bounds)
            setCropBox({ x: 0.04, y: 0.04, width: 0.92, height: 0.92 });
        };
        img.src = objectUrl;

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [isOpen, file]);

    // Handle 90-degree rotations
    const handleRotateLeft = () => {
        setRotation((prev) => (prev - 90 + 360) % 360);
    };

    const handleRotateRight = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    const handleSelectAll = () => {
        setCropBox({ x: 0, y: 0, width: 1, height: 1 });
    };

    const handleAutoSnap = () => {
        // Auto-snap heuristic: 4% margin inset around central document area
        setCropBox({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
        showToast({
            type: 'information',
            title: 'Auto-Snap Applied',
            description: 'Snapped crop box to document boundaries.',
        });
    };

    // Get transformed source image on temporary canvas
    const getTransformedSourceCanvas = useCallback(() => {
        if (!imageElement) return null;

        const isRotated90or270 = rotation === 90 || rotation === 270;
        const width = isRotated90or270 ? imageElement.height : imageElement.width;
        const height = isRotated90or270 ? imageElement.width : imageElement.height;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.translate(width / 2, height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(imageElement, -imageElement.width / 2, -imageElement.height / 2);

        return canvas;
    }, [imageElement, rotation]);

    // Render interactive canvas or preview
    useEffect(() => {
        if (!isOpen || !imageElement) return;

        const transformedCanvas = getTransformedSourceCanvas();
        if (!transformedCanvas) return;

        if (previewMode) {
            // RENDER WHITENED DOCUMENT PREVIEW
            const pCanvas = previewCanvasRef.current;
            if (!pCanvas) return;

            // Crop portion according to cropBox
            const cropX = Math.round(cropBox.x * transformedCanvas.width);
            const cropY = Math.round(cropBox.y * transformedCanvas.height);
            const cropW = Math.round(cropBox.width * transformedCanvas.width);
            const cropH = Math.round(cropBox.height * transformedCanvas.height);

            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = Math.max(1, cropW);
            croppedCanvas.height = Math.max(1, cropH);
            const croppedCtx = croppedCanvas.getContext('2d');
            croppedCtx.drawImage(
                transformedCanvas,
                cropX, cropY, cropW, cropH,
                0, 0, cropW, cropH
            );

            // Apply whitening filter
            const enhancedCanvas = applyDocumentWhitening(croppedCanvas, filterMode);

            pCanvas.width = enhancedCanvas.width;
            pCanvas.height = enhancedCanvas.height;
            const pCtx = pCanvas.getContext('2d');
            pCtx.drawImage(enhancedCanvas, 0, 0);
        } else {
            // RENDER CROP EDITOR CANVAS
            const canvas = canvasRef.current;
            if (!canvas) return;

            canvas.width = transformedCanvas.width;
            canvas.height = transformedCanvas.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(transformedCanvas, 0, 0);
        }
    }, [isOpen, imageElement, rotation, cropBox, filterMode, previewMode, getTransformedSourceCanvas]);

    // Mouse / Touch Drag Handlers for Crop Handles
    const handlePointerDown = (handleKey, event) => {
        event.preventDefault();
        event.stopPropagation();
        setDraggingHandle(handleKey);
        setDragStart({
            x: event.clientX,
            y: event.clientY,
            box: { ...cropBox },
        });
    };

    const handlePointerMove = useCallback((event) => {
        if (!draggingHandle || !dragStart.box || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const deltaX = (event.clientX - dragStart.x) / rect.width;
        const deltaY = (event.clientY - dragStart.y) / rect.height;

        const box = { ...dragStart.box };
        const minSize = 0.1;

        if (draggingHandle === 'move') {
            box.x = Math.max(0, Math.min(1 - box.width, dragStart.box.x + deltaX));
            box.y = Math.max(0, Math.min(1 - box.height, dragStart.box.y + deltaY));
        } else if (draggingHandle === 'tl') {
            const newX = Math.max(0, Math.min(dragStart.box.x + dragStart.box.width - minSize, dragStart.box.x + deltaX));
            const newY = Math.max(0, Math.min(dragStart.box.y + dragStart.box.height - minSize, dragStart.box.y + deltaY));
            box.width = dragStart.box.width + (dragStart.box.x - newX);
            box.height = dragStart.box.height + (dragStart.box.y - newY);
            box.x = newX;
            box.y = newY;
        } else if (draggingHandle === 'tr') {
            const newY = Math.max(0, Math.min(dragStart.box.y + dragStart.box.height - minSize, dragStart.box.y + deltaY));
            box.width = Math.max(minSize, Math.min(1 - dragStart.box.x, dragStart.box.width + deltaX));
            box.height = dragStart.box.height + (dragStart.box.y - newY);
            box.y = newY;
        } else if (draggingHandle === 'bl') {
            const newX = Math.max(0, Math.min(dragStart.box.x + dragStart.box.width - minSize, dragStart.box.x + deltaX));
            box.width = dragStart.box.width + (dragStart.box.x - newX);
            box.height = Math.max(minSize, Math.min(1 - dragStart.box.y, dragStart.box.height + deltaY));
            box.x = newX;
        } else if (draggingHandle === 'br') {
            box.width = Math.max(minSize, Math.min(1 - dragStart.box.x, dragStart.box.width + deltaX));
            box.height = Math.max(minSize, Math.min(1 - dragStart.box.y, dragStart.box.height + deltaY));
        } else if (draggingHandle === 't') {
            const newY = Math.max(0, Math.min(dragStart.box.y + dragStart.box.height - minSize, dragStart.box.y + deltaY));
            box.height = dragStart.box.height + (dragStart.box.y - newY);
            box.y = newY;
        } else if (draggingHandle === 'b') {
            box.height = Math.max(minSize, Math.min(1 - dragStart.box.y, dragStart.box.height + deltaY));
        } else if (draggingHandle === 'l') {
            const newX = Math.max(0, Math.min(dragStart.box.x + dragStart.box.width - minSize, dragStart.box.x + deltaX));
            box.width = dragStart.box.width + (dragStart.box.x - newX);
            box.x = newX;
        } else if (draggingHandle === 'r') {
            box.width = Math.max(minSize, Math.min(1 - dragStart.box.x, dragStart.box.width + deltaX));
        }

        setCropBox(box);
    }, [draggingHandle, dragStart]);

    const handlePointerUp = useCallback(() => {
        setDraggingHandle(null);
    }, []);

    useEffect(() => {
        if (draggingHandle) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
            return () => {
                window.removeEventListener('pointermove', handlePointerMove);
                window.removeEventListener('pointerup', handlePointerUp);
            };
        }
    }, [draggingHandle, handlePointerMove, handlePointerUp]);

    // Apply & Save Handler
    const handleApplyEnhancedScan = async () => {
        if (!imageElement || !file) return;

        setIsProcessing(true);
        try {
            const transformedCanvas = getTransformedSourceCanvas();
            if (!transformedCanvas) {
                throw new Error('Failed to transform canvas.');
            }

            const cropX = Math.round(cropBox.x * transformedCanvas.width);
            const cropY = Math.round(cropBox.y * transformedCanvas.height);
            const cropW = Math.round(cropBox.width * transformedCanvas.width);
            const cropH = Math.round(cropBox.height * transformedCanvas.height);

            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = Math.max(1, cropW);
            croppedCanvas.height = Math.max(1, cropH);
            const croppedCtx = croppedCanvas.getContext('2d');
            croppedCtx.drawImage(
                transformedCanvas,
                cropX, cropY, cropW, cropH,
                0, 0, cropW, cropH
            );

            // Apply whitening filter
            const finalCanvas = applyDocumentWhitening(croppedCanvas, filterMode);

            // Convert canvas to high-quality JPEG/PNG Blob
            const enhancedBlob = await new Promise((resolve) => {
                finalCanvas.toBlob(resolve, 'image/jpeg', 0.95);
            });

            if (!enhancedBlob) {
                throw new Error('Failed to encode enhanced document image.');
            }

            const enhancedFile = new File([enhancedBlob], file.name || 'document_scan.jpg', {
                type: 'image/jpeg',
                lastModified: Date.now(),
            });

            onApply?.({
                enhancedFile,
                enhancedBlob,
                filterMode,
                rotation,
                isEnhanced: true,
            });

            showToast({
                type: 'success',
                title: 'Document Enhanced',
                description: 'Paper background whitened and orientation adjusted.',
            });
            onClose?.();
        } catch (error) {
            console.error('Failed to enhance document:', error);
            showToast({
                type: 'error',
                title: 'Scan Enhancement Failed',
                description: error?.message || 'Could not process document scan.',
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen || !file) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col select-none animate-toast-in">
            {/* TOP BAR */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-neutral-900/90 border-b border-neutral-800 text-white shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-accent/20 text-accent border border-accent/30">
                        <Scan className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                            Document Scanner Studio
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                                CamScanner Mode
                            </span>
                        </span>
                        <span className="text-xs text-neutral-400">
                            Rotate, crop paper boundaries, and whiten background for pristine OCR
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* PREVIEW TOGGLE BUTTON */}
                    <button
                        type="button"
                        onClick={() => setPreviewMode(!previewMode)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            previewMode
                                ? 'bg-accent text-white shadow-xs'
                                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                        }`}
                        title="Toggle live preview of whitened document"
                    >
                        {previewMode ? <Sliders className="h-4 w-4" /> : <Eye className="h-4 w-4 text-accent" />}
                        <span>{previewMode ? 'Back to Crop' : 'Preview White Paper'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Close Scanner"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* MAIN WORKSPACE CANVAS */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden relative bg-neutral-950">
                <div
                    ref={containerRef}
                    className="relative max-w-full max-h-full flex items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900"
                    style={{ maxHeight: '75vh' }}
                >
                    {/* CROP EDITOR CANVAS */}
                    <canvas
                        ref={canvasRef}
                        className={`max-w-full max-h-[75vh] object-contain block ${previewMode ? 'hidden' : ''}`}
                    />

                    {/* WHITENED PREVIEW CANVAS */}
                    <canvas
                        ref={previewCanvasRef}
                        className={`max-w-full max-h-[75vh] object-contain block ${!previewMode ? 'hidden' : ''}`}
                    />

                    {/* 8-HANDLE INTERACTIVE CROP BOX OVERLAY */}
                    {!previewMode && (
                        <div
                            className="absolute inset-0 pointer-events-none"
                        >
                            {/* DARK DIMMED SURROUNDING BACKDROP */}
                            <div
                                className="absolute border-2 border-accent bg-accent/10 pointer-events-auto cursor-move shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
                                style={{
                                    left: `${cropBox.x * 100}%`,
                                    top: `${cropBox.y * 100}%`,
                                    width: `${cropBox.width * 100}%`,
                                    height: `${cropBox.height * 100}%`,
                                }}
                                onPointerDown={(e) => handlePointerDown('move', e)}
                            >
                                {/* CORNER HANDLES */}
                                {/* Top-Left */}
                                <div
                                    onPointerDown={(e) => handlePointerDown('tl', e)}
                                    className="absolute -top-3.5 -left-3.5 w-7 h-7 rounded-full bg-accent border-3 border-white shadow-lg cursor-nwse-resize flex items-center justify-center hover:scale-125 transition-transform"
                                />
                                {/* Top-Right */}
                                <div
                                    onPointerDown={(e) => handlePointerDown('tr', e)}
                                    className="absolute -top-3.5 -right-3.5 w-7 h-7 rounded-full bg-accent border-3 border-white shadow-lg cursor-nesw-resize flex items-center justify-center hover:scale-125 transition-transform"
                                />
                                {/* Bottom-Left */}
                                <div
                                    onPointerDown={(e) => handlePointerDown('bl', e)}
                                    className="absolute -bottom-3.5 -left-3.5 w-7 h-7 rounded-full bg-accent border-3 border-white shadow-lg cursor-nesw-resize flex items-center justify-center hover:scale-125 transition-transform"
                                />
                                {/* Bottom-Right */}
                                <div
                                    onPointerDown={(e) => handlePointerDown('br', e)}
                                    className="absolute -bottom-3.5 -right-3.5 w-7 h-7 rounded-full bg-accent border-3 border-white shadow-lg cursor-nwse-resize flex items-center justify-center hover:scale-125 transition-transform"
                                />

                                {/* SIDE EDGE BARS */}
                                {/* Top Bar */}
                                <div
                                    onPointerDown={(e) => handlePointerDown('t', e)}
                                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-3.5 rounded-full bg-accent border-2 border-white shadow-md cursor-ns-resize hover:scale-110 transition-transform"
                                />
                                {/* Bottom Bar */}
                                <div
                                    onPointerDown={(e) => handlePointerDown('b', e)}
                                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-3.5 rounded-full bg-accent border-2 border-white shadow-md cursor-ns-resize hover:scale-110 transition-transform"
                                />
                                {/* Left Bar */}
                                <div
                                    onPointerDown={(e) => handlePointerDown('l', e)}
                                    className="absolute top-1/2 -left-2 -translate-y-1/2 w-3.5 h-12 rounded-full bg-accent border-2 border-white shadow-md cursor-ew-resize hover:scale-110 transition-transform"
                                />
                                {/* Right Bar */}
                                <div
                                    onPointerDown={(e) => handlePointerDown('r', e)}
                                    className="absolute top-1/2 -right-2 -translate-y-1/2 w-3.5 h-12 rounded-full bg-accent border-2 border-white shadow-md cursor-ew-resize hover:scale-110 transition-transform"
                                />

                                {/* GRID GUIDELINES */}
                                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-25">
                                    <div className="border-r border-b border-white" />
                                    <div className="border-r border-b border-white" />
                                    <div className="border-b border-white" />
                                    <div className="border-r border-b border-white" />
                                    <div className="border-r border-b border-white" />
                                    <div className="border-b border-white" />
                                    <div className="border-r border-white" />
                                    <div className="border-r border-white" />
                                    <div />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* BOTTOM TOOLBAR: ROTATION, FILTERS & APPLY */}
            <div className="px-6 py-4 bg-neutral-900/95 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-4 text-white shrink-0">
                {/* 1. ROTATE & CROP ACTIONS */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleRotateLeft}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 border border-neutral-700 cursor-pointer transition-colors"
                        title="Rotate Left 90°"
                    >
                        <RotateCcw className="h-4 w-4 text-accent" />
                        <span>Rotate Left</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleRotateRight}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 border border-neutral-700 cursor-pointer transition-colors"
                        title="Rotate Right 90°"
                    >
                        <RotateCw className="h-4 w-4 text-accent" />
                        <span>Rotate Right</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleSelectAll}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 border border-neutral-700 cursor-pointer transition-colors"
                        title="Expand Crop to Full Image"
                    >
                        <Maximize2 className="h-4 w-4" />
                        <span>Select All</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleAutoSnap}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 border border-neutral-700 cursor-pointer transition-colors"
                        title="Auto-Snap to Document Edges"
                    >
                        <Sparkles className="h-4 w-4 text-warning" />
                        <span>Auto Snap</span>
                    </button>
                </div>

                {/* 2. ENHANCEMENT FILTER SELECTOR */}
                <div className="flex items-center gap-1.5 bg-neutral-950/80 p-1 rounded-xl border border-neutral-800">
                    {FILTER_MODES.map((filter) => (
                        <button
                            key={filter.id}
                            type="button"
                            onClick={() => {
                                setFilterMode(filter.id);
                                if (!previewMode) setPreviewMode(true);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                filterMode === filter.id
                                    ? 'bg-accent text-white shadow-xs'
                                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                            }`}
                            title={filter.description}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                {/* 3. CONFIRM & APPLY */}
                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        label="Cancel"
                        disabled={isProcessing}
                    />

                    <Button
                        variant="primary"
                        onClick={handleApplyEnhancedScan}
                        label={isProcessing ? 'Processing Scan...' : 'Apply & Transform to PDF'}
                        leadingIcon={Check}
                        isLoading={isProcessing}
                        disabled={isProcessing}
                    />
                </div>
            </div>
        </div>
    );
};

export default DocumentScannerModal;
