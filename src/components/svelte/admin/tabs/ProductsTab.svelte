<script lang="ts">
  import type {
    AdminImage,
    Category,
    Product,
  } from "../../../../lib/api/admin";
  import ProductList from "../products/ProductList.svelte";
  import ProductEditorDialog from "../products/ProductEditorDialog.svelte";
  import ImageGalleryPanel from "../products/ImageGalleryPanel.svelte";
  import GlobalFlavorsManager from "../products/GlobalFlavorsManager.svelte";
  import GlobalAddonsManager from "../products/GlobalAddonsManager.svelte";
  import FlavorAssignmentPanel from "../products/FlavorAssignmentPanel.svelte";
  import AddonAssignmentPanel from "../products/AddonAssignmentPanel.svelte";
  import ConfirmDialog from "../shared/ConfirmDialog.svelte";
  import { trackAction, trackError } from "../../../../lib/admin/analytics";
  import type { ProductsTabProps as Props } from "./types/products-tab";

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

  let productEditorOpen = $state(false);
  let imageGalleryOpen = $state(false);
  let globalFlavorsOpen = $state(false);
  let globalAddonsOpen = $state(false);
  let flavorAssignmentOpen = $state(false);
  let addonAssignmentOpen = $state(false);
  let confirmOpen = $state(false);
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);
  let flavorAddonBusy = $state(false);
  let editingProductId = $state<string | null>(null);
  let currentProductForFlavorAddonId = $state<string | null>(null);

  let productVisibilityFilter = $state<"all" | "active" | "inactive">("all");
  const filteredProducts = $derived(
    productVisibilityFilter === "all"
      ? products
      : products.filter((product) =>
          productVisibilityFilter === "active"
            ? product.is_available
            : !product.is_available,
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
  const selectedGalleryImage = $derived(
    galleryImages.find((image) => image.name === form.image_path) ?? null,
  );
  const currentProductForFlavorAddon = $derived(
    currentProductForFlavorAddonId
      ? (products.find(
          (product) => product.id === currentProductForFlavorAddonId,
        ) ?? null)
      : null,
  );
  const currentProductFlavorIds = $derived(
    (currentProductForFlavorAddon?.flavors ?? []).map((flavor) => flavor.id),
  );
  const currentProductAddonIds = $derived(
    (currentProductForFlavorAddon?.addons ?? []).map((addon) => addon.id),
  );

  $effect(() => {
    if (!form.category_id && categories.length > 0) {
      form.category_id = categories[0].id;
    }
  });

  function resetForm() {
    editingProductId = null;
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

  function openImageGalleryModal() {
    imageGalleryOpen = true;
  }

  function closeImageGalleryModal() {
    imageGalleryOpen = false;
  }

  function clearSelectedImage() {
    form.image_path = "";
  }

  function openCreateProductModal() {
    resetForm();
    productEditorOpen = true;
  }

  function openGlobalFlavorsModal() {
    globalFlavorsOpen = true;
  }

  function closeGlobalFlavorsModal() {
    globalFlavorsOpen = false;
  }

  function openGlobalAddonsModal() {
    globalAddonsOpen = true;
  }

  function closeGlobalAddonsModal() {
    globalAddonsOpen = false;
  }

  function closeProductEditor() {
    productEditorOpen = false;
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
    productEditorOpen = true;
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
      trackAction("products_tab_submit_update", { productId: form.id });
      onUpdate(form.id, payload);
    } else {
      trackAction("products_tab_submit_create", { name: payload.name });
      onCreate(payload);
    }

    closeProductEditor();
  }

  function openConfirm(title: string, message: string, action: () => void) {
    confirmTitle = title;
    confirmMessage = message;
    confirmAction = action;
    confirmOpen = true;
  }

  function confirmNow() {
    const action = confirmAction;
    confirmAction = null;
    confirmOpen = false;
    if (action) action();
  }

  function closeConfirm() {
    confirmAction = null;
    confirmOpen = false;
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
    flavorAssignmentOpen = true;
  }

  function openFlavorAssignmentForEditingProduct() {
    if (!editingProductId) return;
    const product = products.find((item) => item.id === editingProductId);
    if (!product) return;
    openFlavorAssignmentDialog(product);
  }

  function closeFlavorAssignmentDialog() {
    flavorAssignmentOpen = false;
    if (!addonAssignmentOpen) {
      currentProductForFlavorAddonId = null;
    }
  }

  function openAddonAssignmentDialog(product: Product) {
    currentProductForFlavorAddonId = product.id;
    addonAssignmentOpen = true;
  }

  function openAddonAssignmentForEditingProduct() {
    if (!editingProductId) return;
    const product = products.find((item) => item.id === editingProductId);
    if (!product) return;
    openAddonAssignmentDialog(product);
  }

  function closeAddonAssignmentDialog() {
    addonAssignmentOpen = false;
    if (!flavorAssignmentOpen) {
      currentProductForFlavorAddonId = null;
    }
  }

  async function assignFlavorsToCurrentProduct(flavorIds: string[]) {
    if (!currentProductForFlavorAddon || flavorIds.length === 0) return;
    flavorAddonBusy = true;
    try {
      trackAction("products_tab_flavors_assign", {
        productId: currentProductForFlavorAddon.id,
        count: flavorIds.length,
      });
      await Promise.all(
        flavorIds.map((flavorId) =>
          onLinkFlavor(currentProductForFlavorAddon.id, flavorId),
        ),
      );
    } catch (error) {
      trackError(error, "ProductsTab.assignFlavorsToCurrentProduct", {
        productId: currentProductForFlavorAddon.id,
      });
      throw error;
    } finally {
      flavorAddonBusy = false;
    }
  }

  async function unassignFlavorsFromCurrentProduct(flavorIds: string[]) {
    if (!currentProductForFlavorAddon || flavorIds.length === 0) return;
    flavorAddonBusy = true;
    try {
      trackAction("products_tab_flavors_unassign", {
        productId: currentProductForFlavorAddon.id,
        count: flavorIds.length,
      });
      await Promise.all(
        flavorIds.map((flavorId) =>
          onUnlinkFlavor(currentProductForFlavorAddon.id, flavorId),
        ),
      );
    } catch (error) {
      trackError(error, "ProductsTab.unassignFlavorsFromCurrentProduct", {
        productId: currentProductForFlavorAddon.id,
      });
      throw error;
    } finally {
      flavorAddonBusy = false;
    }
  }

  async function assignAddonsToCurrentProduct(addonIds: string[]) {
    if (!currentProductForFlavorAddon || addonIds.length === 0) return;
    flavorAddonBusy = true;
    try {
      trackAction("products_tab_addons_assign", {
        productId: currentProductForFlavorAddon.id,
        count: addonIds.length,
      });
      await Promise.all(
        addonIds.map((addonId) =>
          onLinkAddon(currentProductForFlavorAddon.id, addonId),
        ),
      );
    } catch (error) {
      trackError(error, "ProductsTab.assignAddonsToCurrentProduct", {
        productId: currentProductForFlavorAddon.id,
      });
      throw error;
    } finally {
      flavorAddonBusy = false;
    }
  }

  async function unassignAddonsFromCurrentProduct(addonIds: string[]) {
    if (!currentProductForFlavorAddon || addonIds.length === 0) return;
    flavorAddonBusy = true;
    try {
      trackAction("products_tab_addons_unassign", {
        productId: currentProductForFlavorAddon.id,
        count: addonIds.length,
      });
      await Promise.all(
        addonIds.map((addonId) =>
          onUnlinkAddon(currentProductForFlavorAddon.id, addonId),
        ),
      );
    } catch (error) {
      trackError(error, "ProductsTab.unassignAddonsFromCurrentProduct", {
        productId: currentProductForFlavorAddon.id,
      });
      throw error;
    } finally {
      flavorAddonBusy = false;
    }
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
</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <ProductList
    {products}
    {filteredProducts}
    {busy}
    {productVisibilityFilterLabel}
    onOpenGlobalFlavors={openGlobalFlavorsModal}
    onOpenGlobalAddons={openGlobalAddonsModal}
    onCreateProduct={openCreateProductModal}
    onFilterChange={(value) => {
      productVisibilityFilter = value;
    }}
    onToggleAvailability={toggleProductAvailability}
    onEdit={editProduct}
    onRequestDelete={requestDeleteProduct}
  />
</section>

<ProductEditorDialog
  open={productEditorOpen}
  {isEditing}
  {busy}
  {galleryBusy}
  galleryActionBusy={false}
  {categories}
  {form}
  {selectedGalleryImage}
  onSubmit={submit}
  onClose={closeProductEditor}
  onOpenImageGalleryModal={openImageGalleryModal}
  onClearSelectedImage={clearSelectedImage}
  onOpenFlavorAssignmentForEditingProduct={openFlavorAssignmentForEditingProduct}
  onOpenAddonAssignmentForEditingProduct={openAddonAssignmentForEditingProduct}
/>

<GlobalFlavorsManager
  open={globalFlavorsOpen}
  {flavors}
  busy={flavorBusy}
  error={flavorError}
  onClose={closeGlobalFlavorsModal}
  onCreate={onCreateFlavor}
  onUpdate={onUpdateFlavor}
  onDelete={onDeleteFlavor}
/>

<GlobalAddonsManager
  open={globalAddonsOpen}
  {addons}
  busy={addonBusy}
  error={addonError}
  onClose={closeGlobalAddonsModal}
  onCreate={onCreateAddon}
  onUpdate={onUpdateAddon}
  onDelete={onDeleteAddon}
/>

<ImageGalleryPanel
  open={imageGalleryOpen}
  {galleryImages}
  selectedImagePath={form.image_path}
  {busy}
  {galleryBusy}
  onClose={closeImageGalleryModal}
  onReload={onReloadGallery}
  onUpload={async (file) => {
    await onUploadGalleryImage(file);
  }}
  onSelect={(imageName) => {
    form.image_path = imageName;
    closeImageGalleryModal();
  }}
  onDelete={async (imageName) => {
    await onDeleteGalleryImage(imageName);
  }}
/>

<FlavorAssignmentPanel
  open={flavorAssignmentOpen}
  productName={currentProductForFlavorAddon?.name ?? ""}
  allFlavors={flavors}
  assignedFlavorIds={currentProductFlavorIds}
  busy={busy || flavorAddonBusy}
  onClose={closeFlavorAssignmentDialog}
  onAssignMany={assignFlavorsToCurrentProduct}
  onUnassignMany={unassignFlavorsFromCurrentProduct}
/>

<AddonAssignmentPanel
  open={addonAssignmentOpen}
  productName={currentProductForFlavorAddon?.name ?? ""}
  allAddons={addons}
  assignedAddonIds={currentProductAddonIds}
  busy={busy || flavorAddonBusy}
  onClose={closeAddonAssignmentDialog}
  onAssignMany={assignAddonsToCurrentProduct}
  onUnassignMany={unassignAddonsFromCurrentProduct}
/>

<ConfirmDialog
  open={confirmOpen}
  title={confirmTitle}
  message={confirmMessage}
  {busy}
  onConfirm={confirmNow}
  onCancel={closeConfirm}
/>
