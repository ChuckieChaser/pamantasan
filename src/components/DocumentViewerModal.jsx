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
    Plus,
} from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';
import { Modal } from './Modal';
import { AreaField } from './Fields';
import { formatDateTime } from './common';
import { useToast, useKeyPress } from '../hooks';
import { constants } from '../constants';
import { storageService, aiService, systemEventService } from '../services';
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
    const [loadingElapsedSec, setLoadingElapsedSec] = useState(0);
    const [loadProgress, setLoadProgress] = useState(0);

    // PROGRESSIVE LOADING BAR ANIMATION (BUILDS LEFT TO RIGHT)
    useEffect(() => {
        if (isLoading) {
            const t0 = setTimeout(() => setLoadProgress(15), 0);
            const t1 = setTimeout(() => setLoadProgress(45), 150);
            const t2 = setTimeout(() => setLoadProgress(75), 400);
            const t3 = setTimeout(() => setLoadProgress(90), 800);
            return () => {
                clearTimeout(t0);
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
            };
        } else {
            const t0 = setTimeout(() => setLoadProgress(100), 0);
            const t = setTimeout(() => setLoadProgress(0), 350);
            return () => {
                clearTimeout(t0);
                clearTimeout(t);
            };
        }
    }, [isLoading]);

    // LOADING ELAPSED TIMER
    useEffect(() => {
        if (!isLoading) {
            queueMicrotask(() => setLoadingElapsedSec(0));
            return;
        }
        const startTime = Date.now();
        const interval = setInterval(() => {
            setLoadingElapsedSec(+((Date.now() - startTime) / 1000).toFixed(1));
        }, 100);
        return () => clearInterval(interval);
    }, [isLoading]);

    // VIEWER / EDITOR STATES
    const [isEditing, setIsEditing] = useState(false);
    const [textContent, setTextContent] = useState('');
    const [initialTextContent, setInitialTextContent] = useState('');
    const [activeSpreadsheetSheet, setActiveSpreadsheetSheet] = useState('');
    const [spreadsheetData, setSpreadsheetData] = useState({ sheets: [], rowsBySheet: {} });
    const [editableSpreadsheetRows, setEditableSpreadsheetRows] = useState({});
    const [initialSpreadsheetRows, setInitialSpreadsheetRows] = useState({});
    const [initialSpreadsheetSheets, setInitialSpreadsheetSheets] = useState([]);
    const [renamingSheet, setRenamingSheet] = useState(null);
    const [renameInputVal, setRenameInputVal] = useState('');

    // IMAGE CONTROLS
    const [imageZoom, setImageZoom] = useState(1);
    const [imageRotation, setImageRotation] = useState(0);

    // SAVE REVISION STATES
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [changeSummary, setChangeSummary] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [copiedChecksum, setCopiedChecksum] = useState(false);

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

    const googleApp = useMemo(() => {
        return getGoogleAppConfig(fileExtension, downloadUrl, currentUser?.email);
    }, [fileExtension, downloadUrl, currentUser?.email]);

    // LOAD FILE RESOURCE
    useEffect(() => {
        if (!isOpen || !resolvedDoc) {
            queueMicrotask(() => {
                setDownloadUrl(null);
                setFileBlob(null);
                setIsLoading(false);
                setLoadError(null);
                setIsEditing(false);
            });
            return;
        }

        let isMounted = true;
        queueMicrotask(() => {
            if (!isMounted) return;
            setIsLoading(true);
            setLoadError(null);
            setLoadingMessage('Fetching document from storage...');
        });

        async function fetchResource() {
            try {
                const targetPath = storagePath || resolvedDoc.url || resolvedDoc.downloadUrl;
                if (!targetPath) {
                    throw new Error('No storage path or URL available for this file.');
                }

                // 1. Resolve direct download URL (used by PDF iframe, media tags, external link)
                const url = await storageService.getFileDownloadUrl(targetPath);
                if (!isMounted) return;

                if (url) {
                    setDownloadUrl(url);
                }

                // 2. In-memory parsers (Text, Markdown, Code, Docx, Spreadsheet)
                if (isDocx || isSpreadsheet || isEditable) {
                    setLoadingMessage('Reading file data from storage...');
                    // Retrieve blob directly via Firebase Storage SDK to prevent CORS issues
                    let blob = await storageService.getFileBlob(targetPath);

                    // Fallback to network fetch if getFileBlob was unable to resolve but url is present
                    if (!blob && url) {
                        try {
                            const targetFetchUrl = storageService.toProxiedUrl ? storageService.toProxiedUrl(url) : url;
                            const response = await fetch(targetFetchUrl);
                            if (response.ok) {
                                blob = await response.blob();
                            }
                        } catch (fetchErr) {
                            console.warn('Network fetch fallback failed:', fetchErr?.message);
                        }
                    }

                    if (!blob) {
                        throw new Error('Could not retrieve file content from storage.');
                    }

                    if (!isMounted) return;

                    if (isEditable) {
                        const text = await blob.text();
                        if (isMounted) {
                            setTextContent(text);
                            setInitialTextContent(text);
                        }
                    } else if (isDocx || isSpreadsheet) {
                        const buffer = await blob.arrayBuffer();
                        if (isMounted) {
                            setFileBlob(buffer);
                        }
                    }
                } else if (!url) {
                    throw new Error('Could not resolve file location in storage.');
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

    // RECORD DOCUMENT READ AUDIT EVENT (DEBOUNCED)
    useEffect(() => {
        if (isOpen && resolvedDoc && !isLoading && !loadError && currentUser?.id) {
            systemEventService.recordDocumentRead({
                document: resolvedDoc,
                user: currentUser,
                version: activeVersion?.version,
            }).catch(() => {});
        }
    }, [isOpen, resolvedDoc, isLoading, loadError, currentUser, activeVersion?.version]);

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
                        className: 'docx',
                        inWrapper: true,
                        ignoreWidth: false,
                        ignoreHeight: false,
                        ignoreFonts: false,
                        breakPages: true,
                        useBase64URL: true,
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

    // RENDER XLSX VIA CLIENT-SIDE PARSER (AUTHENTIC EXCEL GRID)
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

                const rowsMap = {};
                for (const name of sheetNames) {
                    const sheet = workbook.Sheets[name];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                    rowsMap[name] = rows.length > 0 ? rows : [['']];
                }

                if (!isCancelled) {
                    setSpreadsheetData({ sheets: sheetNames, rowsBySheet: rowsMap });
                    setEditableSpreadsheetRows(rowsMap);
                    setInitialSpreadsheetRows(JSON.parse(JSON.stringify(rowsMap)));
                    setInitialSpreadsheetSheets([...sheetNames]);
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

    // SPREADSHEET CELL & SHEET EDITING HANDLERS
    const handleSpreadsheetCellChange = (sheetName, rowIdx, colIdx, value) => {
        setEditableSpreadsheetRows((prev) => {
            const currentSheetRows = prev[sheetName] ? [...prev[sheetName]] : [];
            const targetRow = currentSheetRows[rowIdx] ? [...currentSheetRows[rowIdx]] : [];
            while (targetRow.length <= colIdx) {
                targetRow.push('');
            }
            targetRow[colIdx] = value;
            currentSheetRows[rowIdx] = targetRow;
            return {
                ...prev,
                [sheetName]: currentSheetRows,
            };
        });
    };

    const handleAddSpreadsheetRow = (sheetName) => {
        setEditableSpreadsheetRows((prev) => {
            const currentSheetRows = prev[sheetName] ? [...prev[sheetName]] : [];
            const colCount = Math.max(5, currentSheetRows[0]?.length || 5);
            currentSheetRows.push(new Array(colCount).fill(''));
            return {
                ...prev,
                [sheetName]: currentSheetRows,
            };
        });
    };

    const handleAddSpreadsheetCol = (sheetName) => {
        setEditableSpreadsheetRows((prev) => {
            const currentSheetRows = prev[sheetName] ? [...prev[sheetName]] : [];
            if (currentSheetRows.length === 0) {
                return { ...prev, [sheetName]: [['', '']] };
            }
            const updated = currentSheetRows.map((row) => [...row, '']);
            return {
                ...prev,
                [sheetName]: updated,
            };
        });
    };

    const handleAddSheet = () => {
        const existing = new Set(spreadsheetData.sheets);
        let nextNum = existing.size + 1;
        let candidate = `Sheet${nextNum}`;
        while (existing.has(candidate)) {
            nextNum++;
            candidate = `Sheet${nextNum}`;
        }
        const newSheets = [...spreadsheetData.sheets, candidate];
        const initialGrid = Array.from({ length: 10 }, () => new Array(6).fill(''));
        setSpreadsheetData((prev) => ({
            ...prev,
            sheets: newSheets,
            rowsBySheet: {
                ...prev.rowsBySheet,
                [candidate]: initialGrid,
            },
        }));
        setEditableSpreadsheetRows((prev) => ({
            ...prev,
            [candidate]: initialGrid,
        }));
        setActiveSpreadsheetSheet(candidate);
        setIsEditing(true);
    };

    const handleStartRenameSheet = (sheetName) => {
        setRenamingSheet(sheetName);
        setRenameInputVal(sheetName);
    };

    const handleCommitRenameSheet = (oldName) => {
        if (!renamingSheet) return;
        const trimmed = renameInputVal.trim();
        if (!trimmed || trimmed === oldName) {
            setRenamingSheet(null);
            return;
        }
        if (spreadsheetData.sheets.some((s) => s.toLowerCase() === trimmed.toLowerCase() && s !== oldName)) {
            showToast({
                type: 'warning',
                title: 'Duplicate Sheet Name',
                description: `A sheet named "${trimmed}" already exists.`,
            });
            setRenamingSheet(null);
            return;
        }
        const updatedSheets = spreadsheetData.sheets.map((s) => (s === oldName ? trimmed : s));
        setSpreadsheetData((prev) => {
            const updatedRows = { ...prev.rowsBySheet };
            updatedRows[trimmed] = updatedRows[oldName] || [];
            delete updatedRows[oldName];
            return {
                sheets: updatedSheets,
                rowsBySheet: updatedRows,
            };
        });
        setEditableSpreadsheetRows((prev) => {
            const updated = { ...prev };
            updated[trimmed] = updated[oldName] || [];
            delete updated[oldName];
            return updated;
        });
        setInitialSpreadsheetRows((prev) => {
            const updated = { ...prev };
            if (updated[oldName]) {
                updated[trimmed] = updated[oldName];
                delete updated[oldName];
            }
            return updated;
        });
        if (activeSpreadsheetSheet === oldName) {
            setActiveSpreadsheetSheet(trimmed);
        }
        setRenamingSheet(null);
    };

    const focusCell = (r, c) => {
        const el = document.getElementById(`xlsx-cell-${r}-${c}`);
        if (el) {
            el.focus();
            el.select?.();
        }
    };

    const handleCellKeyDown = (e, sheetName, rIdx, cIdx, rowCount, colCount) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                if (cIdx > 0) {
                    focusCell(rIdx, cIdx - 1);
                } else if (rIdx > 0) {
                    focusCell(rIdx - 1, colCount - 1);
                }
            } else {
                if (cIdx + 1 < colCount) {
                    focusCell(rIdx, cIdx + 1);
                } else if (rIdx + 1 < rowCount) {
                    focusCell(rIdx + 1, 0);
                } else {
                    handleAddSpreadsheetRow(sheetName);
                    setTimeout(() => focusCell(rIdx + 1, 0), 20);
                }
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                if (rIdx > 0) {
                    focusCell(rIdx - 1, cIdx);
                }
            } else {
                if (rIdx + 1 < rowCount) {
                    focusCell(rIdx + 1, cIdx);
                } else {
                    handleAddSpreadsheetRow(sheetName);
                    setTimeout(() => focusCell(rIdx + 1, cIdx), 20);
                }
            }
        } else if (e.key === 'ArrowUp') {
            if (rIdx > 0 && (e.target.selectionStart === 0 || e.ctrlKey || e.altKey)) {
                e.preventDefault();
                focusCell(rIdx - 1, cIdx);
            }
        } else if (e.key === 'ArrowDown') {
            if (rIdx + 1 < rowCount && (e.target.selectionStart === e.target.value.length || e.ctrlKey || e.altKey)) {
                e.preventDefault();
                focusCell(rIdx + 1, cIdx);
            }
        }
    };

    const hasUnsavedChanges = useMemo(() => {
        if (!isEditing) return false;
        if (isSpreadsheet) {
            const sheetsChanged = JSON.stringify(spreadsheetData.sheets) !== JSON.stringify(initialSpreadsheetSheets);
            const rowsChanged = JSON.stringify(editableSpreadsheetRows) !== JSON.stringify(initialSpreadsheetRows);
            return sheetsChanged || rowsChanged;
        }
        return textContent !== initialTextContent;
    }, [isEditing, isSpreadsheet, spreadsheetData.sheets, initialSpreadsheetSheets, editableSpreadsheetRows, initialSpreadsheetRows, textContent, initialTextContent]);

    // HANDLERS
    const handleRequestClose = () => {
        if (isEditing && hasUnsavedChanges) {
            if (!window.confirm('You have unsaved changes. Discard and exit?')) {
                return;
            }
        }
        if (isSpreadsheet) {
            setEditableSpreadsheetRows(JSON.parse(JSON.stringify(initialSpreadsheetRows)));
            setSpreadsheetData((prev) => ({
                ...prev,
                sheets: [...initialSpreadsheetSheets],
                rowsBySheet: JSON.parse(JSON.stringify(initialSpreadsheetRows)),
            }));
            setActiveSpreadsheetSheet(initialSpreadsheetSheets[0] || '');
        } else {
            setTextContent(initialTextContent);
        }
        setIsEditing(false);
        onClose?.();
    };

    // KEYBOARD SHORTCUTS
    useKeyPress('Escape', () => {
        if (isOpen && !isSaveModalOpen) {
            handleRequestClose();
        }
    });

    const handleDownload = async () => {
        try {
            let effectiveDownloadName = fileName || 'document';
            if (fileExtension && !effectiveDownloadName.toLowerCase().endsWith(`.${fileExtension.toLowerCase()}`)) {
                effectiveDownloadName = `${effectiveDownloadName}.${fileExtension}`;
            }

            if (fileBlob) {
                await storageService.triggerBrowserDownload(fileBlob, effectiveDownloadName);
                showToast({
                    type: 'success',
                    title: 'Download Started',
                    description: `Saving "${effectiveDownloadName}" to your device.`,
                });
                return;
            }

            const targetPath = storagePath || resolvedDoc?.path || resolvedDoc?.url || resolvedDoc?.downloadUrl;
            await storageService.downloadDocument(targetPath, effectiveDownloadName);
            showToast({
                type: 'success',
                title: 'Download Started',
                description: `Saving "${effectiveDownloadName}" to your device.`,
            });
        } catch (err) {
            showToast({
                type: 'error',
                title: 'Download Failed',
                description: err?.message || 'Could not download document.',
            });
        }
    };

    const handleOpenInGoogleApp = () => {
        if (!googleApp?.url) return;
        window.open(googleApp.url, '_blank');
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

            // 1. Create in-memory Blob from edited text or spreadsheet
            let updatedBlob = null;
            let effectiveMime = activeVersion?.mimeType;

            if (isSpreadsheet) {
                const XLSX = await import('xlsx');
                const newWb = XLSX.utils.book_new();
                for (const sheetName of spreadsheetData.sheets) {
                    const rows = editableSpreadsheetRows[sheetName] || [];
                    const ws = XLSX.utils.aoa_to_sheet(rows);
                    XLSX.utils.book_append_sheet(newWb, ws, sheetName);
                }
                const binaryData = XLSX.write(newWb, { bookType: 'xlsx', type: 'array' });
                effectiveMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                updatedBlob = new Blob([binaryData], { type: effectiveMime });
            } else {
                effectiveMime = effectiveMime || 'text/plain';
                updatedBlob = new Blob([textContent], { type: effectiveMime });
            }

            // 2. Upload to Firebase Storage as next version
            const storageResult = await storageService.uploadDocument(
                targetDocId,
                updatedBlob,
                nextVersionNumber,
                fileName
            );

            // 3. AI Document Analysis & Revision Diffing
            let aiResult = null;
            try {
                aiResult = await aiService.analyzeDocumentFile({
                    storagePath: storageResult.path,
                    mimeType: storageResult.mimeType || effectiveMime,
                    fileName: fileName,
                    fileSize: storageResult.sizeBytes,
                    isVersionUpdate: true,
                    previousStoragePath: storagePath,
                    previousMimeType: activeVersion?.mimeType,
                    nextVersion: nextVersionNumber,
                });
            } catch (aiErr) {
                console.warn('AI analysis error on in-app revision save:', aiErr);
            }

            // 4. Insert new DocumentVersion record with AI diff & embeddings
            await insertDocumentVersion({
                documentId: targetDocId,
                uploaderId: activeUserId,
                version: nextVersionNumber,
                path: storageResult.path,
                sizeBytes: storageResult.sizeBytes,
                mimeType: storageResult.mimeType || effectiveMime,
                classification: classification,
                changeSummary: changeSummary.trim() || aiResult?.changeSummary || `In-app revision v${nextVersionNumber}.0`,
                summary: aiResult?.summary || activeVersion?.summary || null,
                embedding: aiResult?.embedding || null,
            });

            // 5. Update parent document updatedAt
            await useDocumentStore.getState().updateDocument(targetDocId, {
                updatedAt: new Date().toISOString(),
            });

            showToast({
                type: 'success',
                title: 'New Version Saved',
                description: `Successfully published version v${nextVersionNumber}.0.`,
            });

            if (isSpreadsheet) {
                setInitialSpreadsheetRows(JSON.parse(JSON.stringify(editableSpreadsheetRows)));
                setInitialSpreadsheetSheets([...spreadsheetData.sheets]);
            } else {
                setInitialTextContent(textContent);
            }
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
                <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 border-b border-surface-border bg-surface shrink-0 gap-3">
                    {/* LEFT: ICON, TITLE, COMPACT VERSION & STATUS */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="p-1.5 rounded-lg bg-accent-background text-accent shrink-0 flex items-center justify-center">
                            {renderCategoryIcon(fileExtension, 'h-4 w-4 shrink-0')}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <h2
                                    className="text-sm font-semibold text-text truncate max-w-[140px] sm:max-w-[240px] md:max-w-[320px] lg:max-w-[420px]"
                                    title={fileName}
                                >
                                    {fileName}
                                </h2>
                                <span className="px-1.5 py-0.2 rounded text-[11px] font-mono bg-surface-hover text-text-muted border border-surface-border shrink-0">
                                    v{versionNumber}.0
                                </span>
                                {classification !== constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED && (
                                    <Badge variant={classificationVariant} label={classification} className="!text-[10px] !px-1.5 !py-0 shrink-0 hidden sm:inline-flex" />
                                )}
                                {isArchived && (
                                    <Badge variant="error" label="Archived" className="!text-[10px] !px-1.5 !py-0 shrink-0" />
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-text-muted leading-none mt-0.5">
                                <span>{formattedSize}</span>
                                <span>•</span>
                                <span>{fileExtension.toUpperCase() || 'FILE'}</span>
                                {activeVersion?.createdAt && (
                                    <>
                                        <span className="hidden md:inline">•</span>
                                        <span className="hidden md:inline">Modified {formatDateTime(activeVersion.createdAt)}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: ACTIONS (GOOGLE REDIRECT, EDIT, DOWNLOAD, CLOSE) */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* FORMAT-SPECIFIC GOOGLE SUITE REDIRECTION BUTTON */}
                        {googleApp && (
                            <button
                                type="button"
                                onClick={handleOpenInGoogleApp}
                                disabled={isLoading || !downloadUrl}
                                className={`inline-flex items-center justify-center h-9 px-3 rounded-md text-sm font-medium border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed gap-2 ${googleApp.colorClass}`}
                                title={googleApp.tooltip}
                            >
                                <GoogleAppIcon type={googleApp.iconType} className="h-4 w-4 shrink-0" />
                                <span className="hidden md:inline">{googleApp.name}</span>
                            </button>
                        )}

                        {/* EDIT ACTION: ONLY FOR EDITABLE FILES / SPREADSHEETS AND ACTIVE RECORDS */}
                        {(isEditable || isSpreadsheet) && !isArchived && (
                            !isEditing ? (
                                <Button
                                    variant="secondary"
                                    leadingIcon={Edit3}
                                    onClick={() => setIsEditing(true)}
                                    disabled={isLoading}
                                    title="Edit file contents in browser"
                                >
                                    Edit
                                </Button>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            if (isSpreadsheet) {
                                                setEditableSpreadsheetRows(JSON.parse(JSON.stringify(initialSpreadsheetRows)));
                                                setSpreadsheetData((prev) => ({
                                                    ...prev,
                                                    sheets: [...initialSpreadsheetSheets],
                                                    rowsBySheet: JSON.parse(JSON.stringify(initialSpreadsheetRows)),
                                                }));
                                                setActiveSpreadsheetSheet(initialSpreadsheetSheets[0] || '');
                                            } else {
                                                setTextContent(initialTextContent);
                                            }
                                            setIsEditing(false);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        leadingIcon={Save}
                                        onClick={() => setIsSaveModalOpen(true)}
                                        disabled={!hasUnsavedChanges}
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            )
                        )}

                        {/* DOWNLOAD ACTION: UNIVERSAL */}
                        <Button
                            variant="secondary"
                            leadingIcon={Download}
                            onClick={handleDownload}
                            disabled={isLoading}
                            title="Download file to computer"
                        >
                            <span className="hidden sm:inline">Download</span>
                        </Button>

                        {/* CLOSE BUTTON */}
                        <button
                            type="button"
                            onClick={handleRequestClose}
                            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                            title="Close viewer (Esc)"
                        >
                            <X className={ICON_STYLE} />
                        </button>
                    </div>
                </div>

                {/* TOPBAR PROGRESSIVE LOADING BAR */}
                {loadProgress > 0 && (
                    <div className="w-full h-1 bg-surface-border overflow-hidden shrink-0 relative">
                        <div
                            className="h-full bg-accent transition-all duration-300 ease-out"
                            style={{
                                width: `${loadProgress}%`,
                                backgroundImage: 'linear-gradient(90deg, var(--color-accent, #2563eb) 0%, #3b82f6 100%)',
                                boxShadow: '0 0 8px rgba(37, 99, 235, 0.5)',
                            }}
                        />
                    </div>
                )}

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

                {/* 3. DYNAMIC CONTENT VIEWPORT */}
                <div className={`relative flex-1 bg-surface-hover/20 overflow-hidden flex flex-col p-2 sm:p-4 select-text ${isLoading || loadError ? 'items-center justify-center' : 'items-stretch'}`}>
                    {/* LOADING STATE */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center gap-2 p-8 text-center animate-pulse">
                            <p className="text-sm font-medium text-text">
                                {loadingMessage}
                                {loadingElapsedSec > 0 && (
                                    <span className="ml-2 font-mono text-xs text-text-muted">
                                        ({loadingElapsedSec}s)
                                    </span>
                                )}
                            </p>
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

                            {/* B. DOCX WORD PROCESSOR PREVIEW (AUTHENTIC PAPER LIGHT MODE) */}
                            {isDocx && (
                                <div className="w-full h-full overflow-y-auto overflow-x-auto p-4 sm:p-8 bg-zinc-200/90 dark:bg-zinc-900 rounded-lg select-text">
                                    <style>{`
                                        .docx-render-host .docx-wrapper {
                                            background: transparent !important;
                                            padding: 0 !important;
                                            display: flex !important;
                                            flex-direction: column !important;
                                            align-items: center !important;
                                            width: 100% !important;
                                        }
                                        .docx-render-host section.docx,
                                        .docx-render-host article.docx {
                                            background: #ffffff !important;
                                            color: #18181b !important;
                                            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12) !important;
                                            border: 1px solid #d4d4d8 !important;
                                            border-radius: 4px !important;
                                            margin-bottom: 24px !important;
                                            box-sizing: border-box !important;
                                        }
                                    `}</style>
                                    <div
                                        ref={docxContainerRef}
                                        className="docx-render-host w-full min-h-full flex flex-col items-center"
                                    />
                                </div>
                            )}

                            {/* C. SPREADSHEET TABLE PREVIEW & EDITOR (AUTHENTIC EXCEL CANVAS & CONTROLS) */}
                            {isSpreadsheet && (
                                <div className="w-full h-full flex flex-col bg-white text-zinc-900 rounded-lg border border-zinc-300 overflow-hidden shadow-xs">
                                    {/* EXCEL GRID VIEWPORT */}
                                    <div className="flex-1 overflow-auto bg-white">
                                        {(() => {
                                            const activeRows = editableSpreadsheetRows[activeSpreadsheetSheet] || [];
                                            const colCount = Math.max(5, ...activeRows.map((r) => (Array.isArray(r) ? r.length : 0)));
                                            const rowCount = activeRows.length;

                                            if (rowCount === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 py-12 text-xs">
                                                        <FileSpreadsheet className="h-8 w-8 mb-2 opacity-40" />
                                                        <span>Sheet is empty.</span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <table className="border-collapse text-xs w-max min-w-full font-sans select-text">
                                                    <thead className="sticky top-0 z-10 bg-zinc-100 backdrop-blur-xs">
                                                        <tr>
                                                            {/* CORNER CELL */}
                                                            <th className="sticky left-0 z-20 w-12 min-w-[48px] px-2 py-1.5 bg-zinc-100 border border-zinc-300 text-center font-mono text-[11px] text-zinc-500 select-none">
                                                                #
                                                            </th>
                                                            {/* COLUMN HEADERS: A, B, C... */}
                                                            {Array.from({ length: colCount }).map((_, cIdx) => (
                                                                <th
                                                                    key={`col-${cIdx}`}
                                                                    className="min-w-[120px] max-w-[240px] px-3 py-1.5 border border-zinc-300 text-center font-mono text-[11px] font-semibold text-zinc-700 select-none bg-zinc-100"
                                                                >
                                                                    {getColumnHeader(cIdx)}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {activeRows.map((row, rIdx) => (
                                                            <tr key={`row-${rIdx}`} className="hover:bg-zinc-50 transition-colors">
                                                                {/* ROW NUMBER: 1, 2, 3... */}
                                                                <td className="sticky left-0 z-10 w-12 min-w-[48px] px-2 py-1 bg-zinc-100 border border-zinc-300 text-center font-mono text-[11px] text-zinc-500 select-none">
                                                                    {rIdx + 1}
                                                                </td>
                                                                {/* CELL DATA */}
                                                                {Array.from({ length: colCount }).map((_, cIdx) => {
                                                                    const val = Array.isArray(row) ? row[cIdx] : '';
                                                                    return (
                                                                        <td
                                                                            key={`cell-${rIdx}-${cIdx}`}
                                                                            className={`border border-zinc-200 p-0 align-top ${
                                                                                isEditing ? 'focus-within:ring-2 focus-within:ring-emerald-500 focus-within:z-2' : ''
                                                                            }`}
                                                                        >
                                                                            {isEditing ? (
                                                                                <input
                                                                                    id={`xlsx-cell-${rIdx}-${cIdx}`}
                                                                                    type="text"
                                                                                    value={val !== undefined && val !== null ? String(val) : ''}
                                                                                    onChange={(e) =>
                                                                                        handleSpreadsheetCellChange(
                                                                                            activeSpreadsheetSheet,
                                                                                            rIdx,
                                                                                            cIdx,
                                                                                            e.target.value
                                                                                        )
                                                                                    }
                                                                                    onKeyDown={(e) =>
                                                                                        handleCellKeyDown(
                                                                                            e,
                                                                                            activeSpreadsheetSheet,
                                                                                            rIdx,
                                                                                            cIdx,
                                                                                            rowCount,
                                                                                            colCount
                                                                                        )
                                                                                    }
                                                                                    className="w-full h-full px-2.5 py-1 text-xs text-zinc-900 bg-transparent outline-none font-mono border-none focus:bg-emerald-50/40"
                                                                                />
                                                                            ) : (
                                                                                <div className="px-2.5 py-1 text-xs text-zinc-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px]">
                                                                                    {val !== undefined && val !== null && String(val).trim() !== ''
                                                                                        ? String(val)
                                                                                        : '\u00A0'}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            );
                                        })()}
                                    </div>

                                    {/* BOTTOM EXCEL STATUS & SHEET TABS BAR */}
                                    <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100 border-t border-zinc-300 shrink-0 gap-2 overflow-x-auto text-zinc-700">
                                        {/* SHEET TABS */}
                                        <div className="flex items-center gap-1">
                                            {spreadsheetData.sheets.map((sheetName) => {
                                                const isActive = activeSpreadsheetSheet === sheetName;
                                                const isRenaming = renamingSheet === sheetName;

                                                if (isRenaming) {
                                                    return (
                                                        <input
                                                            key={sheetName}
                                                            autoFocus
                                                            type="text"
                                                            value={renameInputVal}
                                                            onChange={(e) => setRenameInputVal(e.target.value)}
                                                            onBlur={() => handleCommitRenameSheet(sheetName)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleCommitRenameSheet(sheetName);
                                                                if (e.key === 'Escape') setRenamingSheet(null);
                                                            }}
                                                            className="w-24 px-2 py-0.5 text-xs bg-white text-zinc-900 border-2 border-emerald-500 rounded outline-none font-medium"
                                                        />
                                                    );
                                                }

                                                return (
                                                    <button
                                                        key={sheetName}
                                                        type="button"
                                                        onClick={() => setActiveSpreadsheetSheet(sheetName)}
                                                        onDoubleClick={() => {
                                                            if (!isEditing) return;
                                                            handleStartRenameSheet(sheetName);
                                                        }}
                                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer shrink-0 select-none ${
                                                            isActive
                                                                ? 'bg-white text-emerald-700 font-semibold border-b-2 border-emerald-600 shadow-xs'
                                                                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/80'
                                                        }`}
                                                        title={isEditing ? 'Click to switch sheet. Double-click to rename.' : 'Click to switch sheet.'}
                                                    >
                                                        {sheetName}
                                                    </button>
                                                );
                                            })}

                                            {/* ADD SHEET BUTTON: EDIT ONLY */}
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={handleAddSheet}
                                                    className="p-1 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition-colors cursor-pointer"
                                                    title="Add new sheet"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* EDITING ACTIONS & STATS */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {isEditing && (
                                                <>
                                                    <Button
                                                        variant="secondary"
                                                        className="!h-6 !text-[11px] !px-2 !py-0 gap-1 bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                                                        leadingIcon={Plus}
                                                        onClick={() => handleAddSpreadsheetRow(activeSpreadsheetSheet)}
                                                        title="Add new row to active sheet"
                                                    >
                                                        Row
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        className="!h-6 !text-[11px] !px-2 !py-0 gap-1 bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                                                        leadingIcon={Plus}
                                                        onClick={() => handleAddSpreadsheetCol(activeSpreadsheetSheet)}
                                                        title="Add new column to active sheet"
                                                    >
                                                        Col
                                                    </Button>
                                                </>
                                            )}
                                            <span className="text-[11px] font-mono text-zinc-500">
                                                {(editableSpreadsheetRows[activeSpreadsheetSheet] || []).length} rows
                                            </span>
                                        </div>
                                    </div>
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
                                <div className="w-full h-full flex items-center justify-center p-4">
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
                                </div>
                            )}

                            {/* H. UNSUPPORTED / BINARY FALLBACK (PPTX, ZIP, ETC.) */}
                            {!isPdf && !isDocx && !isSpreadsheet && !isEditable && !isImage && !isVideo && !isAudio && (
                                <div className="w-full h-full flex items-center justify-center p-4">
                                    <div className="flex flex-col items-center justify-center gap-5 p-8 text-center max-w-md bg-surface rounded-xl border border-surface-border shadow-md">
                                        <div className="p-4 rounded-full bg-surface-hover text-text-muted">
                                            {renderCategoryIcon(fileExtension, 'h-10 w-10')}
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <h3 className="text-base font-bold text-text">{fileName}</h3>
                                            <p className="text-xs text-text-muted leading-relaxed">
                                                This file format ({fileExtension.toUpperCase() || 'Binary'}) cannot be rendered directly in the web browser. You can download and open it in its native desktop application using the Download button above.
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
                                    </div>
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

function getColumnHeader(colIdx) {
    let header = '';
    let temp = colIdx;
    while (temp >= 0) {
        header = String.fromCharCode((temp % 26) + 65) + header;
        temp = Math.floor(temp / 26) - 1;
    }
    return header;
}

function getGoogleAppConfig(ext, downloadUrl, userEmail) {
    if (!ext) return null;

    let name;
    let app;
    let colorClass;
    let iconType;

    if (ext === 'docx' || ext === 'doc' || ext === 'odt' || ext === 'rtf') {
        name = 'Google Docs';
        app = 'docs';
        colorClass = 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 dark:border-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-950/30';
        iconType = 'docs';
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        name = 'Google Sheets';
        app = 'sheets';
        colorClass = 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/30';
        iconType = 'sheets';
    } else if (ext === 'pptx' || ext === 'ppt' || ext === 'odp') {
        name = 'Google Slides';
        app = 'slides';
        colorClass = 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 dark:border-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-950/30';
        iconType = 'slides';
    } else if (ext === 'pdf') {
        name = 'Google Drive';
        app = 'drive';
        colorClass = 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30';
        iconType = 'drive';
    } else if (EDITABLE_EXTENSIONS.has(ext)) {
        name = 'Google Docs';
        app = 'docs';
        colorClass = 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 dark:border-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-950/30';
        iconType = 'docs';
    } else {
        return null;
    }

    const fallbackAppUrl = app === 'drive'
        ? 'https://drive.google.com/drive/u/0/my-drive'
        : app === 'sheets'
        ? 'https://docs.google.com/spreadsheets/u/0/'
        : app === 'slides'
        ? 'https://docs.google.com/presentation/u/0/'
        : 'https://docs.google.com/document/u/0/';

    const viewerTargetUrl = downloadUrl
        ? `https://docs.google.com/viewer?url=${encodeURIComponent(downloadUrl)}`
        : fallbackAppUrl;

    const redirectUrl = userEmail
        ? `https://accounts.google.com/AccountChooser?Email=${encodeURIComponent(userEmail)}&continue=${encodeURIComponent(viewerTargetUrl)}`
        : viewerTargetUrl;

    return {
        name,
        app,
        url: redirectUrl,
        colorClass,
        tooltip: `View in ${name}${userEmail ? ` (${userEmail})` : ''}`,
        iconType,
    };
}

function GoogleAppIcon({ type, className = "h-4 w-4" }) {
    if (type === 'sheets') {
        return (
            <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#0F9D58" />
                <path d="M14 2V8H20" fill="#87CEAB" />
                <path d="M8 12H16V18H8V12Z" fill="white" />
                <path d="M12 12V18M8 15H16" stroke="#0F9D58" strokeWidth="1.2" />
            </svg>
        );
    }
    if (type === 'slides') {
        return (
            <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#F4B400" />
                <path d="M14 2V8H20" fill="#FAD165" />
                <rect x="8" y="12" width="8" height="6" rx="0.8" fill="white" />
            </svg>
        );
    }
    if (type === 'drive') {
        return (
            <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.2 19.5L3.5 11.3L7 5.2H16.5L12 13L8.2 19.5Z" fill="#0066DA" />
                <path d="M16.5 5.2H7L11.5 13L20.5 13L16.5 5.2Z" fill="#00AC47" />
                <path d="M12 13L8.2 19.5L16 19.5L20.5 13L12 13Z" fill="#FFBA00" />
            </svg>
        );
    }
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#4285F4" />
            <path d="M14 2V8H20" fill="#A1C2FA" />
            <path d="M8 12H16M8 15H16M8 18H13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
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
