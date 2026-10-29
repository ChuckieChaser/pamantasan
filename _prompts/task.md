# Phase 3 Implementation Plan — On-Demand Fetching, Stamping UX & Alignment, Revert Access Cutoff & Shares Readership

## Goal

Eliminate the 10–15 second login bottleneck by moving from monolithic upfront data fetching to **per-page / on-demand fetching with loading spinners**, fix the **logout redirect race condition**, refine the **Officer PDF approval & interactive stamping workflow** (portal z-index fix, two-step confirmation with toggle, minimalized icon toolbar, corner-hover rotation, timestamp stamp, 1:1 coordinate alignment, metadata/classification preservation, and version swap), ensure **reverting a file revokes published member access** and **folder sharing propagates compact mandatory signature settings**, and fix the **Shares tab readership (`X/Y`)** to count only actual viewers (`Officer + Director + Published Members`) with a **collapsible reader list (`Sent` / `Read`)**.

---

## 3.1 Per-Page / On-Demand Data Fetching & Loading Spinners

### Root Cause Analysis

Currently, logging in takes 10–15+ seconds (and occasionally times out `FetchUserByUniversityId`) because:

1. [`src/App.jsx` (`handleLoginSuccess`, lines 474–480 & `handleGoogleLogin`, lines 510–516)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/App.jsx#L474-L516) blocks navigation after login by `await`ing `Promise.allSettled([fetchDepartments(), fetchUsers(), fetchDocuments()])`.
2. [`src/App.jsx` (lines 120–130)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/App.jsx#L120-L130) simultaneously fires `fetchDepartments()`, `fetchUsers()`, `fetchDocuments()`, `fetchDocumentRequests()`, and `fetchCoordinatorRequests()` globally on app mount—even before the user is authenticated or on pages that don't need them.
3. While data is being fetched in the background, metric cards on [`DashboardPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DashboardPage.jsx) and tables/grids in [`Browser.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/Browser.jsx) show `0` or `"No records available"` instead of a loading spinner.

### Proposed Changes

- **[`src/App.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/App.jsx)**:
    - **Login Handlers (`handleLoginSuccess` & `handleGoogleLogin`)**: Remove the blocking `await Promise.allSettled([fetchDepartments(), fetchUsers(), fetchDocuments()])` call before `navigate('/dashboard')`. Once `login()` / `loginWithGoogle()` authenticates the user, navigate **immediately** to `/dashboard` (or the onboarding step if pending).
    - **Route-Driven / On-Demand Fetching**: Remove the global mount `useEffect` that fetches all 5 stores unconditionally. Instead, trigger fetches **per active route / modal on demand**:
        - **Landing on `/dashboard` ([`src/pages/DashboardPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DashboardPage.jsx))**: Fetch dashboard-required data for the active role (`fetchDocuments()`, `syncAllDocumentShares()`, `fetchDepartments()`, and role-relevant requests/users/audit logs for the dashboard metric cards and charts).
        - **Opening `/documents` or `/archives` ([`src/pages/DocumentsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DocumentsPage.jsx))**: Fetch document repository data (`fetchDocuments()`, `syncAllDocumentShares()`, `fetchDepartments()`).
        - **Opening `/users` ([`src/pages/UsersPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/UsersPage.jsx))**: Fetch user management data (`fetchUsers()`, `fetchDepartments()`).
        - **Opening `/departments` ([`src/pages/DepartmentsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DepartmentsPage.jsx))**: Fetch department & faculty count data (`fetchDepartments()`, `fetchUsers()`).
        - **Opening `/requests` ([`src/pages/RequestsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/RequestsPage.jsx))**: Fetch `fetchDocumentRequests()`.
        - **Opening `/approvals` ([`src/pages/CoordinatorRequestsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/CoordinatorRequestsPage.jsx))**: Fetch `fetchCoordinatorRequests()`.
        - **Opening `/history` ([`src/pages/AuditLogsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/AuditLogsPage.jsx))**: Already fetches its own audit logs on mount (`auditService.fetchAuditLogs()`).
        - **Clicking Settings Modal ([`src/components/ui/Settings.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/ui/Settings.jsx))**: Only when `isOpen` is true, fetch the current user's settings (`userService.fetchUserSettingsByUserId(currentUser.id)`), Google SSO link (`userService.fetchUserGoogleByUserId(currentUser.id)`), and active sessions (`userService.fetchUserSessionsByUserId(currentUser.id)`).
        - **Clicking Account Profile Modal ([`src/components/ui/Account.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/ui/Account.jsx))**: Only when `isOpen` is true, fetch the current user's fresh profile record (`userService.fetchUserById(currentUser.id)`) and department name if not already loaded.
- **Loading Spinners While Fetching**:
    - **[`src/pages/DashboardPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DashboardPage.jsx)**: Pass an `isLoading` prop to `MetricCard` (derived from `useDocumentStore.isLoading || useUserStore.isLoading || isLoadingAudit`). When `isLoading` is true and data has not yet settled, render a spinning `<Loader2 className="h-5 w-5 animate-spin text-accent" />` inside the metric card value slot, chart cards, and activity feed instead of `0` or empty text.
    - **[`src/components/Browser.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/Browser.jsx)**: Support an `isLoading` prop (also auto-detecting store `isLoading` for `documents`, `users`, `departments`, `requests`, and `coordinator_requests` when `data.length === 0`). When `isLoading` is true, render a clean loading spinner panel inside the table/list/grid viewport (`"Loading records..."`) instead of `"No records available"`.

---

## 3.2 Logout Bug Fix (Synchronous Auth Clearing & Redirect)

### Root Cause Analysis

In [`src/App.jsx` (`handleSignOut`, lines 525–535)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/App.jsx#L525-L535):

```js
navigate('/login', { replace: true, state: { isLogout: true, from: null } });
await logout();
```

`navigate('/login')` is called **before** `await logout()`, while `currentUser` is still populated in `useAuthStore`! Worse, inside [`src/services/authService.js` (`logout`, lines 647–676)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/services/authService.js#L647-L676), `cachedCurrentUser = null` and `notifyAuthListeners(null)` are only executed **at the very end** after `await userService.deleteUserSession(sessionId)` (a remote GraphQL mutation). While that network request is in flight, any re-render or route check sees `currentUser !== null` and [`PublicRoute`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/Route.jsx#L66-L115) redirects the user right back to `/dashboard`!

### Proposed Changes

- **[`src/services/authService.js`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/services/authService.js#L647-L676)**:
    - Capture `sessionId = getStoredSessionId()` first, then **immediately and synchronously** clear `localStorage` auth keys, set `cachedCurrentUser = null`, and call `notifyAuthListeners(null)` **before** awaiting `userService.deleteUserSession(sessionId)` and `signOut(auth)`.
- **[`src/stores/useAuthStore.js`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/stores/useAuthStore.js#L35-L45)**:
    - Set `set({ currentUser: null, isLoading: false, error: null })` synchronously at the start of `logout()`.
- **[`src/App.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/App.jsx#L525-L535)**:
    - Close any open modals (`setIsSettingsOpen(false)`, `setIsAccountOpen(false)`), call `await logout()`, and navigate to `/login` with `replace: true`.

---

## 3.3 Approve Modal Clipping Fix, Two-Step Approve Confirmation → Stamping Flow & Multi-Approve Stamping Queue

### Root Cause Analysis

1. **Clipping**: [`src/components/OfficerSignatureStampModal.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/OfficerSignatureStampModal.jsx#L565-L570) renders inline as `<div className="fixed inset-0 z-50 ...">` without `createPortal(..., document.body)`. Because parent containers (`Container`, `DocumentsPage`, `Inspector`) create stacking contexts and overflow/transform boundaries, `z-50` inside those containers clips behind the TopBar, table filter dropdowns, global search, notification popover, and Inspector.
2. **Immediate Jump to Stamping & Missing Multi-Approve Queue**: Currently, clicking **Approve** on a single PDF in [`DocumentsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DocumentsPage.jsx#L2084-L2105) or [`Inspector.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/Inspector.jsx#L1940-L1985) bypasses the Approve Confirmation Modal and jumps straight into `OfficerSignatureStampModal`, while batch approving (`Approve all (N)`) or approving a folder skips PDF stamping altogether.

### Proposed Changes

- **Portal + Top-Layer Z-Index ([`src/components/OfficerSignatureStampModal.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/OfficerSignatureStampModal.jsx))**:
    - Wrap the modal in `createPortal(..., document.body)` with `z-[9999]` (above TopBar, Inspector, global search, notifications, and all standard modals) and lock `document.body.style.overflow = 'hidden'` while open.
- **Two-Step Approve Confirmation Modal (Single, Folder & Multi-Approve) → Sequential Stamping Queue ([`src/pages/DocumentsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DocumentsPage.jsx), [`src/components/Inspector.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/Inspector.jsx) & [`src/components/OfficerSignatureStampModal.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/OfficerSignatureStampModal.jsx))**:
    - **Step 1 — Approve Confirmation Modal (Single & Multi-Approve Stage)**:
        - Clicking **Approve** (whether on a single file, a folder, or a multi-selected batch `Approve all (N)`) always opens the **Approve Confirmation Modal** first (`confirmActionModal` in `DocumentsPage.jsx`, `inspectorConfirmAction` in `Inspector.jsx`).
        - Resolve all target items in the approval staging list, including any child PDF files inside selected folders.
        - When the staged selection contains 1 or more **PDF files**, render the **"Stamp Official Signature"** section inside the confirmation modal:
            - By default, all PDFs in the approval stage have stamping toggled **ON** (`stampSelectionMap[docId] = true`).
            - Any PDF where `requiresSignature === true` (on the document, its share record, or inherited from its parent folder) is locked to **ON** (`MANDATORY`) and cannot be untoggled.
            - Non-mandatory PDFs can be toggled **ON** or **OFF** (individually or via the master toggle when multiple PDFs are staged).
        - **Dynamic Primary Button in Confirmation Modal**:
            - When **0 PDFs** are toggled to stamp: Primary button label is **"Approve"** (or **"Approve ({N})"**). Clicking it approves all staged items immediately without opening the stamping modal.
            - When **1 or more PDFs (`K` PDFs)** are toggled to stamp: Primary button label is **"Approve with Stamp"** (single PDF) or **"Approve with Stamp ({K})"** (multi-approve / folder).
    - **Step 2 — Sequential Stamping Queue in `<OfficerSignatureStampModal />`**:
        - Clicking **"Approve with Stamp"** first approves any non-PDF items or untoggled PDFs in the staged batch, and then opens `<OfficerSignatureStampModal />` with the ordered queue of `K` PDFs that require stamping (`queue: [pdfTask1, pdfTask2, ...], currentIndex: 0`).
        - When `queue.length > 1`, `<OfficerSignatureStampModal />` displays a queue progress pill in the top header (`Queue: 1 of K • "DocumentName.pdf"`) and its primary action button reads **"Stamp & Next (1/K)"** for items `1 .. K-1` and **"Stamp & Finish (K/K)"** on the final item.
        - As the Officer stamps each PDF and clicks Next, `approveAndStampShare` executes for that PDF and the modal automatically loads the next PDF in the queue until all `K` PDFs are stamped and approved.

---

## 3.4 Minimalized Interactive Stamping Controls, Corner-Proximity Hover Rotation & Timestamp Stamp

### Proposed Changes in [`src/components/OfficerSignatureStampModal.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/OfficerSignatureStampModal.jsx) & [`src/services/storageService.js`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/services/storageService.js)

1. **Minimalized Icon-Only Floating Stamp Toolbar**:
    - Make the top floating options bar above a selected stamp compact and **icon-only** (removing verbose text labels like `"Duplicate"` and `"Delete"`), containing:
        - **Move Icon (`Move`)**: Drag handle (`onPointerDown` initiates move drag) so the Officer can drag from the move icon or anywhere inside the stamp body.
        - **Rotate Icons & Degree Button (`RotateCcw`, `RotateCw`, `{deg}°`)**: Keep the onclick `-90°` (`RotateCcw`), `+90°` (`RotateCw`), and clickable degree badge (`{Math.round(stamp.rotation)}°` to reset to `0°`).
        - **Scale Down / Up Icons (`ZoomOut` / `ZoomIn`)**: Decreases or increases stamp size proportionally.
        - **Copy Icon (`Copy`)**: Duplicates the selected stamp (icon-only).
        - **Delete Icon (`Trash2`)**: Removes the stamp (icon-only; disabled only if it is the last signature stamp when `isMandatorySign` is true, or always enabled if >1 signature stamp or if it is a timestamp stamp).
2. **Remove Middle Manual Rotate Stem Handle → Corner-Proximity Hover Rotation**:
    - Remove **only** the top-middle manual drag-rotate stem handle (the circular knob extending above the top-center border at `-top-8 left-1/2`), while keeping the onclick rotation icons and degree button in the floating toolbar.
    - Around each of the 4 corners of a selected stamp, render an outer corner-proximity hover zone sitting just outside the inner corner resize dot:
        - Hovering **directly on the corner dot** shows the diagonal resize cursor (`nwse-resize` / `nesw-resize`) and drags to resize.
        - Hovering **just a tad bit outside the corner** switches the cursor to a **rotate cursor** and dragging rotates the stamp smoothly (`Math.atan2`) around its center.
3. **Remove "Paste Stamp" & Add "+ Add Timestamp" (2-Line Date & Time)**:
    - In the top toolbar of `OfficerSignatureStampModal`, remove the **"Paste Stamp"** button.
    - Right beside **"+ Add Signature Stamp"**, add **"+ Add Timestamp"** (`Clock` icon).
    - Clicking **"+ Add Timestamp"** adds a draggable, resizable, rotatable timestamp stamp (`type: 'timestamp'`) on the current page formatted strictly as **2 lines** with just the current date and time of stamping:
        ```text
        October 29, 2026
        12:01 AM
        ```

        - Line 1: `now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })` (e.g., `October 26, 2026`)
        - Line 2: `now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })` (e.g., `11:45 PM`)
    - In [`src/services/storageService.js` (`stampPdfWithSignatures`)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/services/storageService.js#L814-L913):
        - Support stamps of `type: 'timestamp'` by rendering the 2-line date/time onto a high-DPI transparent PNG canvas (matching the preview aspect ratio and typography) and embedding it via `pdf-lib` at the exact normalized bounding box and rotation.

---

## 3.5 Fix Stamp Position Alignment Mismatch (`OfficerSignatureStampModal.jsx` vs `storageService.stampPdfWithSignatures`)

### Root Cause Analysis

In [`src/components/OfficerSignatureStampModal.jsx` (lines 835–855)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/OfficerSignatureStampModal.jsx#L835-L855), each stamp element is positioned using CSS `left` and `top`:

```js
left: `${stamp.xRatio * 100}%`,
top: `${stamp.yRatio * 100}%`,
width: `${stamp.widthRatio * 100}%`,
height: `${stamp.heightRatio * 100}%`,
```

This means `(xRatio, yRatio)` is the **top-left corner** of the stamp box, and the stamp's center in normalized page coordinates is:

- `centerXRatio = xRatio + widthRatio / 2`
- `centerYRatio = yRatio + heightRatio / 2`

However, in [`src/services/storageService.js` (lines 851–866)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/services/storageService.js#L851-L866), `stampPdfWithSignatures` calculated:

```js
const cx = xRatio * pageWidth;
const cy = (1 - yRatio) * pageHeight;
```

treating `(xRatio, yRatio)` as the **center** instead of the **top-left corner**! As a result, every stamped signature in the generated PDF was shifted **left by half its width (`widthRatio / 2`) and up by half its height (`heightRatio / 2`)** relative to where the Officer placed it!
Additionally, in `OfficerSignatureStampModal.jsx`, `canvas` had `maxWidth: '100%'`, which on narrow screens could shrink the `<canvas>` inside `pageContainerRef` if `pageSize` wasn't synced to the rendered size.

### Proposed Changes

- **[`src/services/storageService.js` (`stampPdfWithSignatures`, lines 845–900)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/services/storageService.js#L845-L900)**:
    - Compute the true center of the stamp from its top-left `(xRatio, yRatio)` and dimensions `(widthRatio, heightRatio)`:
        ```js
        const stampW = widthRatio * pageWidth;
        const stampH = heightRatio * pageHeight;
        const cx = (xRatio + widthRatio / 2) * pageWidth;
        const cy = (1 - (yRatio + heightRatio / 2)) * pageHeight;
        ```
    - When `rotDeg === 0`, draw at `x: xRatio * pageWidth`, `y: (1 - yRatio - heightRatio) * pageHeight`, `width: stampW`, `height: stampH`.
    - When `rotDeg !== 0`, rotate around `(cx, cy)` using the exact center offset formula so rotated stamps land at the exact same pixel position and angle as the CSS `transform-origin: center center` preview.
- **[`src/components/OfficerSignatureStampModal.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/OfficerSignatureStampModal.jsx)**:
    - Ensure the overlay container wraps the `<canvas>` tightly (`inline-block relative`) with `width` and `height` matching the `<canvas>` bounding box 1:1 so `getBoundingClientRect()` on `pageContainerRef` always equals the exact rendered PDF page area.

---

## 3.6 Preserve `classification`, `summary`, `embedding`, `textHash` & Swap Active Version After Stamping

### Root Cause Analysis

1. In [`src/stores/useDocumentStore.js` (`approveAndStampShare`, lines 2461–2474)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/stores/useDocumentStore.js#L2461-L2474), `documentService.insertDocumentVersion` is called with only `{ documentId, version, path, sizeBytes, mimeType, checksum, changeSummary, createdBy }`—omitting `classification`, `summary`, `embedding`, and `textHash` from `latestVer`! Because UI components read `classification` and `summary` from the latest `DocumentVersion`, the newly created stamped version lost its classification (showing missing/unclassified) and lost its AI summary and embedding!
2. After `approveAndStampShare` creates `v{nextVersionNumber}`, `selectedVersion` in `useDocumentStore` was not updated to the newly created version record.

### Proposed Changes

- **[`src/stores/useDocumentStore.js` (`approveAndStampShare`, lines 2460–2495)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/stores/useDocumentStore.js#L2460-L2495)**:
    - Pass `classification: latestVer?.classification || docItem?.classification || 'UNCLASSIFIED'`, `summary: latestVer?.summary || docItem?.summary || null`, `embedding: latestVer?.embedding || null`, and `textHash: latestVer?.textHash || null` into `documentService.insertDocumentVersion(...)`.
    - Immediately update `selectedVersion` in `useDocumentStore` (if `selectedVersion` belongs to `documentId`) and update the document item's `version`, `currentVersion`, `sizeBytes`, `size`, `classification`, and `summary` in store state so the Inspector and Documents table immediately reflect `v{nextVersionNumber}.0` with all classification and summary metadata intact.

---

## 3.7 Revert File Revokes Published Member Access (No Ghost Members) + 3-Column Share Modal with Tree-Structured Mandatory Stamp Selection & Folder Inheritance

### Root Cause Analysis

1. **Ghost Member Shares on Revert**:
    - In [`src/stores/useDocumentStore.js` (`revertDocumentVersion`, lines 728–805)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/stores/useDocumentStore.js#L728-L805), when a file is reverted, it loops over `existingShares` and resets shares with status `APPROVED`, `PUBLISHED`, `STASHED`, or `REJECTED` back to `PENDING_APPROVAL`—including individual member publication rows (`s.recipientId != null`)!
    - If a member-specific `DocumentShare` row (`recipientId: memberUser.id`) is left in the database (or set to `PENDING_APPROVAL` instead of deleted), that member still has a share row attached to the document (a "ghost member" share) even though the reverted document was sent back to the Officer for re-approval and has not been re-published by the Director yet!
2. **Share Modal Layout, Mandatory Stamp Selection & Folder Inheritance**:
    - In [`src/pages/DocumentsPage.jsx` (`ModalAffectedDocumentsSection` & Share to Department Modal, lines 220–372 & 5205–5512)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DocumentsPage.jsx#L5205-L5512), placing the affected/staged files section on top of the modal takes up vertical space and makes selecting mandatory-sign PDFs across folders awkward, and sharing a folder does not cascade `requiresSignature` cleanly to child PDFs.

### Proposed Changes

- **Delete Member Publication Shares on Revert ([`src/stores/useDocumentStore.js`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/stores/useDocumentStore.js#L728-L805) & [`src/services/documentService.js`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/services/documentService.js#L363-L393))**:
    - When a file is reverted (`revertDocumentVersion` in `useDocumentStore.js` and `revertToVersion` in `documentService.js`):
        - Partition `existingShares` for that document into:
            1. **Member-level shares** (`Boolean(s.recipient?.id ?? s.recipientId)`): **Delete** every member-level share via `documentService.deleteDocumentShare(s.id)` so all previously published department members are completely cut off from the file until the Officer re-approves and the Director re-publishes it.
            2. **Department-level shares** (`!(s.recipient?.id ?? s.recipientId)`): Reset status to `PENDING_APPROVAL` via `documentService.updateDocumentShareStatus(s.id, 'PENDING_APPROVAL', null)` so it flows back to the Department Officer cleanly.
        - Also sync any parent shared folder's status back to `PENDING_APPROVAL`.
- **3-Column Share Modal with Tree-Structured Affected Files & Mandatory Sign Tick Boxes ([`src/pages/DocumentsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DocumentsPage.jsx), [`src/stores/useDocumentStore.js`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/stores/useDocumentStore.js), [`src/components/Inspector.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/Inspector.jsx))**:
    - **3-Column Grid Layout in Share to Department Modal**:
        - Move the Affected / Staged Files section from the top into the **1st column** of a 3-column grid (`grid-cols-1 lg:grid-cols-12 gap-4 items-stretch`):
            1. **1st Column (`lg:col-span-4` — Affected / Staged Files Tree & Mandatory Sign)**:
                - Renders all staged items (`shareModalDocument`) in a **hierarchical directory tree** matching the folder `Contents` tab in `Inspector.jsx` (**folders sorted first**, expandable/collapsible with `ChevronRight`/`ChevronDown` and `Folder`/`FolderOpen` icons, indented child files/subfolders with `border-l` tree guide lines).
                - **Left-Side Tick Box (`Checkbox`) for Mandatory Sign**:
                    - Each PDF file node has a tick box on the left side to toggle `requiresSignature: true/false` for that PDF.
                    - Each Folder node (that contains descendant PDFs) also has a left-side tick box (`checked` when all child PDFs inside the folder are ticked, `indeterminate` when some are ticked) so ticking a folder automatically ticks/unticks **all** child PDF files inside that folder!
                    - The column header includes a master `"Mandatory Sign"` tick box to toggle all PDFs across the entire staged tree at once.
                - **Right-Side `-` (`Minus`) Button to Deselect Affected Files**:
                    - Each staged item row has a `-` (`Minus`) icon button on the right side to deselect/remove that file or folder from the staged items (`shareModalDocument`), dynamically pruning the selection (and closing the modal if all items are deselected).
            2. **2nd Column (`lg:col-span-4` — Target Departments Selection)**:
                - The existing Department Selection picker (unchanged).
            3. **3rd Column (`lg:col-span-4` — Active Department Shares)**:
                - The existing Active Shares list (unchanged).
    - **Folder Inheritance on Share & Approval**:
        - When sharing a folder (or batch containing folders), propagate each ticked PDF's `requiresSignature` state onto the created/updated child `DocumentShare` records in `useDocumentStore.shareDocumentRecursive`.
        - When an Officer approves a PDF file inside a shared folder, check `item.requiresSignature || shareRecord.requiresSignature || parentFolderShare.requiresSignature || documentService.getLocalRequiresSignature(item.id) || documentService.getLocalRequiresSignature(item.parentId)` so folder-level mandatory signing always locks the Officer's stamp toggle to `ON`.

---

## 3.8 Shares Tab Readership Count (`X/Y` Always Visible) & Collapsible Reader List (`Read` | `Sent`)

### Root Cause Analysis

In [`src/components/Inspector.jsx` (lines 4454–4596, 4848–4858 & 5003–5015)](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/Inspector.jsx#L4454-L5015):

1. The Readership bar (`X / Y read`) is currently wrapped in `{isDeptPublished && (...)}` (and `{isFilePublished && (...)}` for files inside folders), hiding readership tracking when the share is in `PENDING_APPROVAL`, `REJECTED`, `APPROVED`, or `STASHED`.
2. `totalDeptMembers` is computed from `deptEligibleReaders`, which includes **all** users in that department (`MEMBER`, `OFFICER`, `DIRECTOR`). If a department has 5 people (`1 Officer + 1 Director + 3 Members`) and the Director publishes the document to **only 1 Member**, the denominator `Y` still shows `5` (`1 / 5 read` or `3 / 5 read`), even though the other 2 Members were never published to and **cannot see the file**!

### Proposed Changes in [`src/components/Inspector.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/Inspector.jsx)

1. **Always-Visible, Stage-Scoped Viewers Set (`deptActualViewers`)**:
    - Always render the Readership (`X / Y read`) bar on every department share card (and every shared file inside a folder), regardless of whether the file is `PENDING_APPROVAL`, `REJECTED`, `APPROVED`, `STASHED`, or `PUBLISHED`.
    - Dynamically compute `deptActualViewers` (the exact users in that department who can currently see the file at its current workflow status):
        - **`PENDING_APPROVAL` or `REJECTED`**: All **Officer(s)** of that department (`isOfficerRole(u.role)`).
        - **`APPROVED` or `STASHED`**: All **Officer(s)** + **Director(s)** of that department (`isOfficerRole(u.role) || isDirectorRole(u.role)`).
        - **`PUBLISHED`**: All **Officer(s)** + **Director(s)** of that department + **only the specific Member(s)** to whom the Director published the file (`deptUserShares` with `PUBLISHED` status, or all department `MEMBER`s only if the department share was broadcast-published to the entire department).
    - Deduplicate by user ID to form `deptActualViewers` (`Y = deptActualViewers.length`), and count how many users in `deptActualViewers` have read the file (`X = actualViewersWhoRead.length` via `readMemberIdsSet` from audit logs + `share.isRead` / `share.readAt`).
    - Display **`X / Y read`** (e.g., `1 / 1 read` at Officer stage, `2 / 2 read` at Director stage, `3 / 3 read` when published to 1 member) in both the collapsed card subtitle and the always-visible **Readership** bar.
2. **Clickable / Collapsible Readership Breakdown (`Sent` | `Read`)**:
    - Make the **Readership (`X / Y read`)** bar clickable (with a `ChevronDown` / `ChevronUp` indicator).
    - Clicking it expands/collapses a compact list of all `Y` people in `deptActualViewers`, showing for each user:
        - Avatar + Full Name + Role Badge (`OFFICER`, `DIRECTOR`, `MEMBER`)
        - Their individual `Sent -> Read` status indicator (`Read` in accent color if they have viewed/opened/downloaded the file, or `Sent` in warning amber if they have not read it yet).

---

## Files Affected Summary

| File                                                                                                                                                                                                                                                      | Changes                                                                                                                                                                                                                                                                                                   |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/App.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/App.jsx)                                                                                                                                                                        | Remove blocking login `Promise.allSettled` fetches and global mount fetches; trigger route-scoped fetches; await `logout()` before navigating to `/login`.                                                                                                                                                |
| [`src/services/authService.js`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/services/authService.js)                                                                                                                                        | Clear `cachedCurrentUser` and notify auth listeners synchronously at the start of `logout()` before async session deletion.                                                                                                                                                                               |
| [`src/stores/useAuthStore.js`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/stores/useAuthStore.js)                                                                                                                                          | Synchronously clear `currentUser: null` on `logout()`.                                                                                                                                                                                                                                                    |
| [`src/pages/DashboardPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DashboardPage.jsx)                                                                                                                                        | Fetch dashboard-needed data on mount and display loading spinners in metric cards, charts, and activity tables while fetching.                                                                                                                                                                            |
| [`src/components/Browser.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/Browser.jsx)                                                                                                                                          | Render loading spinner state inside the table/list/grid container while page store data is loading.                                                                                                                                                                                                       |
| [`src/pages/DocumentsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DocumentsPage.jsx)                                                                                                                                        | On-demand document fetching; two-step Approve Confirmation Modal with "Stamp Official Signature" toggle (`Approve` vs `Approve with Stamp`); compact mandatory signature UI & folder child inheritance.                                                                                                   |
| [`src/pages/UsersPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/UsersPage.jsx)                                                                                                                                                | Fetch users & departments on mount (`useEffect`) and pass `isLoading` to `Browser`.                                                                                                                                                                                                                       |
| [`src/pages/DepartmentsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/DepartmentsPage.jsx)                                                                                                                                    | Fetch departments & users on mount (`useEffect`) and pass `isLoading` to `Browser`.                                                                                                                                                                                                                       |
| [`src/pages/RequestsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/RequestsPage.jsx) & [`src/pages/CoordinatorRequestsPage.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/pages/CoordinatorRequestsPage.jsx) | Fetch respective requests on mount and pass `isLoading` to `Browser`.                                                                                                                                                                                                                                     |
| [`src/components/ui/Settings.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/ui/Settings.jsx) & [`src/components/ui/Account.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/ui/Account.jsx)         | Fetch current user's settings/sessions/profile on modal open with loading spinners.                                                                                                                                                                                                                       |
| [`src/components/OfficerSignatureStampModal.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/OfficerSignatureStampModal.jsx)                                                                                                    | Render via `createPortal(..., document.body)` at `z-[9999]`; minimalize floating stamp toolbar to icons (`Move`, `Minus`, `Plus`, `Trash2`); replace manual rotate buttons with corner-proximity hover rotation; replace "Paste Stamp" with "+ Add Timestamp"; lock overlay dimensions 1:1 to `<canvas>`. |
| [`src/services/storageService.js`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/services/storageService.js)                                                                                                                                  | Fix `cx` and `cy` in `stampPdfWithSignatures` to convert top-left `(xRatio, yRatio)` to true center `(xRatio + widthRatio / 2, yRatio + heightRatio / 2)`; support rendering `timestamp` stamps into the PDF.                                                                                             |
| [`src/stores/useDocumentStore.js`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/stores/useDocumentStore.js) & [`src/services/documentService.js`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/services/documentService.js)     | Preserve `classification`, `summary`, `embedding`, `textHash` and swap active version in `approveAndStampShare`; delete member-specific publication shares on `revertDocumentVersion`; propagate `requiresSignature` across folders and child PDFs.                                                       |
| [`src/components/Inspector.jsx`](file:///c:/Users/Chuckie/Documents/charles/pamantasan/src/components/Inspector.jsx)                                                                                                                                      | Two-step Approve Confirmation Modal with stamp toggle; dynamic Shares tab Readership `X/Y` scoped to `Officer + Director + Published Members`; clickable collapsible reader list with `Sent` / `Read` status badges.                                                                                      |
