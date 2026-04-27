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
  let confirmOpen = $state(false);
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);
  let editingProductId = $state<string | null>(null);

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
    exclude_global_flavors: false,
    exclude_global_addons: false,
  });

  const isEditing = $derived(!!editingProductId);
  const selectedGalleryImage = $derived(
    galleryImages.find((image) => image.name === form.image_path) ?? null,
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
      exclude_global_flavors: false,
      exclude_global_addons: false,
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
      exclude_global_flavors: Boolean(product.exclude_global_flavors),
      exclude_global_addons: Boolean(product.exclude_global_addons),
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
      exclude_global_flavors: form.exclude_global_flavors,
      exclude_global_addons: form.exclude_global_addons,
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

<ConfirmDialog
  open={confirmOpen}
  title={confirmTitle}
  message={confirmMessage}
  {busy}
  onConfirm={confirmNow}
  onCancel={closeConfirm}
/>
