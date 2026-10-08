const constants = {
    DOCUMENT_VERSIONS_CLASSIFICATION: {
        PUBLIC: 'PUBLIC',
        PRIVATE: 'PRIVATE',
        RESTRICTED: 'RESTRICTED',
        CONFIDENTIAL: 'CONFIDENTIAL',
        UNCLASSIFIED: 'UNCLASSIFIED',
    }
};

function determineDocumentClassification(textContent = '', fileName = '') {
    const raw = (textContent || '').trim();
    const lower = raw.toLowerCase();

    if (!raw) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;
    }

    // 1. Explicit in-document security declarations (Highest Authority):
    if (
        /\bclassification\s*[:—\-]\s*confidential\b/i.test(raw) ||
        /\bconfidential\s+memorandum\b/i.test(raw) ||
        /\bstrictly\s+confidential\b/i.test(raw) ||
        /\bconfidential\s*[-—]\s*for\s+authorized\s+personnel\s+only\b/i.test(raw) ||
        /\btreated\s+as\s+confidential\b/i.test(raw) ||
        /\bkeep\s+confidential\b/i.test(raw) ||
        /\bfor\s+authorized\s+personnel\s+only\b/i.test(raw)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
    }

    if (
        /\bclassification\s*[:—\-]\s*restricted\b/i.test(raw) ||
        /\bstrictly\s+restricted\b/i.test(raw) ||
        /\brestricted\s+memorandum\b/i.test(raw) ||
        /\bfor\s+board\s+eyes\s+only\b/i.test(raw) ||
        /\bexecutive\s+session\s+only\b/i.test(raw)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED;
    }

    if (
        /\bclassification\s*[:—\-]\s*public\b/i.test(raw) ||
        /\bfor\s+immediate\s+release\b/i.test(raw) ||
        /\bpress\s+release\b/i.test(raw) ||
        /\bcampus[- ]wide\s+announcement\b/i.test(raw) ||
        /\bpublic\s+advisory\b/i.test(raw) ||
        /\bgeneral\s+circular\b/i.test(raw)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC;
    }

    if (
        /\bclassification\s*[:—\-]\s*private\b/i.test(raw) ||
        /\bprivate\s+memorandum\b/i.test(raw) ||
        /\bfor\s+department\s+eyes\s+only\b/i.test(raw) ||
        /\binternal\s+use\s+only\b/i.test(raw) ||
        /\binternal\s+administrative\s+use\s+only\b/i.test(raw)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
    }

    // 2. Sensitive personal & legal records (CONFIDENTIAL):
    if (
        /\b(transcript\s+of\s+records|scholastic\s+record|gwa\b|cwa\b|student\s+grade|grades\s+evaluation)\b/i.test(lower) ||
        /\b(personal\s+data\s+sheet|form\s+201|payroll\s+ledger|salary\s+scale|compensation\s+record)\b/i.test(lower) ||
        /\b(disciplinary\s+case|administrative\s+charge|legal\s+settlement|affidavit\s+of)\b/i.test(lower) ||
        /\b(medical\s+certificate|psychological\s+evaluation|health\s+clearance)\b/i.test(lower)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL;
    }

    // 3. Managerial & Strategic oversight (RESTRICTED):
    if (
        /\b(annual\s+audit\s+report|coa\s+audit|audit\s+finding|financial\s+audit)\b/i.test(lower) ||
        /\b(budget\s+proposal|budget\s+request|appropriation\s+request|fiscal\s+allocation)\b/i.test(lower) ||
        /\b(faculty\s+evaluation|performance\s+appraisal|board\s+resolution|board\s+deliberation)\b/i.test(lower)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED;
    }

    // 4. Internal Institutional operational records (PRIVATE):
    if (
        /\b(meeting\s+minutes|departmental\s+meeting|committee\s+meeting)\b/i.test(lower) ||
        /\b(course\s+syllabus|course\s+outline|curriculum\s+guide|learning\s+plan)\b/i.test(lower) ||
        /\b(purchase\s+requisition|inspection\s+report|inventory\s+list)\b/i.test(lower) ||
        /\b(memorandum|circular|office\s+order|special\s+order|department\s+heads)\b/i.test(lower)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE;
    }

    // 5. Public / Community publications (PUBLIC):
    if (
        /\b(academic\s+calendar|student\s+handbook|university\s+manual|commencement\s+program)\b/i.test(lower) ||
        /\b(newsletter|bulletin|announcement|general\s+assembly)\b/i.test(lower)
    ) {
        return constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC;
    }

    return constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED;
}

console.log('Memo class:', determineDocumentClassification('MEMORANDUM\nTO: All Department Heads\nFROM: Office of the President\nSUBJECT: Annual Review', 'sample.docx'));
