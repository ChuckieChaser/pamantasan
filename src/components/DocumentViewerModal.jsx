// --- IMPORTS ---
import { useState, useEffect, useRef, useMemo } from 'react';
import {
    X,
    Download,
    Edit3,
    Save,
    RotateCw,
    ZoomIn,
    ZoomOut,
    FileText,
    FileSpreadsheet,
    FileCode,
    Image as ImageIcon,
    Film,
    Music,
    AlertTriangle,
    Check,
    Copy,
    Loader2,
    ExternalLink,
} from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';
import { Modal } from './Modal';
import { AreaField } from './Fields';
import { useToast, useKeyPress } from '../hooks';
import { constants } from '../constants';
import { storageService } from '../services';
import { useDocumentStore, useAuthStore } from '../stores';


// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-5 w-5 shrink-0';
const SMALL_ICON_STYLE = 'h-4 w-4 shrink-0';

const EDITABLE_EXTENSIONS = new Set([
    'txt', 'md', 'json', 'csv', 'log', 'js', 'jsx', 'ts', 'tsx',
    'html', 'css', 'scss', 'sql', 'py', 'sh', 'env', 'xml', 'yaml', 'yml',
]);

const IMAGE_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'ico', 'tiff',
]);

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']);

const getFileExtension = (filename = '') => {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
};


