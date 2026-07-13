<script lang="ts">
  import { onMount } from "svelte";
  import type {
    AdminImage,
    Category,
    Product,
    StoreOfferItem,
  } from "@features/admin-management";
  import {
    getAdminStoreSettings,
    updateAdminStoreSettings,
  } from "@features/admin-management/lib/bff";
  import ProductList from "./ProductList.svelte";
  import ProductEditorDialog from "./ProductEditorDialog.svelte";
  import ImageGalleryPanel from "./ImageGalleryPanel.svelte";
  import OfferAssignmentPanel from "./OfferAssignmentPanel.svelte";
  import ConfirmDialog from "@shared/components/ConfirmDialog.svelte";
  import {
    closeConfirmDialog,
    confirmDialogNow,
    createConfirmDialogState,
    openConfirmDialog,
  } from "@shared/utils/confirm-dialog";
  import type { ProductsTabProps as Props } from "../../types/products-tab";

  function trackAction(action: string, metadata?: Record<string, unknown>) {
    if (!import.meta.env.DEV) return;
    console.debug("[analytics]", action, metadata ?? {});
  }

  function trackError(
    error: unknown,
    context: string,
    metadata?: Record<string, unknown>,
  ) {
    if (!import.meta.env.DEV) return;
    const normalized =
      error instanceof Error
        ? { message: error.message }
        : { message: String(error) };
    console.error("[analytics]", context, {
      ...normalized,
      ...(metadata ?? {}),
    });
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

  let productEditorOpen = $state(false);
  let imageGalleryOpen = $state(false);
  let confirmDialog = $state(createConfirmDialogState());
  let editingProductId = $state<string | null>(null);

  let offers = $state<StoreOfferItem[]>([]);
  let ordersEnabled = $state(true);
  let offerPanelOpen = $state(false);
  let offerPanelProduct = $state<Product | null>(null);
  let offerBusy = $state(false);
  let offerError = $state("");
  let offerNotice = $state("");

  let pendingToggleProduct = $state<Product | null>(null);
  let pendingToggleValue = $state(false);

  const now = $state(Date.now());
  const activeOfferByProductId = $derived(
    new Map<string, StoreOfferItem>(
      offers
        .filter((offer) => new Date(offer.expires_at).getTime() > Date.now())
        .map((offer) => [offer.product_id, offer]),
    ),
  );
  const existingOfferForPanel = $derived(
    offerPanelProduct
      ? (offers.find((offer) => offer.product_id === offerPanelProduct.id) ??
          null)
      : null,
  );

  onMount(() => {
    void loadStoreSettings();
  });

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
    ball_based: false,
    ball_quantity: 1 as number | "custom",
    custom_ball_quantity: "",
    allows_mixed_flavors: false,
    stock_status: "auto" as string,
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
      ball_based: false,
      ball_quantity: 1,
      custom_ball_quantity: "",
      allows_mixed_flavors: false,
      stock_status: "auto",
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

  function closeProductEditor() {
    productEditorOpen = false;
    resetForm();
  }

  function editProduct(product: Product) {
    editingProductId = product.id;
    const isCustom = product.ball_quantity && product.ball_quantity > 3;
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
      ball_based: Boolean(product.ball_based),
      ball_quantity: isCustom ? "custom" : product.ball_quantity || 1,
      custom_ball_quantity: isCustom ? String(product.ball_quantity) : "",
      allows_mixed_flavors: Boolean(product.allows_mixed_flavors),
      stock_status: product.stock_status || "auto",
    };
    productEditorOpen = true;
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const ballQty =
      form.ball_quantity === "custom"
        ? Number(form.custom_ball_quantity)
        : form.ball_quantity;

    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      category_id: form.category_id,
      image_path: form.image_path.trim() || undefined,
      is_available: form.is_available,
      exclude_global_flavors: form.exclude_global_flavors,
      exclude_global_addons: form.exclude_global_addons,
      ball_based: form.ball_based,
      ball_quantity: ballQty,
      allows_mixed_flavors: form.allows_mixed_flavors,
    };

    if (form.stock_status && form.stock_status !== "auto") {
      payload.stock_status = form.stock_status;
    }

    if (form.id) {
      trackAction("products_tab_submit_update", { productId: form.id });
      onUpdate(form.id, payload);
    } else {
      trackAction("products_tab_submit_create", { name: payload.name });
      onCreate(payload);
    }

    closeProductEditor();
  }

  function requestDeleteProduct(product: Product) {
    openConfirmDialog(
      confirmDialog,
      "Eliminar producto",
      `Seguro que deseas eliminar ${product.name}?`,
      () => onDelete(product.id),
    );
  }

  function requestToggleProductAvailability(
    product: Product,
    checked: boolean,
  ) {
    if (checked === product.is_available) return;
    pendingToggleProduct = product;
    pendingToggleValue = checked;
    openConfirmDialog(
      confirmDialog,
      checked ? "Activar producto" : "Desactivar producto",
      checked
        ? `¿Seguro que deseas activar ${product.name}?`
        : `¿Seguro que deseas desactivar ${product.name}?`,
      confirmToggleProductAvailability,
    );
  }

  function confirmToggleProductAvailability() {
    if (!pendingToggleProduct) return;
    const product = pendingToggleProduct;
    const nextAvailability = pendingToggleValue;
    pendingToggleProduct = null;
    pendingToggleValue = false;

    onUpdate(product.id, {
      name: product.name,
      description: product.description,
      price: product.price,
      category_id: product.category_id || "",
      image_path: product.image_path || undefined,
      is_available: nextAvailability,
      ball_based: product.ball_based,
      ball_quantity: product.ball_quantity,
      allows_mixed_flavors: product.allows_mixed_flavors,
      stock_status: product.stock_status || undefined,
    });
  }

  function clearPendingToggle() {
    pendingToggleProduct = null;
    pendingToggleValue = false;
  }

  function setOfferNotice(message: string) {
    offerNotice = message;
    setTimeout(() => {
      if (offerNotice === message) offerNotice = "";
    }, 2500);
  }

  async function loadStoreSettings() {
    offerBusy = true;
    offerError = "";
    try {
      const settings = await getAdminStoreSettings();
      ordersEnabled = settings.orders_enabled;
      offers = settings.offers ?? [];
    } catch (requestError) {
      offerError =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar la configuracion de ofertas";
    } finally {
      offerBusy = false;
    }
  }

  function openOfferPanel(product: Product) {
    offerPanelProduct = product;
    offerPanelOpen = true;
    offerError = "";
  }

  function closeOfferPanel() {
    offerPanelOpen = false;
    offerPanelProduct = null;
    offerError = "";
  }

  async function saveOffers(nextOffers: StoreOfferItem[]) {
    offerBusy = true;
    offerError = "";
    try {
      await updateAdminStoreSettings({
        orders_enabled: ordersEnabled,
        offers: nextOffers,
      });
      await loadStoreSettings();
      setOfferNotice("Oferta guardada");
      closeOfferPanel();
    } catch (requestError) {
      offerError =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar la oferta";
    } finally {
      offerBusy = false;
    }
  }

  async function handleSaveOffer(nextOffer: StoreOfferItem) {
    const nextOffers = offers.filter(
      (offer) => offer.product_id !== nextOffer.product_id,
    );
    nextOffers.push(nextOffer);
    await saveOffers(nextOffers);
  }

  async function handleRemoveOffer() {
    if (!offerPanelProduct) return;
    const nextOffers = offers.filter(
      (offer) => offer.product_id !== offerPanelProduct!.id,
    );
    await saveOffers(nextOffers);
  }
</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  {#if offerNotice}
    <div class="alert alert-success shadow-sm"><span>{offerNotice}</span></div>
  {/if}

  <ProductList
    {products}
    {categories}
    {busy}
    offerByProductId={activeOfferByProductId}
    onCreateProduct={openCreateProductModal}
    onToggleAvailability={requestToggleProductAvailability}
    onEdit={editProduct}
    onRequestDelete={requestDeleteProduct}
    onOpenOfferPanel={openOfferPanel}
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

<OfferAssignmentPanel
  open={offerPanelOpen}
  product={offerPanelProduct}
  existingOffer={existingOfferForPanel}
  busy={offerBusy}
  error={offerError}
  onClose={closeOfferPanel}
  onSave={handleSaveOffer}
  onRemove={handleRemoveOffer}
/>

<ConfirmDialog
  open={confirmDialog.open}
  title={confirmDialog.title}
  message={confirmDialog.message}
  {busy}
  variant="error"
  onConfirm={() => confirmDialogNow(confirmDialog)}
  onCancel={() => {
    clearPendingToggle();
    closeConfirmDialog(confirmDialog);
  }}
/>
