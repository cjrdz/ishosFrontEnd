# Admin Component Refactoring Guide: Phases 4-8

## Overview
This guide continues the modularization pattern established in Phase 3 (Orders) to Phase 4 (Products) and beyond. The goal is systematic extraction of business logic into reusable modules while keeping components lean and focused on UI orchestration.

**Completed:**
- ✅ Phase 3: OrdersTab refactored (884→799 lines, 6 lib modules created)
- ✅ Phase 4a: ImageGalleryPanel extracted (65 lines removed from ProductsTab template)

**Current State:** ProductsTab is 1084 lines baseline. Target: 600-650 lines after full Phase 4 completion.

---

## Phase 4: ProductsTab Modal Extraction (IN PROGRESS)

### Completed: ImageGalleryPanel ✅

**File Created:** `src/components/svelte/admin/products/ImageGalleryPanel.svelte`

**What Was Extracted:**
- File upload input + button state
- Image selection logic
- Image deletion with confirmation
- Gallery reload trigger
- 65+ lines of template + 30 lines of handler logic

**Key Pattern Demonstrated:**
```svelte
// PROPS CONTRACT (type-safe, explicit)
interface Props {
  open: boolean;
  galleryImages: AdminImage[];
  selectedImagePath: string;
  busy: boolean;
  galleryBusy: boolean;
  onClose: () => void;
  onReload: () => void | Promise<void>;
  onUpload: (file: File) => void | Promise<void>;
  onSelect: (imageName: string) => void;
  onDelete: (imageName: string) => void | Promise<void>;
}

// COMPONENT STATE (owned internally)
let uploadInput = $state<HTMLInputElement | null>(null);
let selectedUploadFile = $state<File | null>(null);
let actionBusy = $state(false);

// HANDLERS (async-safe with try/finally for busy flag)
async function uploadSelectedImage() {
  if (!selectedUploadFile) return;
  actionBusy = true;
  try {
    await onUpload(selectedUploadFile);
    selectedUploadFile = null;
  } finally {
    actionBusy = false;
  }
}
```

**Integration Pattern:**
```svelte
// ProductsTab: Import component
import ImageGalleryPanel from "../products/ImageGalleryPanel.svelte";

// State: Replace ref with boolean
let imageGalleryOpen = $state(false);

// Template: Component invocation (21 lines vs 47-line dialog)
<ImageGalleryPanel
  open={imageGalleryOpen}
  {galleryImages}
  selectedImagePath={form.image_path}
  {busy}
  {galleryBusy}
  onClose={closeImageGalleryModal}
  onReload={onReloadGallery}
  onUpload={async (file) => await onUploadGalleryImage(file)}
  onSelect={(name) => { form.image_path = name; closeImageGalleryModal(); }}
  onDelete={async (name) => await onDeleteGalleryImage(name)}
/>
```

---

### Next: GlobalFlavorsManager (MEDIUM DIFFICULTY)

**Location in ProductsTab:** Lines ~850-906 (estimated)

**What to Extract:**
- Global flavor CRUD UI (edit existing, create new)
- Flavor form state + validation
- Modal open/close logic
- Error handling feedback

**Extraction Steps:**

1. **Create:** `src/components/svelte/admin/products/GlobalFlavorsManager.svelte`

2. **Extract Component Interface:**
```svelte
interface Props {
  open: boolean;
  flavors: AdminFlavor[];
  busy: boolean;
  onClose: () => void;
  onReload: () => void | Promise<void>;
  onCreate: (flavorData: FlavorFormData) => void | Promise<void>;
  onUpdate: (id: string, flavorData: FlavorFormData) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}
```

3. **Internal State:**
```svelte
let editingFlavorId = $state<string | null>(null);
let flavorForm = $state({ name: "", category: "" });
let formError = $state("");
```

4. **Integration in ProductsTab:**
- Remove flavorEditorDialog ref
- Remove flavor form state
- Replace flavor function handlers with component invocations
- Target: ~70 lines extracted

