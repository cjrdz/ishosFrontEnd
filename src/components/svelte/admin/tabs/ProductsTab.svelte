<script lang="ts">
  import type { AdminImage, Category, Product, Flavor, Addon } from "../../../../lib/api/admin";
  import { formatCurrency } from "../../../../lib/utils/formatters";

  interface Props {
    categories: Category[];
    products: Product[];
    flavors: Flavor[];
    addons: Addon[];
    galleryImages: AdminImage[];
    busy: boolean;
    galleryBusy: boolean;
    moduleError: string;
    onCreate: (payload: {
      name: string;
      description: string;
      price: number;
      category_id: string;
      image_path?: string;
      is_available: boolean;
    }) => void;
    onUpdate: (id: string, payload: {
      name: string;
      description: string;
      price: number;
      category_id: string;
      image_path?: string;
      is_available: boolean;
    }) => void;
    onDelete: (id: string) => void;
    onCreateFlavor: (payload: {
      name: string;
      display_order: number;
      is_seasonal: boolean;
    }) => void;
    onUpdateFlavor: (id: string, payload: {
      name: string;
      display_order: number;
      is_seasonal: boolean;
      is_active: boolean;
    }) => void;
    onDeleteFlavor: (id: string) => void;
    onCreateAddon: (payload: {
      name: string;
      price: number;
      group_name: string;
      display_order: number;
    }) => void;
    onUpdateAddon: (
      id: string,
      payload: {
        name: string;
        price: number;
        group_name: string;
        display_order: number;
        is_active: boolean;
      },
    ) => void;
    onDeleteAddon: (id: string) => void;
    flavorBusy: boolean;
    addonBusy: boolean;
    flavorError: string;
    addonError: string;
    onLinkFlavor: (productId: string, flavorId: string) => Promise<void>;
    onUnlinkFlavor: (productId: string, flavorId: string) => Promise<void>;
    onLinkAddon: (productId: string, addonId: string) => Promise<void>;
    onUnlinkAddon: (productId: string, addonId: string) => Promise<void>;
    onReloadGallery: () => void | Promise<void>;
    onUploadGalleryImage: (file: File) => Promise<string | null>;
    onDeleteGalleryImage: (path: string) => Promise<boolean>;
  }

  let {
    categories,
    products,
    flavors,
    addons,
    galleryImages,
    busy,
    galleryBusy,
    moduleError,
    onCreate,
    onUpdate,
    onDelete,
    onCreateFlavor,
    onUpdateFlavor,
    onDeleteFlavor,
    onCreateAddon,
    onUpdateAddon,
    onDeleteAddon,
    flavorBusy,
    addonBusy,
    flavorError,
    addonError,
    onLinkFlavor,
    onUnlinkFlavor,
    onLinkAddon,
    onUnlinkAddon,
    onReloadGallery,
    onUploadGalleryImage,
    onDeleteGalleryImage,
  }: Props = $props();
  let productEditorDialog: HTMLDialogElement | null = null;
  let imageGalleryDialog: HTMLDialogElement | null = null;
  let flavorAssignmentDialog: HTMLDialogElement | null = null;
  let addonAssignmentDialog: HTMLDialogElement | null = null;
  let confirmDialog: HTMLDialogElement | null = null;
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);
  let uploadInput: HTMLInputElement | null = null;
  let selectedUploadFile = $state<File | null>(null);
  let galleryActionBusy = $state(false);
  let flavorAddonBusy = $state(false);
  let editingProductId = $state<string | null>(null);
  let flavorEditorDialog: HTMLDialogElement | null = null;
  let addonEditorDialog: HTMLDialogElement | null = null;
  let currentProductForFlavorAddonId = $state<string | null>(null);
  let editingFlavorId = $state<string | null>(null);
  let editingAddonId = $state<string | null>(null);
  let draggingFlavorId = $state<string | null>(null);
  let draggingFlavorFromAssigned = $state(false);
  let draggingAddonId = $state<string | null>(null);
  let draggingAddonFromAssigned = $state(false);
  let selectedAvailableFlavorIds = $state<string[]>([]);
  let selectedAssignedFlavorIds = $state<string[]>([]);
  let selectedAvailableAddonIds = $state<string[]>([]);
  let selectedAssignedAddonIds = $state<string[]>([]);

  let flavorForm = $state({
    id: "",
    name: "",
    display_order: 0,
    is_seasonal: false,
    is_active: true,
  });

  let addonForm = $state({
    id: "",
    name: "",
    price: 0,
    group_name: "extras",
    display_order: 0,
    is_active: true,
  });

  const DEFAULT_ADDON_GROUP_NAME = "extras";
  const ADDON_GROUP_LABELS: Record<string, string> = {
    toppings: "Toppings",
    jalea: "Jalea",
    extras: "Extras",
  };

  function normalizeAddonGroupName(value: string): string {
    const normalized = value.trim().toLowerCase();
    return normalized || DEFAULT_ADDON_GROUP_NAME;
  }

  function addonGroupLabel(value: string): string {
    const normalized = normalizeAddonGroupName(value);
    if (ADDON_GROUP_LABELS[normalized]) {
      return ADDON_GROUP_LABELS[normalized];
    }

    return normalized
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  }

  function sortByDisplayOrderAndName<T extends { display_order: number; name: string }>(left: T, right: T): number {
    return left.display_order - right.display_order || left.name.localeCompare(right.name);
  }

  function groupAddonsByGroup(source: Addon[]): Array<{ key: string; label: string; items: Addon[] }> {
    const grouped = new Map<string, Addon[]>();

    for (const addon of source) {
      const key = normalizeAddonGroupName(addon.group_name);
      const existing = grouped.get(key) ?? [];
      existing.push(addon);
      grouped.set(key, existing);
    }

    return Array.from(grouped.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, items]) => ({
        key,
        label: addonGroupLabel(key),
        items: items.slice().sort((left, right) => sortByDisplayOrderAndName(left, right)),
      }));
  }

  let productVisibilityFilter = $state<"all" | "active" | "inactive">("all");
  const filteredProducts = $derived(
    productVisibilityFilter === "all"
      ? products
      : products.filter((product) =>
          productVisibilityFilter === "active" ? product.is_available : !product.is_available,
        ),
  );
  const productVisibilityFilterLabel = $derived(
    productVisibilityFilter === "all"
      ? "Todos"
      : productVisibilityFilter === "active"
        ? "Activos"
        : "Inactivos",
  );

  let form = $state({
    id: "",
    name: "",
    description: "",
    price: "",
    category_id: "",
    image_path: "",
    is_available: true,
  });

  const isEditing = $derived(!!editingProductId);
  const selectedGalleryImage = $derived(galleryImages.find((image) => image.name === form.image_path) ?? null);
  const currentProductForFlavorAddon = $derived(
    currentProductForFlavorAddonId
      ? products.find((product) => product.id === currentProductForFlavorAddonId) ?? null
      : null,
  );
  const currentProductFlavors = $derived(
    (currentProductForFlavorAddon?.flavors ?? []).slice().sort((left, right) => sortByDisplayOrderAndName(left, right)),
  );
  const currentProductAddons = $derived(
    (currentProductForFlavorAddon?.addons ?? [])
      .slice()
      .sort((left, right) => {
        const leftGroup = normalizeAddonGroupName(left.group_name);
        const rightGroup = normalizeAddonGroupName(right.group_name);
        return leftGroup.localeCompare(rightGroup) || sortByDisplayOrderAndName(left, right);
      }),
  );
  const assignedActiveFlavors = $derived(currentProductFlavors.filter((flavor) => flavor.is_active));
  const assignedInactiveFlavors = $derived(currentProductFlavors.filter((flavor) => !flavor.is_active));
  const assignedActiveAddons = $derived(currentProductAddons.filter((addon) => addon.is_active));
  const assignedInactiveAddons = $derived(currentProductAddons.filter((addon) => !addon.is_active));

  const availableActiveFlavors = $derived(
    flavors
      .filter((flavor) => flavor.is_active && !currentProductFlavors.some((currentFlavor) => currentFlavor.id === flavor.id))
      .slice()
      .sort((left, right) => sortByDisplayOrderAndName(left, right)),
  );
  const availableInactiveFlavorsCount = $derived(
    flavors.filter((flavor) => !flavor.is_active && !currentProductFlavors.some((currentFlavor) => currentFlavor.id === flavor.id)).length,
  );

  const availableActiveAddons = $derived(
    addons
      .filter((addon) => addon.is_active && !currentProductAddons.some((currentAddon) => currentAddon.id === addon.id))
      .slice()
      .sort((left, right) => {
        const leftGroup = normalizeAddonGroupName(left.group_name);
        const rightGroup = normalizeAddonGroupName(right.group_name);
        return leftGroup.localeCompare(rightGroup) || sortByDisplayOrderAndName(left, right);
      }),
  );
  const availableInactiveAddonsCount = $derived(
    addons.filter((addon) => !addon.is_active && !currentProductAddons.some((currentAddon) => currentAddon.id === addon.id)).length,
  );
  const availableActiveAddonGroups = $derived(groupAddonsByGroup(availableActiveAddons));

  const sortedFlavors = $derived(
    flavors
      .slice()
      .sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name)),
  );

  const sortedAddons = $derived(
    addons
      .slice()
      .sort((left, right) => {
        const leftGroup = normalizeAddonGroupName(left.group_name);
        const rightGroup = normalizeAddonGroupName(right.group_name);
        return leftGroup.localeCompare(rightGroup) || left.display_order - right.display_order || left.name.localeCompare(right.name);
      }),
  );

  $effect(() => {
    if (!form.category_id && categories.length > 0) {
      form.category_id = categories[0].id;
    }
  });

  function resetForm() {
    editingProductId = null;
    selectedUploadFile = null;
    form = {
      id: "",
      name: "",
      description: "",
      price: "",
      category_id: categories[0]?.id || "",
      image_path: "",
      is_available: true,
    };
  }

  function handleUploadSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    selectedUploadFile = input.files?.[0] ?? null;
  }

  async function openImageGalleryModal() {
    await onReloadGallery();
    imageGalleryDialog?.showModal();
  }

  function closeImageGalleryModal() {
    imageGalleryDialog?.close();
  }

  async function uploadSelectedImage() {
    if (!selectedUploadFile) return;
    galleryActionBusy = true;
    try {
      const uploadedPath = await onUploadGalleryImage(selectedUploadFile);
      if (uploadedPath) {
        form.image_path = uploadedPath;
      }
      selectedUploadFile = null;
      if (uploadInput) {
        uploadInput.value = "";
      }
    } finally {
      galleryActionBusy = false;
    }
  }

  function selectGalleryImage(path: string) {
    form.image_path = path;
    closeImageGalleryModal();
  }

  function clearSelectedImage() {
    form.image_path = "";
  }

  async function removeGalleryImage(path: string) {
    if (!window.confirm("Eliminar esta imagen del bucket?")) return;
    galleryActionBusy = true;
    try {
      const deleted = await onDeleteGalleryImage(path);
      if (deleted && form.image_path === path) {
        form.image_path = "";
      }
    } finally {
      galleryActionBusy = false;
    }
  }

  function openCreateProductModal() {
    resetForm();
    productEditorDialog?.showModal();
  }

  function closeProductEditor() {
    productEditorDialog?.close();
    resetForm();
  }

  function editProduct(product: Product) {
    editingProductId = product.id;
    form = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: String(product.price),
      category_id: product.category_id || categories[0]?.id || "",
      image_path: product.image_path || "",
      is_available: product.is_available,
    };
    productEditorDialog?.showModal();
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      category_id: form.category_id,
      image_path: form.image_path.trim() || undefined,
      is_available: form.is_available,
    };

    if (form.id) {
      onUpdate(form.id, payload);
    } else {
      onCreate(payload);
    }

    closeProductEditor();
  }

  function openConfirm(title: string, message: string, action: () => void) {
    confirmTitle = title;
    confirmMessage = message;
    confirmAction = action;
    confirmDialog?.showModal();
  }

  function confirmNow() {
    const action = confirmAction;
    confirmAction = null;
    confirmDialog?.close();
    if (action) action();
  }

  function closeConfirm() {
    confirmAction = null;
    confirmDialog?.close();
  }

  function requestDeleteProduct(product: Product) {
    openConfirm(
      "Eliminar producto",
      `Seguro que deseas eliminar ${product.name}?`,
      () => onDelete(product.id),
    );
  }

  function openFlavorAssignmentDialog(product: Product) {
    currentProductForFlavorAddonId = product.id;
    selectedAvailableFlavorIds = [];
    selectedAssignedFlavorIds = [];
    flavorAssignmentDialog?.showModal();
  }

  function closeFlavorAssignmentDialog() {
    flavorAssignmentDialog?.close();
    selectedAvailableFlavorIds = [];
    selectedAssignedFlavorIds = [];
    if (!addonAssignmentDialog?.open) {
      currentProductForFlavorAddonId = null;
    }
  }

  function openAddonAssignmentDialog(product: Product) {
    currentProductForFlavorAddonId = product.id;
    selectedAvailableAddonIds = [];
    selectedAssignedAddonIds = [];
    addonAssignmentDialog?.showModal();
  }

  function closeAddonAssignmentDialog() {
    addonAssignmentDialog?.close();
    selectedAvailableAddonIds = [];
    selectedAssignedAddonIds = [];
    if (!flavorAssignmentDialog?.open) {
      currentProductForFlavorAddonId = null;
    }
  }

  async function addFlavorToProduct(flavorId: string) {
    if (!currentProductForFlavorAddon) return;
    flavorAddonBusy = true;
    try {
      await onLinkFlavor(currentProductForFlavorAddon.id, flavorId);
    } finally {
      flavorAddonBusy = false;
    }
  }

  async function removeFlavorFromProduct(flavorId: string) {
    if (!currentProductForFlavorAddon) return;
    flavorAddonBusy = true;
    try {
      await onUnlinkFlavor(currentProductForFlavorAddon.id, flavorId);
    } finally {
      flavorAddonBusy = false;
    }
  }

  async function addAddonToProduct(addonId: string) {
    if (!currentProductForFlavorAddon) return;
    flavorAddonBusy = true;
    try {
      await onLinkAddon(currentProductForFlavorAddon.id, addonId);
    } finally {
      flavorAddonBusy = false;
    }
  }

  async function removeAddonFromProduct(addonId: string) {
    if (!currentProductForFlavorAddon) return;
    flavorAddonBusy = true;
    try {
      await onUnlinkAddon(currentProductForFlavorAddon.id, addonId);
    } finally {
      flavorAddonBusy = false;
    }
  }

  function allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  function toggleSelection(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
  }

  async function moveSelectedFlavorsToAssigned() {
    if (!currentProductForFlavorAddon || selectedAvailableFlavorIds.length === 0) return;
    flavorAddonBusy = true;
    try {
      await Promise.all(selectedAvailableFlavorIds.map((flavorId) => onLinkFlavor(currentProductForFlavorAddon.id, flavorId)));
      selectedAvailableFlavorIds = [];
    } finally {
      flavorAddonBusy = false;
    }
  }

  async function moveSelectedFlavorsToAvailable() {
    if (!currentProductForFlavorAddon || selectedAssignedFlavorIds.length === 0) return;
    flavorAddonBusy = true;
    try {
      await Promise.all(selectedAssignedFlavorIds.map((flavorId) => onUnlinkFlavor(currentProductForFlavorAddon.id, flavorId)));
      selectedAssignedFlavorIds = [];
    } finally {
      flavorAddonBusy = false;
    }
  }

  async function moveSelectedAddonsToAssigned() {
    if (!currentProductForFlavorAddon || selectedAvailableAddonIds.length === 0) return;
    flavorAddonBusy = true;
    try {
      await Promise.all(selectedAvailableAddonIds.map((addonId) => onLinkAddon(currentProductForFlavorAddon.id, addonId)));
      selectedAvailableAddonIds = [];
    } finally {
      flavorAddonBusy = false;
    }
  }

  async function moveSelectedAddonsToAvailable() {
    if (!currentProductForFlavorAddon || selectedAssignedAddonIds.length === 0) return;
    flavorAddonBusy = true;
    try {
      await Promise.all(selectedAssignedAddonIds.map((addonId) => onUnlinkAddon(currentProductForFlavorAddon.id, addonId)));
      selectedAssignedAddonIds = [];
    } finally {
      flavorAddonBusy = false;
    }
  }

  function handleFlavorDragStart(flavorId: string, fromAssigned: boolean) {
    draggingFlavorId = flavorId;
    draggingFlavorFromAssigned = fromAssigned;
  }

  async function dropFlavorToAssigned() {
    if (!draggingFlavorId || draggingFlavorFromAssigned) return;
    await addFlavorToProduct(draggingFlavorId);
    draggingFlavorId = null;
  }

  async function dropFlavorToAvailable() {
    if (!draggingFlavorId || !draggingFlavorFromAssigned) return;
    await removeFlavorFromProduct(draggingFlavorId);
    draggingFlavorId = null;
  }

  function handleAddonDragStart(addonId: string, fromAssigned: boolean) {
    draggingAddonId = addonId;
    draggingAddonFromAssigned = fromAssigned;
  }

  async function dropAddonToAssigned() {
    if (!draggingAddonId || draggingAddonFromAssigned) return;
    await addAddonToProduct(draggingAddonId);
    draggingAddonId = null;
  }

  async function dropAddonToAvailable() {
    if (!draggingAddonId || !draggingAddonFromAssigned) return;
    await removeAddonFromProduct(draggingAddonId);
    draggingAddonId = null;
  }

  function toggleProductAvailability(product: Product, checked: boolean) {
    const nextAvailability = checked;
    if (nextAvailability === product.is_available) return;

    onUpdate(product.id, {
      name: product.name,
      description: product.description,
      price: product.price,
      category_id: product.category_id || "",
      image_path: product.image_path || undefined,
      is_available: nextAvailability,
    });
  }

  function resetFlavorForm() {
    editingFlavorId = null;
    flavorForm = {
      id: "",
      name: "",
      display_order: 0,
      is_seasonal: false,
      is_active: true,
    };
  }

  function openCreateFlavorModal() {
    resetFlavorForm();
    flavorEditorDialog?.showModal();
  }

  function editFlavor(flavor: Flavor) {
    editingFlavorId = flavor.id;
    flavorForm = {
      id: flavor.id,
      name: flavor.name,
      display_order: flavor.display_order,
      is_seasonal: flavor.is_seasonal,
      is_active: flavor.is_active,
    };
    flavorEditorDialog?.showModal();
  }

  function closeFlavorEditor() {
    flavorEditorDialog?.close();
    resetFlavorForm();
  }

  function submitFlavor(event: SubmitEvent) {
    event.preventDefault();
    const payload = {
      name: flavorForm.name.trim(),
      display_order: Number(flavorForm.display_order),
      is_seasonal: Boolean(flavorForm.is_seasonal),
      is_active: Boolean(flavorForm.is_active),
    };

    if (flavorForm.id) {
      onUpdateFlavor(flavorForm.id, payload);
    } else {
      onCreateFlavor({
        name: payload.name,
        display_order: payload.display_order,
        is_seasonal: payload.is_seasonal,
      });
    }

    closeFlavorEditor();
  }

  function requestDeleteFlavor(flavor: Flavor) {
    openConfirm(
      "Eliminar sabor",
      `Seguro que deseas eliminar ${flavor.name}?`,
      () => onDeleteFlavor(flavor.id),
    );
  }

  function resetAddonForm() {
    editingAddonId = null;
    addonForm = {
      id: "",
      name: "",
      price: 0,
      group_name: DEFAULT_ADDON_GROUP_NAME,
      display_order: 0,
      is_active: true,
    };
  }

  function openCreateAddonModal() {
    resetAddonForm();
    addonEditorDialog?.showModal();
  }

  function editAddon(addon: Addon) {
    editingAddonId = addon.id;
    addonForm = {
      id: addon.id,
      name: addon.name,
      price: addon.price,
      group_name: normalizeAddonGroupName(addon.group_name),
      display_order: addon.display_order,
      is_active: addon.is_active,
    };
    addonEditorDialog?.showModal();
  }

  function closeAddonEditor() {
    addonEditorDialog?.close();
    resetAddonForm();
  }

  function submitAddon(event: SubmitEvent) {
    event.preventDefault();
    const payload = {
      name: addonForm.name.trim(),
      price: Number(addonForm.price),
      group_name: normalizeAddonGroupName(addonForm.group_name),
      display_order: Number(addonForm.display_order),
      is_active: Boolean(addonForm.is_active),
    };

    if (addonForm.id) {
      onUpdateAddon(addonForm.id, payload);
    } else {
      onCreateAddon({
        name: payload.name,
        price: payload.price,
        group_name: payload.group_name,
        display_order: payload.display_order,
      });
    }

    closeAddonEditor();
  }

  function requestDeleteAddon(addon: Addon) {
    openConfirm(
      "Eliminar complemento",
      `Seguro que deseas eliminar ${addon.name}?`,
      () => onDeleteAddon(addon.id),
    );
  }
