// --- ZIP UTILITIES ---
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC_TABLE[i] = c >>> 0;
}

const computeCrc32 = (uint8Array) => {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < uint8Array.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ uint8Array[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
};

const getDosDateTime = (date = new Date()) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);

    const dosTime = ((hours & 0x1F) << 11) | ((minutes & 0x3F) << 5) | (seconds & 0x1F);
    const dosDate = (((year - 1980) & 0x7F) << 9) | ((month & 0x0F) << 5) | (day & 0x1F);
    return { dosTime, dosDate };
};

export const createZipBlob = (files) => {
    const textEncoder = new TextEncoder();
    const localHeadersAndData = [];
    const centralDirectoryHeaders = [];
    let currentOffset = 0;
    const { dosTime, dosDate } = getDosDateTime(new Date());

    for (const file of files) {
        const nameBytes = textEncoder.encode(file.path.replace(/\\/g, '/'));
        const fileData = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
        const crc = computeCrc32(fileData);
        const size = fileData.length;

        // Local file header (30 bytes + name length)
        const localHeader = new Uint8Array(30);
        const localView = new DataView(localHeader.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(6, 0x0800, true); // UTF-8 filename flag
        localView.setUint16(8, 0, true);      // Store (no compression)
        localView.setUint16(10, dosTime, true);
        localView.setUint16(12, dosDate, true);
        localView.setUint32(14, crc, true);
        localView.setUint32(18, size, true);
        localView.setUint32(22, size, true);
        localView.setUint16(26, nameBytes.length, true);
        localView.setUint16(28, 0, true);

        localHeadersAndData.push(localHeader, nameBytes, fileData);

        // Central directory header (46 bytes + name length)
        const centralHeader = new Uint8Array(46);
        const centralView = new DataView(centralHeader.buffer);
        centralView.setUint32(0, 0x02014b50, true);
        centralView.setUint16(4, 20, true);
        centralView.setUint16(6, 20, true);
        centralView.setUint16(8, 0x0800, true);
        centralView.setUint16(10, 0, true);
        centralView.setUint16(12, dosTime, true);
        centralView.setUint16(14, dosDate, true);
        centralView.setUint32(16, crc, true);
        centralView.setUint32(20, size, true);
        centralView.setUint32(24, size, true);
        centralView.setUint16(28, nameBytes.length, true);
        centralView.setUint16(30, 0, true);
        centralView.setUint16(32, 0, true);
        centralView.setUint16(34, 0, true);
        centralView.setUint16(36, 0, true);
        centralView.setUint32(38, 0, true);
        centralView.setUint32(42, currentOffset, true);

        centralDirectoryHeaders.push(centralHeader, nameBytes);

        currentOffset += localHeader.length + nameBytes.length + fileData.length;
    }

    const centralDirOffset = currentOffset;
    let centralDirSize = 0;
    for (const chunk of centralDirectoryHeaders) {
        centralDirSize += chunk.length;
    }

    // End of central directory record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, files.length, true);
    eocdView.setUint16(10, files.length, true);
    eocdView.setUint32(12, centralDirSize, true);
    eocdView.setUint32(16, centralDirOffset, true);
    eocdView.setUint16(20, 0, true);

    return new Blob([...localHeadersAndData, ...centralDirectoryHeaders, eocd], {
        type: 'application/zip',
    });
};