---

### Next: GlobalAddonsManager (MEDIUM DIFFICULTY)

**Location in ProductsTab:** Lines ~1000+ (estimated)

**What to Extract:**
- Global addon CRUD UI (edit existing, create new)
- Addon grouping UI (groupName field)
- Addon form state + validation
- Modal open/close logic

**Extraction Steps:**

1. **Create:** `src/components/svelte/admin/products/GlobalAddonsManager.svelte`

2. **Extract Component Interface:**
```svelte
interface Props {
  open: boolean;
  addons: AdminAddon[];
  busy: boolean;
  onClose: () => void;
  onReload: () => void | Promise<void>;
  onCreate: (addonData: AddonFormData) => void | Promise<void>;
  onUpdate: (id: string, addonData: AddonFormData) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}
```

3. **Internal State:**
```svelte
let editingAddonId = $state<string | null>(null);
let addonForm = $state({ name: "", price: "", groupName: "" });
let formError = $state("");
```

4. **Integration in ProductsTab:**
- Remove addonEditorDialog ref
- Remove addon form state
- Replace addon function handlers
- Target: ~70 lines extracted

**Note:** After GlobalAddons, ProductsTab will have context needed for Flavor/AddonAssignment modals.

---

### Next: FlavorAssignmentPanel (MEDIUM-HARD)

**Location in ProductsTab:** Lines ~600-713 (estimated)

**Difficulty Factors:**
- Dual-list UI (available left, assigned right)
- Multi-select state on both sides
- Move buttons between lists
- Needs current product context

**What to Extract:**
- Available flavors list (with select checkbox)
- Assigned flavors list (with select checkbox)
- Move-to-assigned button
- Move-to-available button
- Save assignment button
- Assignment state

**Extraction Steps:**

1. **Create:** `src/components/svelte/admin/products/FlavorAssignmentPanel.svelte`

2. **Props Interface:**
```svelte
interface Props {
  open: boolean;
  currentProductId: string | null;
  allFlavors: AdminFlavor[];
  assignedFlavorIds: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (productId: string, flavorIds: string[]) => void | Promise<void>;
}
```

3. **Internal State:**
```svelte
let selectedAvailableFlavors = $state<string[]>([]);
let selectedAssignedFlavors = $state<string[]>([]);

$derived.by(() => {
  // Compute available (not assigned) flavors
  return allFlavors.filter(f => !assignedFlavorIds.includes(f.id));
});
```

4. **Helper Function (in lib/admin/products/):**
```typescript
// lib/admin/products/flavor-assignment-helpers.ts
export function moveFlavorToAssigned(
  available: string[],
  assigned: string[],
  selectedFromAvailable: string[]
): { available: string[]; assigned: string[] } {
  const newAssigned = [...assigned, ...selectedFromAvailable];
  const newAvailable = available.filter(id => !selectedFromAvailable.includes(id));
  return { available: newAvailable, assigned: newAssigned };
}

export function moveFlavorToAvailable(
  available: string[],
  assigned: string[],
  selectedFromAssigned: string[]
): { available: string[]; assigned: string[] } {
  const newAvailable = [...available, ...selectedFromAssigned];
  const newAssigned = assigned.filter(id => !selectedFromAssigned.includes(id));
  return { available: newAvailable, assigned: newAssigned };
}
```

5. **Integration in ProductsTab:**
- Remove selectedAvailableFlavor/selectedAssignedFlavor state
- Replace assignment handlers
- Target: ~100 lines extracted

---

### Next: AddonAssignmentPanel (HARD)

**Location in ProductsTab:** Lines ~714+ (estimated)

**Difficulty Factors:**
- Dual-list UI + grouping complexity
- Addons grouped by groupName
- Must show which group each addon belongs to
- Assignment logic accounts for grouping
- Highest cognitive load