// --- COMPONENTS ---
const DocumentViewerModal = ({
    isOpen = false,
    item = null,
    targetVersion = null,
    onClose,
    className = '',
    ...props
}) => {
    // STORES & HOOKS
    const currentUser = useAuthStore((state) => state.currentUser);
    const documents = useDocumentStore((state) => state.documents);
    const documentVersions = useDocumentStore((state) => state.documentVersions ?? []);
    const insertDocumentVersion = useDocumentStore((state) => state.insertDocumentVersion);
    const { showToast } = useToast();

    // REFS
    const docxContainerRef = useRef(null);
    const textEditorRef = useRef(null);

    // STATES
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [fileBlob, setFileBlob] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Loading document...');
    const [loadError, setLoadError] = useState(null);

    // VIEWER / EDITOR STATES
    const [isEditing, setIsEditing] = useState(false);
    const [textContent, setTextContent] = useState('');
    const [initialTextContent, setInitialTextContent] = useState('');
    const [activeSpreadsheetSheet, setActiveSpreadsheetSheet] = useState('');
    const [spreadsheetData, setSpreadsheetData] = useState({ sheets: [], htmlBySheet: {} });

    // IMAGE CONTROLS
    const [imageZoom, setImageZoom] = useState(1);
    const [imageRotation, setImageRotation] = useState(0);

    // SAVE REVISION STATES
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [changeSummary, setChangeSummary] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [copiedChecksum, setCopiedChecksum] = useState(false);

    // KEYBOARD SHORTCUTS
    useKeyPress('Escape', () => {
        if (isOpen && !isSaveModalOpen) {
            handleRequestClose();
        }
    });

    // DERIVED DOCUMENT & VERSION PROPERTIES
    const resolvedDoc = useMemo(() => {
        if (!item) return null;
        const found = documents.find((d) => d.id === (item.id ?? item.documentId));
        return found ?? item;
    }, [item, documents]);

    const activeVersion = useMemo(() => {
        if (targetVersion) return targetVersion;
        if (!resolvedDoc?.id) return null;

        const versionsForDoc = documentVersions.filter(
            (v) => (v.documentId ?? v.document?.id) === resolvedDoc.id
        );
        if (versionsForDoc.length === 0) return null;

        return [...versionsForDoc].sort((a, b) => (b.version || 1) - (a.version || 1))[0];
    }, [targetVersion, resolvedDoc, documentVersions]);

    const fileName = activeVersion?.path?.split('/')?.pop() || resolvedDoc?.name || resolvedDoc?.title || 'Document';
    const fileExtension = useMemo(() => getFileExtension(fileName), [fileName]);
    const isEditable = EDITABLE_EXTENSIONS.has(fileExtension);
    const isImage = IMAGE_EXTENSIONS.has(fileExtension);
    const isPdf = fileExtension === 'pdf';
    const isDocx = fileExtension === 'docx';
    const isSpreadsheet = fileExtension === 'xlsx' || fileExtension === 'xls';
    const isVideo = VIDEO_EXTENSIONS.has(fileExtension);
    const isAudio = AUDIO_EXTENSIONS.has(fileExtension);
    const isArchived = Boolean(resolvedDoc?.isArchived);

    const classification = activeVersion?.classification ?? resolvedDoc?.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;
    const versionNumber = activeVersion?.version ?? 1;
    const nextVersionNumber = versionNumber + 1;
    const storagePath = activeVersion?.path ?? resolvedDoc?.path ?? null;
    const checksum = activeVersion?.checksum ?? null;
    const formattedSize = activeVersion?.sizeBytes
        ? formatBytes(activeVersion.sizeBytes)
        : (resolvedDoc?.size ?? 'Unknown size');

    // LOAD FILE RESOURCE
    useEffect(() => {
        if (!isOpen || !resolvedDoc) {
            setDownloadUrl(null);
            setFileBlob(null);
            setIsLoading(false);
            setLoadError(null);
            setIsEditing(false);
            return;
        }

        let isMounted = true;
        setIsLoading(true);
        setLoadError(null);
        setLoadingMessage('Fetching document from storage...');

        async function fetchResource() {
            try {
                const targetPath = storagePath || resolvedDoc.url || resolvedDoc.downloadUrl;
                if (!targetPath) {
                    throw new Error('No storage path or URL available for this file.');
                }

                // 1. Resolve direct download URL
                const url = await storageService.getFileDownloadUrl(targetPath);
                if (!isMounted) return;

                if (!url) {
                    throw new Error('Could not resolve download URL.');
                }
                setDownloadUrl(url);

                // 2. If it's a format requiring binary/text parsing in memory
                if (isDocx || isSpreadsheet || isEditable) {
                    setLoadingMessage('Reading file data in memory...');
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Failed to load file contents (${response.status})`);
                    }

                    if (isEditable) {
                        const text = await response.text();
                        if (isMounted) {
                            setTextContent(text);
                            setInitialTextContent(text);
                        }
                    } else if (isDocx || isSpreadsheet) {
                        const buffer = await response.arrayBuffer();
                        if (isMounted) {
                            setFileBlob(buffer);
                        }
                    }
                }

                if (isMounted) {
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('DocumentViewer load failure:', err);
                if (isMounted) {
                    setLoadError(err.message || 'Failed to load file.');
                    setIsLoading(false);
                }
            }
        }

        fetchResource();

        return () => {
            isMounted = false;
        };
    }, [isOpen, resolvedDoc, storagePath, isDocx, isSpreadsheet, isEditable]);

    // RENDER DOCX VIA CLIENT-SIDE PARSER
    useEffect(() => {
        if (!isDocx || !fileBlob || !docxContainerRef.current) {
            return;
        }

        let isRenderCancelled = false;
        async function renderDocxAsync() {
            try {
                // Dynamically import docx-preview for in-memory pure client rendering
                const docxModule = await import('docx-preview');
                const renderAsync = docxModule.renderAsync || docxModule.default?.renderAsync;

                if (typeof renderAsync === 'function' && docxContainerRef.current && !isRenderCancelled) {
                    docxContainerRef.current.innerHTML = '';
                    await renderAsync(fileBlob, docxContainerRef.current, undefined, {
                        className: 'docx-rendered-page',
                        inWrapper: true,
                        ignoreWidth: false,
                        ignoreHeight: false,
                        ignoreFonts: false,
                        breakPages: true,
                        experimental: true,
                    });
                }
            } catch (err) {
                console.warn('docx-preview rendering issue:', err);
            }
        }

        renderDocxAsync();

        return () => {
            isRenderCancelled = true;
        };
    }, [isDocx, fileBlob]);

    // RENDER XLSX VIA CLIENT-SIDE PARSER
    useEffect(() => {
        if (!isSpreadsheet || !fileBlob) {
            return;
        }

        let isCancelled = false;
        async function renderXlsxAsync() {
            try {
                const XLSX = await import('xlsx');
                const workbook = XLSX.read(fileBlob, { type: 'array' });
                const sheetNames = workbook.SheetNames || [];

                if (sheetNames.length === 0) return;

                const htmlMap = {};
                for (const name of sheetNames) {
                    const sheet = workbook.Sheets[name];
                    htmlMap[name] = XLSX.utils.sheet_to_html(sheet, {
                        id: `xlsx-table-${name}`,
                        editable: false,
                    });
                }

                if (!isCancelled) {
                    setSpreadsheetData({ sheets: sheetNames, htmlBySheet: htmlMap });
                    setActiveSpreadsheetSheet(sheetNames[0]);
                }
            } catch (err) {
                console.warn('XLSX parsing issue:', err);
            }
        }

        renderXlsxAsync();

        return () => {
            isCancelled = true;
        };
    }, [isSpreadsheet, fileBlob]);

    // HANDLERS
    const handleRequestClose = () => {
        if (isEditing && textContent !== initialTextContent) {
            if (!window.confirm('You have unsaved changes. Discard and exit?')) {
                return;
            }
        }
        setIsEditing(false);
        onClose?.();
    };

    const handleDownload = async () => {
        try {
            const targetPath = storagePath || resolvedDoc?.url || resolvedDoc?.downloadUrl;
            const url = downloadUrl || (await storageService.getFileDownloadUrl(targetPath));
            
            if (url) {
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = fileName || 'document.pdf';
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                document.body.appendChild(anchor);
                anchor.click();
                setTimeout(() => {
                    if (anchor.parentNode) {
                        anchor.parentNode.removeChild(anchor);
                    }
                }, 1000);

                showToast({
                    type: 'success',
                    title: 'Download Started',
                    description: `Downloading "${fileName}".`,
                });
                return;
            }

            await storageService.downloadDocument(targetPath, fileName);
            showToast({
                type: 'success',
                title: 'Download Started',
                description: `Downloading "${fileName}".`,
            });
        } catch (err) {
            showToast({
                type: 'error',
                title: 'Download Failed',
                description: err?.message || 'Could not download document.',
            });
        }
    };

    const handleCopyChecksum = () => {
        if (!checksum) return;
        navigator.clipboard.writeText(checksum);
        setCopiedChecksum(true);
        setTimeout(() => setCopiedChecksum(false), 2000);
        showToast({
            type: 'information',
            title: 'Checksum Copied',
            description: 'SHA-256 hash copied to clipboard.',
        });
    };

    const handleSaveNewVersionSubmit = async () => {
        if (!resolvedDoc?.id) return;
        setIsSaving(true);

        try {
            const targetDocId = resolvedDoc.id;
            const activeUserId = currentUser?.id;
            const mimeType = activeVersion?.mimeType || 'text/plain';

            // 1. Create in-memory Blob from edited text
            const updatedBlob = new Blob([textContent], { type: mimeType });

            // 2. Upload to Firebase Storage as next version
            const storageResult = await storageService.uploadDocument(
                targetDocId,
                updatedBlob,
                nextVersionNumber,
                fileName
            );

            // 3. Insert new DocumentVersion record
            await insertDocumentVersion({
                documentId: targetDocId,
                uploaderId: activeUserId,
                version: nextVersionNumber,
                path: storageResult.path,
                sizeBytes: storageResult.sizeBytes,
                mimeType: storageResult.mimeType || mimeType,
                classification: classification,
                changeSummary: changeSummary.trim() || `In-app revision v${nextVersionNumber}.0`,
                summary: activeVersion?.summary || null,
            });

            // 4. Update parent document updatedAt
            await useDocumentStore.getState().updateDocument(targetDocId, {
                updatedAt: new Date().toISOString(),
            });

            showToast({
                type: 'success',
                title: 'New Version Saved',
                description: `Successfully published version v${nextVersionNumber}.0.`,
            });

            setInitialTextContent(textContent);
            setIsEditing(false);
            setIsSaveModalOpen(false);
            setChangeSummary('');
        } catch (err) {
            showToast({
                type: 'error',
                title: 'Save Failed',
                description: err?.message || 'Could not save new document version.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    // GUARD CLAUSE
    if (!isOpen || !resolvedDoc) {
        return null;
    }

    // CLASSIFICATION BADGE VARIANT
    const classificationVariant =
        classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC
            ? 'success'
            : classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE
            ? 'information'
            : classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL
            ? 'warning'
            : classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED
            ? 'error'
            : 'neutral';

    // RENDER
    return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-toast-in select-none">
            <div
                className={`bg-surface border border-surface-border rounded-xl shadow-2xl flex flex-col w-full max-w-6xl h-[92vh] max-h-[950px] overflow-hidden ${className}`.trim()}
                {...props}
            >
                {/* 1. UNIVERSAL HEADER BAR */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-surface-border bg-surface shrink-0 gap-4">
                    {/* LEFT: ICON, TITLE, VERSION PILL & BADGES */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-accent-background text-accent shrink-0">
                            {renderCategoryIcon(fileExtension)}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <h2
                                    className="text-sm sm:text-base font-bold text-text font-serif truncate max-w-xs sm:max-w-md md:max-w-lg"
                                    title={fileName}
                                >
                                    {fileName}
                                </h2>
                                <Badge variant="neutral" label={`v${versionNumber}.0`} />
                                <Badge variant={classificationVariant} label={classification} />
                                {isArchived && (
                                    <Badge variant="error" label="Archived" />
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                                <span>{formattedSize}</span>
                                <span>•</span>
                                <span>{fileExtension.toUpperCase() || 'FILE'}</span>
                                {activeVersion?.createdAt && (
                                    <>
                                        <span>•</span>
                                        <span>Modified {new Date(activeVersion.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: ACTIONS (EDIT, DOWNLOAD, CLOSE) */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* EDIT ACTION: ONLY FOR EDITABLE FILES AND ACTIVE RECORDS */}
                        {isEditable && !isArchived && (
                            !isEditing ? (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    leadingIcon={Edit3}
                                    onClick={() => setIsEditing(true)}
                                    disabled={isLoading}
                                    title="Edit file contents in browser"
                                >
                                    Edit
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="neutral"
                                        size="sm"
                                        onClick={() => {
                                            setTextContent(initialTextContent);
                                            setIsEditing(false);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        leadingIcon={Save}
                                        onClick={() => setIsSaveModalOpen(true)}
                                        disabled={textContent === initialTextContent}
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            )
                        )}

                        {/* OPEN IN NEW TAB (IF PUBLIC/RESOLVED) */}
                        {downloadUrl && (
                            <button
                                type="button"
                                onClick={() => window.open(downloadUrl, '_blank')}
                                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer hidden md:flex items-center justify-center"
                                title="Open raw file in new browser tab"
                            >
                                <ExternalLink className={SMALL_ICON_STYLE} />
                            </button>
                        )}

                        {/* CLOSE BUTTON */}
                        <button
                            type="button"
                            onClick={handleRequestClose}
                            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                            title="Close viewer (Esc)"
                        >
                            <X className={SMALL_ICON_STYLE} />
                        </button>
                    </div>
                </div>

                {/* 2. OPTIONAL SUB-TOOLBAR FOR SPECIFIC FORMATS */}
                {isImage && downloadUrl && !isLoading && (
                    <div className="flex items-center justify-between px-6 py-2 bg-surface-hover/50 border-b border-surface-border text-xs text-text-muted shrink-0">
                        <span className="font-medium">Image Zoom & Orientation</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setImageZoom((prev) => Math.max(0.25, prev - 0.25))}
                                className="p-1 rounded hover:bg-surface hover:text-text transition-colors cursor-pointer"
                                title="Zoom Out"
                            >
                                <ZoomOut className={SMALL_ICON_STYLE} />
                            </button>
                            <span className="font-mono w-12 text-center text-text font-medium">
                                {Math.round(imageZoom * 100)}%
                            </span>
                            <button
                                type="button"
                                onClick={() => setImageZoom((prev) => Math.min(3, prev + 0.25))}
                                className="p-1 rounded hover:bg-surface hover:text-text transition-colors cursor-pointer"
                                title="Zoom In"
                            >
                                <ZoomIn className={SMALL_ICON_STYLE} />
                            </button>
                            <span className="h-4 w-px bg-surface-border mx-1" />
                            <button
                                type="button"
                                onClick={() => setImageRotation((prev) => (prev + 90) % 360)}
                                className="p-1 rounded hover:bg-surface hover:text-text transition-colors cursor-pointer"
                                title="Rotate 90°"
                            >
                                <RotateCw className={SMALL_ICON_STYLE} />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setImageZoom(1);
                                    setImageRotation(0);
                                }}
                                className="px-2 py-0.5 rounded text-xs hover:bg-surface hover:text-text transition-colors cursor-pointer"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                )}

                {/* SPREADSHEET TAB BAR */}
                {isSpreadsheet && spreadsheetData.sheets.length > 1 && !isLoading && (
                    <div className="flex items-center gap-1 px-4 py-2 bg-surface-hover/70 border-b border-surface-border overflow-x-auto shrink-0">
                        <span className="text-xs font-semibold text-text-muted mr-2 shrink-0">Sheets:</span>
                        {spreadsheetData.sheets.map((name) => (
                            <button
                                key={name}
                                type="button"
                                onClick={() => setActiveSpreadsheetSheet(name)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                                    activeSpreadsheetSheet === name
                                        ? 'bg-accent text-text-inverted shadow-xs'
                                        : 'bg-surface text-text hover:bg-surface-hover'
                                }`}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                )}

                {/* 3. DYNAMIC CONTENT VIEWPORT */}
                <div className="relative flex-1 bg-surface-hover/20 overflow-hidden flex flex-col items-center justify-center p-2 sm:p-4 select-text">
                    {/* LOADING STATE */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center animate-pulse">
                            <Loader2 className="h-8 w-8 text-accent animate-spin" />
                            <p className="text-sm font-medium text-text">{loadingMessage}</p>
                        </div>
                    )}

                    {/* ERROR STATE */}
                    {!isLoading && loadError && (
                        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center max-w-md bg-surface rounded-xl border border-surface-border shadow-sm">
                            <div className="p-3 rounded-full bg-error-background text-error">
                                <AlertTriangle className="h-8 w-8" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <h3 className="text-base font-bold text-text">Preview Unavailable</h3>
                                <p className="text-xs text-text-muted leading-relaxed">
                                    {loadError}
                                </p>
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                leadingIcon={Download}
                                onClick={handleDownload}
                            >
                                Download to View Locally
                            </Button>
                        </div>
                    )}

                    {/* CONTENT RENDERERS */}
                    {!isLoading && !loadError && (
                        <>
                            {/* A. PDF EMBED */}
                            {isPdf && downloadUrl && (
                                <iframe
                                    src={`${downloadUrl}#toolbar=1&navpanes=0`}
                                    title={fileName}
                                    className="w-full h-full border-none rounded-lg bg-zinc-800 shadow-inner"
                                />
                            )}

                            {/* B. DOCX WORD PROCESSOR PREVIEW */}
                            {isDocx && (
                                <div className="w-full h-full overflow-auto p-2 sm:p-6 bg-zinc-100 dark:bg-zinc-950/60 rounded-lg flex justify-center">
                                    <div
                                        ref={docxContainerRef}
                                        className="docx-render-host bg-white text-black p-8 sm:p-12 shadow-xl rounded max-w-4xl w-full min-h-full font-serif leading-relaxed"
                                    />
                                </div>
                            )}

                            {/* C. SPREADSHEET TABLE PREVIEW */}
                            {isSpreadsheet && (
                                <div className="w-full h-full overflow-auto bg-surface rounded-lg border border-surface-border p-4">
                                    {spreadsheetData.htmlBySheet[activeSpreadsheetSheet] ? (
                                        <div
                                            className="spreadsheet-html-host prose max-w-none text-xs"
                                            dangerouslySetInnerHTML={{
                                                __html: spreadsheetData.htmlBySheet[activeSpreadsheetSheet],
                                            }}
                                        />
                                    ) : (
                                        <div className="text-center text-text-muted py-12 text-xs">
                                            Sheet is empty or could not be rendered.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* D. TEXT & CODE: VIEW OR EDIT */}
                            {isEditable && (
                                !isEditing ? (
                                    <div className="w-full h-full overflow-auto bg-surface rounded-lg border border-surface-border p-4">
                                        <pre className="font-mono text-xs text-text whitespace-pre-wrap leading-relaxed">
                                            {textContent || '(File is empty)'}
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col bg-surface rounded-lg border-2 border-accent overflow-hidden">
                                        <div className="bg-accent-background/50 px-4 py-2 border-b border-accent-border flex items-center justify-between text-xs text-accent font-semibold shrink-0">
                                            <span>Editing Mode</span>
                                            <span className="text-text-muted font-normal">
                                                Unsaved changes will be committed as v{nextVersionNumber}.0
                                            </span>
                                        </div>
                                        <textarea
                                            ref={textEditorRef}
                                            value={textContent}
                                            onChange={(e) => setTextContent(e.target.value)}
                                            className="flex-1 w-full p-4 font-mono text-xs text-text bg-transparent outline-none resize-none overflow-auto leading-relaxed"
                                            placeholder="Type text contents here..."
                                        />
                                    </div>
                                )
                            )}

                            {/* E. IMAGES */}
                            {isImage && downloadUrl && (
                                <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                                    <img
                                        src={downloadUrl}
                                        alt={fileName}
                                        style={{
                                            transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                                        }}
                                        className="transition-transform duration-200 max-h-full max-w-full object-contain rounded shadow-lg select-none"
                                    />
                                </div>
                            )}

                            {/* F. VIDEO */}
                            {isVideo && downloadUrl && (
                                <div className="w-full h-full flex items-center justify-center p-4 bg-black/40 rounded-lg">
                                    <video
                                        src={downloadUrl}
                                        controls
                                        autoPlay={false}
                                        className="max-h-full max-w-full rounded-lg shadow-2xl"
                                    />
                                </div>
                            )}

                            {/* G. AUDIO */}
                            {isAudio && downloadUrl && (
                                <div className="flex flex-col items-center justify-center gap-6 p-8 bg-surface rounded-xl border border-surface-border shadow-sm max-w-md w-full">
                                    <div className="p-4 rounded-full bg-accent-background text-accent">
                                        <Music className="h-10 w-10" />
                                    </div>
                                    <div className="text-center">
                                        <h4 className="text-sm font-bold text-text">{fileName}</h4>
                                        <p className="text-xs text-text-muted">{formattedSize}</p>
                                    </div>
                                    <audio src={downloadUrl} controls className="w-full" />
                                </div>
                            )}

                            {/* H. UNSUPPORTED / BINARY FALLBACK (PPTX, ZIP, ETC.) */}
                            {!isPdf && !isDocx && !isSpreadsheet && !isEditable && !isImage && !isVideo && !isAudio && (
                                <div className="flex flex-col items-center justify-center gap-5 p-8 text-center max-w-md bg-surface rounded-xl border border-surface-border shadow-md">
                                    <div className="p-4 rounded-full bg-surface-hover text-text-muted">
                                        {renderCategoryIcon(fileExtension, 'h-10 w-10')}
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="text-base font-bold text-text">{fileName}</h3>
                                        <p className="text-xs text-text-muted leading-relaxed">
                                            This file format ({fileExtension.toUpperCase() || 'Binary'}) cannot be rendered directly in the web browser. You can download and open it in its native desktop application.
                                        </p>
                                    </div>
                                    <div className="w-full p-3 rounded-lg bg-surface-hover/70 border border-surface-border flex flex-col gap-1.5 text-xs text-left">
                                        <div className="flex justify-between">
                                            <span className="text-text-muted">File Size:</span>
                                            <span className="font-medium text-text">{formattedSize}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-text-muted">Format:</span>
                                            <span className="font-mono text-text">.{fileExtension}</span>
                                        </div>
                                        {checksum && (
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-text-muted">Checksum:</span>
                                                <span className="font-mono text-[10px] text-text truncate max-w-[160px]">{checksum}</span>
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant="primary"
                                        size="md"
                                        leadingIcon={Download}
                                        onClick={handleDownload}
                                        className="w-full"
                                    >
                                        Download File
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 4. UNIVERSAL FOOTER STATUS BAR */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-surface border-t border-surface-border text-xs text-text-muted shrink-0 select-none">
                    <div className="flex items-center gap-4 overflow-hidden truncate">
                        {checksum && (
                            <button
                                type="button"
                                onClick={handleCopyChecksum}
                                className="inline-flex items-center gap-1.5 hover:text-text transition-colors cursor-pointer truncate"
                                title="Click to copy SHA-256 hash"
                            >
                                {copiedChecksum ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                                <span className="font-mono text-[11px] truncate">SHA: {checksum.slice(0, 16)}...</span>
                            </button>
                        )}
                        {storagePath && (
                            <span className="hidden md:inline font-mono text-[11px] truncate text-text-muted/80">
                                {storagePath}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {isArchived ? (
                            <span className="text-error font-medium">Read-Only Archive</span>
                        ) : isEditing ? (
                            <span className="text-accent font-semibold animate-pulse">Unsaved Draft</span>
                        ) : (
                            <span>Official University Record</span>
                        )}
                    </div>
                </div>
            </div>

            {/* 5. CONFIRMATION MODAL FOR SAVING NEW VERSION */}
            {isSaveModalOpen && (
                <Modal
                    isOpen={isSaveModalOpen}
                    onClose={() => !isSaving && setIsSaveModalOpen(false)}
                    title={`Publish Version v${nextVersionNumber}.0`}
                    description={`Save your in-app edits as a new revision of "${fileName}". The previous version v${versionNumber}.0 remains preserved in the audit history.`}
                    icon={Save}
                    variant="accent"
                    size="md"
                    callout={`A new revision record will be generated in Firebase Storage. Any user browsing this document will see v${nextVersionNumber}.0 as the latest official version.`}
                    calloutVariant="accent"
                    primaryAction={{
                        label: isSaving ? 'Publishing Version...' : `Publish v${nextVersionNumber}.0`,
                        onClick: handleSaveNewVersionSubmit,
                        isLoading: isSaving,
                        leadingIcon: Save,
                    }}
                    secondaryAction={{
                        label: 'Keep Editing',
                        onClick: () => setIsSaveModalOpen(false),
                        disabled: isSaving,
                    }}
                >
                    <div className="flex flex-col gap-3">
                        <AreaField
                            label="Revision Change Summary (Optional)"
                            placeholder="e.g., Updated schedule dates, fixed typographical error in section 3..."
                            value={changeSummary}
                            onChange={(e) => setChangeSummary(e.target.value)}
                            disabled={isSaving}
                            rows={3}
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
};


// --- HELPERS ---
function renderCategoryIcon(ext, className = ICON_STYLE) {
    if (ext === 'pdf') return <FileText className={className} />;
    if (ext === 'docx' || ext === 'doc') return <FileText className={className} />;
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return <FileSpreadsheet className={className} />;
    if (EDITABLE_EXTENSIONS.has(ext)) return <FileCode className={className} />;
    if (IMAGE_EXTENSIONS.has(ext)) return <ImageIcon className={className} />;
    if (VIDEO_EXTENSIONS.has(ext)) return <Film className={className} />;
    if (AUDIO_EXTENSIONS.has(ext)) return <Music className={className} />;
    return <FileText className={className} />;
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const kilobyte = 1024;
    const megabyte = kilobyte * 1024;

    if (bytes >= megabyte) {
        return `${(bytes / megabyte).toFixed(1)} MB`;
    }
    return `${Math.max(1, Math.round(bytes / kilobyte))} KB`;
}


// --- EXPORTS ---
export { DocumentViewerModal };
export default DocumentViewerModal;
