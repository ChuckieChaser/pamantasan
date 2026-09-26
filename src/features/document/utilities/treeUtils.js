// --- DOCUMENT TREE UTILITIES ---
export const buildFolderDownloadManifest = (folderItem, allDocuments = [], allVersions = []) => {
    if (!folderItem || !folderItem.id) {
        return [];
    }

    const manifest = [];

    const collectChildren = (parentId, prefix) => {
        const children = (allDocuments || []).filter(
            (doc) => (doc.parent?.id ?? doc.parentId) === parentId && !doc.isArchived
        );

        for (const child of children) {
            if (child.isFolder) {
                const nextPrefix = `${prefix}${child.name || child.title || 'folder'}/`;
                collectChildren(child.id, nextPrefix);
            } else {
                const docVers = (allVersions || []).filter(
                    (v) => (v.document?.id ?? v.documentId) === child.id
                );
                const latestVer = docVers.length > 0
                    ? [...docVers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                    : null;
                const path = latestVer?.path || child.path || child.url || child.downloadUrl;
                const fileName = child.name || child.title || (path ? path.split('/').pop() : 'file');

                if (path) {
                    manifest.push({
                        relativePath: `${prefix}${fileName}`,
                        storagePath: path,
                        fileName: fileName,
                    });
                }
            }
        }
    };

    collectChildren(folderItem.id, '');
    return manifest;
};