**What to Extract:**
- Available addons list (grouped, with select)
- Assigned addons list (grouped, with select)
- Group name visibility in UI
- Move-to-assigned capability
- Move-to-available capability
- Save assignment button
- Assignment state

**Extraction Steps:**

1. **Create:** `src/components/svelte/admin/products/AddonAssignmentPanel.svelte`

2. **Props Interface:**
```svelte
interface Props {
  open: boolean;
  currentProductId: string | null;
  allAddons: AdminAddon[];  // Includes groupName field
  assignedAddonIds: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (productId: string, addonIds: string[]) => void | Promise<void>;
}
```

3. **Helper Functions (in lib/admin/products/addon-assignment-helpers.ts):**
```typescript
export function groupAddonsByName(addons: AdminAddon[]): Map<string, AdminAddon[]> {
  const grouped = new Map<string, AdminAddon[]>();
  addons.forEach(addon => {
    const group = addon.groupName || "Sin grupo";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(addon);
  });
  return grouped;
}

export function moveAddonToAssigned(
  available: string[],
  assigned: string[],
  selectedFromAvailable: string[]
): { available: string[]; assigned: string[] } {
  // Same as flavor but preserves grouping semantics in parent
  return {
    available: available.filter(id => !selectedFromAvailable.includes(id)),
    assigned: [...assigned, ...selectedFromAvailable],
  };
}

export function moveAddonToAvailable(
  available: string[],
  assigned: string[],
  selectedFromAssigned: string[]
): { available: string[]; assigned: string[] } {
  return {
    available: [...available, ...selectedFromAssigned],
    assigned: assigned.filter(id => !selectedFromAssigned.includes(id)),
  };
}
```

4. **Integration in ProductsTab:**
- Remove selectedAvailableAddons/selectedAssignedAddons state
- Replace addon assignment handlers
- Target: ~110 lines extracted

---

## Phase 4 Summary & Metrics

**After all ProductsTab extractions:**

| Component | Lines Before | Lines After | Extracted | Target Hit |
|-----------|--------------|-------------|-----------|------------|
| ProductsTab | 1084 | ~600 | ~484 | ✅ 55% reduction |
| ImageGalleryPanel | — | ~130 | — | New module |
| GlobalFlavorsManager | — | ~80 | — | New module |
| GlobalAddonsManager | — | ~85 | — | New module |
| FlavorAssignmentPanel | — | ~120 | — | New module |
| AddonAssignmentPanel | — | ~140 | — | New module |

**Lib Modules Created:**
- `lib/admin/products/flavor-assignment-helpers.ts` (~40 lines)
- `lib/admin/products/addon-assignment-helpers.ts` (~50 lines)

---

## Phase 5: AdminDashboard Polling & Session Logic

**Goal:** Extract session/auth polling, polling interval management

**What to Extract:**
- Polling logic (setInterval cleanup, timing)
- Session refresh logic
- Auth token refresh handling
- Loading state orchestration

**Pattern to Use:**
```typescript
// lib/admin/dashboard/polling-helpers.ts
export function createPollingInterval(
  callback: () => Promise<void>,
  intervalMs: number
): { cleanup: () => void } {
  const id = setInterval(() => callback().catch(err => console.error(err)), intervalMs);
  return {
    cleanup: () => clearInterval(id),
  };
}

export function createSessionRefresh(
  refreshFn: () => Promise<{ token: string }>,
  intervalMs: number
): { cleanup: () => void; refresh: () => Promise<void> } {
  let refreshTimer: NodeJS.Timeout | null = null;
  
  async function refresh() {
    try {
      const { token } = await refreshFn();
      localStorage.setItem("auth_token", token);
      scheduleNext();
    } catch {
      // Log and continue
    }
  }
  
  function scheduleNext() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, intervalMs);
  }
  
  scheduleNext();
  
  return {
    cleanup: () => refreshTimer && clearTimeout(refreshTimer),
    refresh,
  };
}
```