</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="card-title">Gestion de productos</h2>
          <p class="text-sm text-base-content/70">Administra productos, precios y disponibilidad de forma ordenada.</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <button class="btn btn-primary" type="button" onclick={openCreateProductModal} disabled={busy}>
            Crear producto
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h4 class="card-title text-base">Listado de productos</h4>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="label-text text-sm whitespace-nowrap">Mostrar</span>
            <div class="dropdown dropdown-right dropdown-center">
              <div tabindex="0" role="button" class="btn btn-sm btn-outline min-w-32 justify-between">
                {productVisibilityFilterLabel}
              </div>
              <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-sm border border-base-300">
                <li><button type="button" onclick={() => (productVisibilityFilter = "all")}>Todos</button></li>
                <li><button type="button" onclick={() => (productVisibilityFilter = "active")}>Activos</button></li>
                <li><button type="button" onclick={() => (productVisibilityFilter = "inactive")}>Inactivos</button></li>
              </ul>
            </div>
          </div>
          <div class="text-sm text-base-content/70 whitespace-nowrap">{filteredProducts.length} de {products.length} producto(s)</div>
        </div>
      </div>

      <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4">
        <table class="table">
           <thead class="bg-base-200/60 text-base-content">
             <tr>
               <th class="font-bold">Nombre</th>
               <th class="text-center font-bold">Categoria</th>
               <th class="text-center font-bold">Precio</th>
               <th class="text-center font-bold">Disponibilidad</th>
               <th class="text-center font-bold">Acciones</th>
             </tr>
           </thead>
           <tbody>
             {#if filteredProducts.length === 0}
               <tr><td colspan="5" class="text-center">No hay productos</td></tr>
             {:else}
               {#each filteredProducts as product}
                 <tr class="hover:bg-base-300/40 transition-colors">
                   <td>
                     <div class="font-medium">{product.name}</div>
                   </td>
                   <td class="text-center align-middle">{product.category_name || "-"}</td>
                   <td class="text-center align-middle">{formatCurrency(product.price)}</td>
                   <td class="text-center align-middle">
                     <label class="label cursor-pointer justify-center gap-2">
                       <input
                         class="toggle toggle-xs"
                         type="checkbox"
                         checked={product.is_available}
                         onchange={(event) => toggleProductAvailability(product, (event.currentTarget as HTMLInputElement).checked)}
                         disabled={busy}
                       />
                       <span class="label-text text-xs">{product.is_available ? "SI" : "NO"}</span>
                     </label>
                   </td>
                   <td class="text-center align-middle">
                     <div class="flex w-full flex-wrap items-center justify-center gap-2">
                       <button class="btn btn-sm btn-soft btn-accent" onclick={() => editProduct(product)}>Editar</button>
                       <button class="btn btn-sm btn-soft btn-info" onclick={() => openFlavorAssignmentDialog(product)}>Sabores</button>
                       <button class="btn btn-sm btn-soft btn-secondary" onclick={() => openAddonAssignmentDialog(product)}>Complementos</button>
                       <button class="btn btn-sm btn-soft btn-error" onclick={() => requestDeleteProduct(product)}>Eliminar</button>
                     </div>
                   </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 class="card-title text-base">Sabores globales</h4>
          <p class="text-sm text-base-content/70">Gestiona sabores disponibles para enlazar a productos.</p>
        </div>
        <button class="btn btn-primary btn-sm" type="button" onclick={openCreateFlavorModal} disabled={flavorBusy}>Crear sabor</button>
      </div>

      {#if flavorError}
        <div class="alert alert-warning mt-3"><span>{flavorError}</span></div>
      {/if}

      <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4">
        <table class="table table-sm">
          <thead class="bg-base-200/60 text-base-content">
            <tr>
              <th class="font-bold">Nombre</th>
              <th class="text-center font-bold">Orden</th>
              <th class="text-center font-bold">Temporada</th>
              <th class="text-center font-bold">Estado</th>
              <th class="text-center font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#if sortedFlavors.length === 0}
              <tr><td colspan="5" class="text-center">No hay sabores</td></tr>
            {:else}
              {#each sortedFlavors as flavor}
                <tr>
                  <td>{flavor.name}</td>
                  <td class="text-center">{flavor.display_order}</td>
                  <td class="text-center">
                    {#if flavor.is_seasonal}
                      <span class="badge badge-warning badge-sm">Temporada</span>
                    {:else}
                      <span class="badge badge-ghost badge-sm">Regular</span>
                    {/if}
                  </td>
                  <td class="text-center">
                    <span class={`badge badge-sm ${flavor.is_active ? "badge-success" : "badge-ghost"}`}>{flavor.is_active ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td class="text-center">
                    <div class="flex justify-center gap-2">
                      <button class="btn btn-xs btn-soft btn-accent" type="button" onclick={() => editFlavor(flavor)}>Editar</button>
                      <button class="btn btn-xs btn-soft btn-error" type="button" onclick={() => requestDeleteFlavor(flavor)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 class="card-title text-base">Complementos globales</h4>
          <p class="text-sm text-base-content/70">Gestiona toppings, jalea y extras disponibles para productos.</p>
        </div>
        <button class="btn btn-primary btn-sm" type="button" onclick={openCreateAddonModal} disabled={addonBusy}>Crear complemento</button>
      </div>

      {#if addonError}
        <div class="alert alert-warning mt-3"><span>{addonError}</span></div>
      {/if}

      <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4">
        <table class="table table-sm">
          <thead class="bg-base-200/60 text-base-content">
            <tr>
              <th class="font-bold">Nombre</th>
              <th class="text-center font-bold">Grupo</th>
              <th class="text-center font-bold">Precio</th>
              <th class="text-center font-bold">Estado</th>
              <th class="text-center font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#if sortedAddons.length === 0}
              <tr><td colspan="5" class="text-center">No hay complementos</td></tr>
            {:else}
              {#each sortedAddons as addon}
                <tr>
                  <td>{addon.name}</td>
                  <td class="text-center">{addonGroupLabel(addon.group_name)}</td>
                  <td class="text-center">{formatCurrency(addon.price)}</td>
                  <td class="text-center">
                    <span class={`badge badge-sm ${addon.is_active ? "badge-success" : "badge-ghost"}`}>{addon.is_active ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td class="text-center">
                    <div class="flex justify-center gap-2">
                      <button class="btn btn-xs btn-soft btn-accent" type="button" onclick={() => editAddon(addon)}>Editar</button>
                      <button class="btn btn-xs btn-soft btn-error" type="button" onclick={() => requestDeleteAddon(addon)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>

<dialog class="modal" bind:this={productEditorDialog} onclose={resetForm}>
  <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">{isEditing ? "Editar producto" : "Crear producto"}</h3>
    </div>

    <form class="mt-5 grid items-start gap-6 md:grid-cols-[1.15fr_0.85fr]" onsubmit={submit}>
      <div class="grid gap-5">
        <div class="grid items-start gap-5 md:grid-cols-2">
          <div class="form-control w-full md:col-span-2">
            <span id="product-name-label" class="label-text mb-1">Nombre</span>
            <input id="product-name" class="input input-bordered w-full" placeholder="Helado de vainilla" bind:value={form.name} required aria-labelledby="product-name-label" />
          </div>

          <div class="form-control w-full">
            <span id="product-price-label" class="label-text mb-1">Precio</span>
            <input id="product-price" class="input input-bordered w-full" placeholder="0.00" type="number" min="0" step="0.01" bind:value={form.price} required aria-labelledby="product-price-label" />
          </div>

          <div class="form-control w-full">
            <span id="product-category-label" class="label-text mb-1">Categoria</span>
            <select id="product-category" class="select select-bordered w-full" bind:value={form.category_id} required aria-labelledby="product-category-label">
              {#if categories.length === 0}
                <option value="" disabled>Sin categorias</option>
              {:else}
                {#each categories as category}
                  <option value={category.id}>{category.name}</option>
                {/each}
              {/if}
            </select>
          </div>

          <div class="form-control w-full">
            <span class="label-text mb-1">Disponibilidad</span>
            <label class="label h-12 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3">
              <input id="product-is-available" class="toggle" type="checkbox" bind:checked={form.is_available} aria-labelledby="product-is-available-label" />
              <span id="product-is-available-label" class="label-text">Disponible</span>
            </label>
          </div>

          <div class="form-control w-full md:col-span-2">
            <span class="label-text mb-1">Imagen del producto</span>
            <div class="rounded-lg border border-base-300/70 p-3 space-y-3">
              {#if selectedGalleryImage}
                <div class="flex items-center gap-3 rounded-lg border border-base-300/70 p-2">
                  <img
                    src={selectedGalleryImage.url}
                    alt={selectedGalleryImage.name}
                    class="h-12 w-12 rounded object-cover border border-base-300/70"
                    loading="lazy"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium">{selectedGalleryImage.name}</div>
                  </div>
                </div>
              {:else}
                <p class="text-sm text-base-content/70">No hay imagen seleccionada.</p>
              {/if}

              <div class="flex flex-wrap gap-2">
                <button
                  class="btn btn-outline btn-sm"
                  type="button"
                  onclick={openImageGalleryModal}
                  disabled={busy || galleryBusy || galleryActionBusy}
                >
                  Seleccionar imagen
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  onclick={clearSelectedImage}
                  disabled={busy || galleryBusy || galleryActionBusy || !form.image_path}
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-primary" type="submit" disabled={busy}>
            {isEditing ? "Actualizar" : "Crear"}
          </button>
          <button class="btn btn-ghost" type="button" onclick={closeProductEditor}>Cancelar</button>
        </div>
      </div>

      <div class="form-control w-full self-start pt-0">
        <span id="product-description-label" class="label-text mb-1">Descripcion</span>
        <textarea
          id="product-description"
          class="textarea textarea-bordered w-full h-50 resize-none"
          placeholder="Descripcion del producto"
          bind:value={form.description}
          required
          aria-labelledby="product-description-label"
        ></textarea>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeProductEditor}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={imageGalleryDialog}>
  <div class="modal-box w-11/12 max-w-4xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">Seleccionar imagen del producto</h3>
      <button class="btn btn-sm btn-ghost" type="button" onclick={closeImageGalleryModal}>Cerrar</button>
    </div>

    <div class="mt-4 rounded-lg border border-base-300/70 p-3 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium">Galeria de imagenes (menu)</span>
        <button
          class="btn btn-xs btn-outline"
          type="button"
          onclick={onReloadGallery}
          disabled={busy || galleryBusy || galleryActionBusy}
        >
          Recargar
        </button>
      </div>

      <div class="flex gap-2">
        <input
          class="file-input file-input-bordered file-input-sm w-full"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          bind:this={uploadInput}
          onchange={handleUploadSelection}
          disabled={busy || galleryBusy || galleryActionBusy}
        />
        <button
          class="btn btn-sm btn-primary"
          type="button"
          onclick={uploadSelectedImage}
          disabled={busy || galleryBusy || galleryActionBusy || !selectedUploadFile}
        >
          Subir
        </button>
      </div>
    </div>

    <div class="mt-4">
      {#if galleryImages.length === 0}
        <div class="text-sm text-base-content/70">No hay imagenes en el bucket.</div>
      {:else}
        <ul class="list rounded-box border border-base-300/70 max-h-[50vh] overflow-y-auto">
          {#each galleryImages as image}
            <li class="list-row items-center gap-3">
              <img src={image.url} alt={image.name} class="size-14 rounded-box object-cover" loading="lazy" />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">{image.name}</div>
              </div>
              <button
                class={`btn btn-xs ${form.image_path === image.name ? "btn-success" : "btn-outline btn-accent"}`}
                type="button"
                onclick={() => selectGalleryImage(image.name)}
                disabled={busy || galleryBusy || galleryActionBusy}
              >
                {form.image_path === image.name ? "Seleccionada" : "Usar"}
              </button>
              <button
                class="btn btn-xs btn-error"
                type="button"
                onclick={() => removeGalleryImage(image.name)}
                disabled={busy || galleryBusy || galleryActionBusy}
              >
                Eliminar
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeImageGalleryModal}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={flavorAssignmentDialog} onclose={closeFlavorAssignmentDialog}>
  <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">Sabores: {currentProductForFlavorAddon?.name || ""}</h3>
    </div>

    <div class="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr] items-start">
      <section class="card bg-base-200/60">
        <div class="card-body p-4">
          <h4 class="font-semibold text-sm uppercase tracking-wide text-base-content/70">No asignados</h4>
          {#if availableActiveFlavors.length === 0}
            <p class="text-sm text-base-content/70">No hay sabores disponibles</p>
          {:else}
            <ul class="menu bg-base-100 rounded-box p-2 space-y-1 max-h-[50vh] overflow-y-auto" ondragover={allowDrop} ondrop={dropFlavorToAvailable}>
              {#each availableActiveFlavors as flavor}
                <li
                  class="flex items-center gap-2"
                  draggable={!flavorAddonBusy}
                  ondragstart={() => handleFlavorDragStart(flavor.id, false)}
                  ondragend={() => {
                    draggingFlavorId = null;
                  }}
                >
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={selectedAvailableFlavorIds.includes(flavor.id)}
                    onchange={() => {
                      selectedAvailableFlavorIds = toggleSelection(selectedAvailableFlavorIds, flavor.id);
                    }}
                    disabled={flavorAddonBusy}
                  />
                  <span class="cursor-move text-base-content/50">⋮⋮</span>
                  <div class="flex-1 truncate">{flavor.name}</div>
                  {#if flavor.is_seasonal}
                    <span class="badge badge-warning badge-sm">Temporada</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>

      <section class="flex flex-col items-center justify-center gap-2 pt-10">
        <button class="btn btn-sm btn-primary" type="button" onclick={moveSelectedFlavorsToAssigned} disabled={flavorAddonBusy || selectedAvailableFlavorIds.length === 0}>
          &gt;&gt;
        </button>
        <div class="divider md:divider-horizontal m-0"></div>
        <button class="btn btn-sm btn-outline" type="button" onclick={moveSelectedFlavorsToAvailable} disabled={flavorAddonBusy || selectedAssignedFlavorIds.length === 0}>
          &lt;&lt;
        </button>
      </section>

      <section class="card bg-base-200/60">
        <div class="card-body p-4">
          <h4 class="font-semibold text-sm uppercase tracking-wide text-base-content/70">Asignados</h4>
          {#if currentProductFlavors.length === 0}
            <p class="text-sm text-base-content/70">No hay sabores asignados</p>
          {:else}
            <ul class="menu bg-base-100 rounded-box p-2 space-y-1 max-h-[50vh] overflow-y-auto" ondragover={allowDrop} ondrop={dropFlavorToAssigned}>
              {#each currentProductFlavors as flavor}
                <li
                  class="flex items-center gap-2"
                  draggable={!flavorAddonBusy}
                  ondragstart={() => handleFlavorDragStart(flavor.id, true)}
                  ondragend={() => {
                    draggingFlavorId = null;
                  }}
                >
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={selectedAssignedFlavorIds.includes(flavor.id)}
                    onchange={() => {
                      selectedAssignedFlavorIds = toggleSelection(selectedAssignedFlavorIds, flavor.id);
                    }}
                    disabled={flavorAddonBusy}
                  />
                  <span class="cursor-move text-base-content/50">⋮⋮</span>
                  <div class="flex-1 truncate">{flavor.name}</div>
                  {#if flavor.is_seasonal}
                    <span class="badge badge-warning badge-sm">Temporada</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>
    </div>

    <div class="modal-action mt-5">
      <button type="button" class="btn btn-ghost" onclick={closeFlavorAssignmentDialog}>Cerrar</button>
    </div>
  </div>
</dialog>

<dialog class="modal" bind:this={addonAssignmentDialog} onclose={closeAddonAssignmentDialog}>
  <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">Complementos: {currentProductForFlavorAddon?.name || ""}</h3>
    </div>

    <div class="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr] items-start">
      <section class="card bg-base-200/60">
        <div class="card-body p-4">
          <h4 class="font-semibold text-sm uppercase tracking-wide text-base-content/70">No asignados</h4>
          {#if availableActiveAddons.length === 0}
            <p class="text-sm text-base-content/70">No hay complementos disponibles</p>
          {:else}
            <ul class="menu bg-base-100 rounded-box p-2 space-y-1 max-h-[50vh] overflow-y-auto" ondragover={allowDrop} ondrop={dropAddonToAvailable}>
              {#each availableActiveAddons as addon}
                <li
                  class="flex items-center gap-2"
                  draggable={!flavorAddonBusy}
                  ondragstart={() => handleAddonDragStart(addon.id, false)}
                  ondragend={() => {
                    draggingAddonId = null;
                  }}
                >
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={selectedAvailableAddonIds.includes(addon.id)}
                    onchange={() => {
                      selectedAvailableAddonIds = toggleSelection(selectedAvailableAddonIds, addon.id);
                    }}
                    disabled={flavorAddonBusy}
                  />
                  <span class="cursor-move text-base-content/50">⋮⋮</span>
                  <div class="flex-1 truncate">
                    {addon.name}
                    <span class="text-xs text-base-content/70 ml-2">S/. {addon.price.toFixed(2)}</span>
                  </div>
                  <span class="badge badge-outline badge-sm">{addonGroupLabel(addon.group_name)}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>

      <section class="flex flex-col items-center justify-center gap-2 pt-10">
        <button class="btn btn-sm btn-primary" type="button" onclick={moveSelectedAddonsToAssigned} disabled={flavorAddonBusy || selectedAvailableAddonIds.length === 0}>
          &gt;&gt;
        </button>
        <div class="divider md:divider-horizontal m-0"></div>
        <button class="btn btn-sm btn-outline" type="button" onclick={moveSelectedAddonsToAvailable} disabled={flavorAddonBusy || selectedAssignedAddonIds.length === 0}>
          &lt;&lt;
        </button>
      </section>

      <section class="card bg-base-200/60">
        <div class="card-body p-4">
          <h4 class="font-semibold text-sm uppercase tracking-wide text-base-content/70">Asignados</h4>
          {#if currentProductAddons.length === 0}
            <p class="text-sm text-base-content/70">No hay complementos asignados</p>
          {:else}
            <ul class="menu bg-base-100 rounded-box p-2 space-y-1 max-h-[50vh] overflow-y-auto" ondragover={allowDrop} ondrop={dropAddonToAssigned}>
              {#each currentProductAddons as addon}
                <li
                  class="flex items-center gap-2"
                  draggable={!flavorAddonBusy}
                  ondragstart={() => handleAddonDragStart(addon.id, true)}
                  ondragend={() => {
                    draggingAddonId = null;
                  }}
                >
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={selectedAssignedAddonIds.includes(addon.id)}
                    onchange={() => {
                      selectedAssignedAddonIds = toggleSelection(selectedAssignedAddonIds, addon.id);
                    }}
                    disabled={flavorAddonBusy}
                  />
                  <span class="cursor-move text-base-content/50">⋮⋮</span>
                  <div class="flex-1 truncate">
                    {addon.name}
                    <span class="text-xs text-base-content/70 ml-2">S/. {addon.price.toFixed(2)}</span>
                  </div>
                  <span class="badge badge-outline badge-sm">{addonGroupLabel(addon.group_name)}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>
    </div>

    <div class="modal-action mt-5">
      <button type="button" class="btn btn-ghost" onclick={closeAddonAssignmentDialog}>Cerrar</button>
    </div>
  </div>
</dialog>

<dialog class="modal" bind:this={flavorEditorDialog} onclose={resetFlavorForm}>
  <div class="modal-box w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto">
    <h3 class="font-bold text-lg">{editingFlavorId ? "Editar sabor" : "Crear sabor"}</h3>
    <form class="mt-5 grid items-start gap-6" onsubmit={submitFlavor}>
      <div class="grid gap-5">
        <div class="form-control w-full">
          <span class="label-text mb-1">Nombre</span>
          <input class="input input-bordered w-full" placeholder="Vainilla" bind:value={flavorForm.name} required />
        </div>
        <div class="form-control w-full">
          <span class="label-text mb-1">Orden de visualizacion</span>
          <input type="number" class="input input-bordered w-full" placeholder="0" bind:value={flavorForm.display_order} />
        </div>
        <div class="form-control">
          <label class="label cursor-pointer">
            <span class="label-text">Sabor de temporada</span>
            <input type="checkbox" bind:checked={flavorForm.is_seasonal} class="checkbox" />
          </label>
        </div>
        {#if editingFlavorId}
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">Activo</span>
              <input type="checkbox" bind:checked={flavorForm.is_active} class="checkbox" />
            </label>
          </div>
        {/if}
      </div>
      <div class="modal-action">
        <button type="button" class="btn btn-ghost" onclick={closeFlavorEditor}>Cancelar</button>
        <button type="submit" class="btn btn-primary" disabled={flavorBusy || !flavorForm.name.trim()}>
          {editingFlavorId ? "Actualizar" : "Crear"}
        </button>
      </div>
    </form>
  </div>
</dialog>

<dialog class="modal" bind:this={addonEditorDialog} onclose={resetAddonForm}>
  <div class="modal-box w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto">
    <h3 class="font-bold text-lg">{editingAddonId ? "Editar complemento" : "Crear complemento"}</h3>
    <form class="mt-5 grid items-start gap-6" onsubmit={submitAddon}>
      <div class="grid gap-5">
        <div class="form-control w-full">
          <span class="label-text mb-1">Nombre</span>
          <input class="input input-bordered w-full" placeholder="Granola" bind:value={addonForm.name} required />
        </div>
        <div class="form-control w-full">
          <span class="label-text mb-1">Precio</span>
          <input type="number" class="input input-bordered w-full" min="0" step="0.01" bind:value={addonForm.price} required />
        </div>
        <div class="form-control w-full">
          <span class="label-text mb-1">Grupo</span>
          <select class="select select-bordered w-full" bind:value={addonForm.group_name}>
            <option value="toppings">Toppings</option>
            <option value="jalea">Jalea</option>
            <option value="extras">Extras</option>
          </select>
        </div>
        <div class="form-control w-full">
          <span class="label-text mb-1">Orden de visualizacion</span>
          <input type="number" class="input input-bordered w-full" bind:value={addonForm.display_order} />
        </div>
        {#if editingAddonId}
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">Activo</span>
              <input type="checkbox" bind:checked={addonForm.is_active} class="checkbox" />
            </label>
          </div>
        {/if}
      </div>
      <div class="modal-action">
        <button type="button" class="btn btn-ghost" onclick={closeAddonEditor}>Cancelar</button>
        <button type="submit" class="btn btn-primary" disabled={addonBusy || !addonForm.name.trim()}>
          {editingAddonId ? "Actualizar" : "Crear"}
        </button>
      </div>
    </form>
  </div>
</dialog>

<dialog class="modal" bind:this={confirmDialog}>
  <div class="modal-box">
    <h3 class="font-bold text-lg">{confirmTitle || "Confirmar accion"}</h3>
    <p class="py-2 text-sm text-base-content/70">{confirmMessage}</p>
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closeConfirm}>Cancelar</button>
      <button class="btn btn-primary" type="button" onclick={confirmNow} disabled={busy}>Confirmar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button type="button" onclick={closeConfirm}>close</button></form>
</dialog>