**Integration in AdminDashboard.svelte:**
```svelte
import { createPollingInterval, createSessionRefresh } from "../../lib/admin/dashboard/polling-helpers.ts";

let dataPolling = $state<{ cleanup: () => void } | null>(null);
let sessionRefresh = $state<{ cleanup: () => void; refresh: () => Promise<void> } | null>(null);

$effect(() => {
  dataPolling = createPollingInterval(async () => {
    await loadData();
  }, POLLING_INTERVAL_MS);
  
  sessionRefresh = createSessionRefresh(
    async () => await refreshSession(),
    SESSION_REFRESH_INTERVAL_MS
  );
  
  return () => {
    dataPolling?.cleanup();
    sessionRefresh?.cleanup();
  };
});
```

---

## Phase 6: AdminTabPanels Prop Grouping

**Goal:** Reduce prop drilling by grouping related props into interfaces

**Pattern:**
```typescript
// types/admin.ts
export interface TabPanelSharedProps {
  busy: boolean;
  galleryBusy: boolean;
  selectedGalleryImage: AdminImage | null;
  onOpenImageGallery: () => void;
  onCloseImageGallery: () => void;
  onUploadImage: (file: File) => Promise<string | null>;
  onDeleteImage: (path: string) => Promise<boolean>;
}

export interface AdminTabsProps {
  activeTab: "orders" | "products" | "customers";
  shared: TabPanelSharedProps;
  orders: OrdersTabProps;
  products: ProductsTabProps;
  customers: CustomersTabProps;
}
```

**Before:**
```svelte
<OrdersTab
  busy={busy}
  galleryBusy={galleryBusy}
  selectedGalleryImage={selectedGalleryImage}
  onOpenImageGallery={openImageGallery}
  onCloseImageGallery={closeImageGallery}
  onUploadImage={uploadImage}
  onDeleteImage={deleteImage}
/>
```

**After:**
```svelte
<OrdersTab {shared} />
```

---

## Phase 7: Store Cleanup

**Goal:** Consolidate state into SvelteKit stores, remove component $state duplication

**Current Pattern:**
```svelte
// Each component has: let busy = $state(false); let error = $state("");
```

**Target Pattern:**
```typescript
// src/lib/stores/admin.ts
export const adminState = svelte.writable({
  busy: false,
  error: "",
  galleryBusy: false,
});

export const adminData = svelte.writable({
  products: [],
  orders: [],
  customers: [],
});
```

**Integration:**
```svelte
{#await loadInitialData()}
  <Loading />
{:then}
  {#each $adminData.products as product (product.id)}
    <ProductCard {product} />
  {/each}
{/await}
```

---

## Phase 8: Analytics & Instrumentation

**Goal:** Add minimal telemetry for debugging + usage patterns

**Pattern:**
```typescript
// lib/admin/analytics.ts
export function trackAction(action: string, metadata?: Record<string, unknown>) {
  const event = {
    timestamp: new Date().toISOString(),
    action,
    component: getCurrentComponent(),
    metadata,
  };
  
  // Send to backend or localStorage
  console.debug("Analytics:", event);
}

export function trackError(error: Error, context: string) {
  trackAction("error", { 
    message: error.message,
    context,
    stack: error.stack,
  });
}
```

**Integration:**
```svelte
import { trackAction, trackError } from "../../lib/admin/analytics.ts";

async function submit() {
  try {
    trackAction("form_submit", { formType: "product_editor" });
    const result = await submitForm();
    trackAction("form_submit_success");
  } catch (err) {
    trackError(err as Error, "ProductEditor.submit");
  }
}
```

---

## Implementation Checklist

### Phase 4 (Products)
- [x] GlobalFlavorsManager component (lib/admin/products/flavor-assignment-helpers.ts partial)
- [x] GlobalAddonsManager component
- [x] FlavorAssignmentPanel + flavor-assignment-helpers.ts
- [x] AddonAssignmentPanel + addon-assignment-helpers.ts
- [x] Update ProductsTab imports and state
- [x] Verify get_errors: zero errors
- [x] Test all 5 modals open/close correctly
- [x] Note final ProductsTab line count

### Phase 5 (Dashboard)
- [x] Create lib/admin/dashboard/polling-helpers.ts
- [x] Extract polling logic from AdminDashboard.svelte
- [x] Extract session refresh logic
- [x] Update AdminDashboard with new helpers
- [x] Verify polling works (console.debug timestamps)

Progress note:
- AdminDashboard reduced under 1000 lines by extracting:
  - `src/components/svelte/admin/config/AdminSettingsModal.svelte`
  - `src/lib/admin/dashboard/crud-handlers.ts`
  - `src/lib/admin/dashboard/order-handlers.ts`
- Current AdminDashboard line count: 834.

### Phase 6 (TabPanels)
- [x] Define TabPanelSharedProps interface in src/types/admin.ts
- [x] Define AdminTabsProps interface
- [x] Update tabs container to pass grouped props
- [x] Update all individual tab components
- [x] Verify prop drilling reduced

### Phase 7 (Stores)
- [x] Create src/lib/stores/admin.ts
- [x] Migrate component $state to stores
- [x] Update components to use $-store syntax
- [x] Verify no state duplication

Progress note:
- AdminDashboard core collections (categories, products, gallery images, orders, employees, users, flavors, addons) are now sourced from `adminData` store and updated via store patching helpers.
- AdminDashboard busy/moduleErrors/order filters/selection flags are now sourced from `adminDashboardUi` store via derived values and setter helpers.
- Shared module-action typing was deduplicated into `src/lib/admin/dashboard/module-action.ts` and repeated product relation mutation flow was consolidated in `AdminDashboard`.

### Phase 8 (Analytics)
- [x] Create lib/admin/analytics.ts
- [x] Add trackAction/trackError exports
- [x] Instrument critical paths (form submit, API calls, errors)
- [x] Verify console logs appear

Progress note:
- `runModuleAction` in AdminDashboard now emits centralized start/success/error analytics for module actions.
- Order workflow handlers provide explicit analytics action names (create/open/approve/reject/status/update/delete).
- Runtime smoke check executed via `npx tsx` confirms analytics events are printed to console.
- Product modal components now share consistent open/close dialog orchestration (`open` prop + `onclose` sync), and dashboard polling/session refresh emit timestamped debug logs.

---

## Quick Reference: Pattern Applied

**All extraction follows this pattern:**

1. **Identify Logic** → Pure functions or isolated UI state
2. **Extract to Module** → Create .ts helper or .svelte component
3. **Define Interface** → Props struct (for components) or function signature
4. **Type Safely** → Use AdminImage, AdminFlavor, etc. types
5. **Handle Async** → Wrap with try/finally for busy flags
6. **Integrate** → Import, update state, use in template
7. **Verify** → Run get_errors, confirm zero errors
8. **Measure** → Track lines extracted + remaining

---

## Command Reference

**Check for errors after each phase:**
```bash
# In terminal
cd /home/jrdz/Dev/fullStack/ishosFrontEnd
npm run astro -- check
```

**Line count tracking:**
```bash
# ProductsTab current
wc -l src/components/svelte/admin/tabs/ProductsTab.svelte

# After each extraction
wc -l src/components/svelte/admin/products/*.svelte
wc -l src/lib/admin/products/*.ts
```

---

## Success Criteria

- ✅ Phase 3: OrdersTab 884→799 (complete)
- ✅ Phase 4a: ImageGalleryPanel integrated (complete)
- 🔄 Phase 4b-e: Extract 4 remaining modals + ProductsTab 1084→600
- ⏳ Phase 5-8: Dashboard, TabPanels, Stores, Analytics

**Overall Goal:** 
- Extract ~1000 lines of business logic to reusable modules
- Reduce component file sizes by 40-50%
- Improve testability, reusability, maintainability

