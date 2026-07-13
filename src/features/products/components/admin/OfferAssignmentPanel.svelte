<script lang="ts">
  import type { Product, StoreOfferItem } from "@features/admin-management";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import Icon from "@shared/components/AppIcon.svelte";

  interface Props {
    open: boolean;
    product: Product | null;
    existingOffer: StoreOfferItem | null;
    busy: boolean;
    error: string;
    onClose: () => void;
    onSave: (offer: StoreOfferItem) => void | Promise<void>;
    onRemove: () => void | Promise<void>;
  }

  let {
    open,
    product,
    existingOffer,
    busy,
    error,
    onClose,
    onSave,
    onRemove,
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);

  let label = $state("");
  let discountPrice = $state<number | undefined>(undefined);
  let expiry = $state("");
  let selectedFlavorIds = $state<Set<string>>(new Set());

  let labelError = $state("");
  let expiryError = $state("");
  let discountPriceError = $state("");

  const activeFlavors = $derived(
    (product?.flavors ?? [])
      .filter((f) => f.is_active)
      .sort((a, b) => a.display_order - b.display_order),
  );
  const regularPrice = $derived(product?.price ?? 0);
  const offerPrice = $derived(
    typeof discountPrice === "number" && discountPrice > 0
      ? discountPrice
      : regularPrice,
  );
  const savings = $derived(regularPrice - offerPrice);
  const savingsPercent = $derived(
    regularPrice > 0 ? Math.round((savings / regularPrice) * 100) : 0,
  );

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-SV", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

  $effect(() => {
    if (open) {
      if (existingOffer) {
        label = existingOffer.label;
        discountPrice = existingOffer.discount_price;
        const ids = new Set(
          (existingOffer.flavor_ids ?? []).filter(
            (id): id is string => typeof id === "string" && id.trim() !== "",
          ),
        );
        if (existingOffer.flavor_id) {
          ids.add(existingOffer.flavor_id);
        }
        selectedFlavorIds = ids;
        expiry = toDatetimeLocalValue(existingOffer.expires_at);
      } else {
        label = "";
        discountPrice = undefined;
        selectedFlavorIds = new Set();
        expiry = "";
      }
      clearErrors();
    }
  });

  function clearErrors() {
    labelError = "";
    expiryError = "";
    discountPriceError = "";
  }

  function validate(): boolean {
    clearErrors();
    let valid = true;
    const normalizedLabel = label.trim();

    if (!normalizedLabel) {
      labelError = "La etiqueta es obligatoria.";
      valid = false;
    }

    if (!expiry) {
      expiryError = "La fecha de expiracion es obligatoria.";
      valid = false;
    } else {
      const nextExpiry = new Date(expiry);
      if (Number.isNaN(nextExpiry.getTime())) {
        expiryError = "La fecha de expiracion no es valida.";
        valid = false;
      } else if (nextExpiry.getTime() <= Date.now()) {
        expiryError = "La fecha de expiracion debe ser futura.";
        valid = false;
      }
    }

    if (
      typeof discountPrice === "number" &&
      discountPrice > 0 &&
      regularPrice > 0 &&
      discountPrice >= regularPrice
    ) {
      discountPriceError =
        "El precio de oferta debe ser menor al precio normal.";
      valid = false;
    }

    return valid;
  }

  async function handleSave() {
    if (!product) return;
    if (!validate()) return;

    const flavorIds = Array.from(selectedFlavorIds);
    const firstFlavorId = flavorIds[0];

    const nextOffer: StoreOfferItem = {
      product_id: product.id,
      label: label.trim(),
      discount_price:
        discountPrice && discountPrice > 0 ? discountPrice : undefined,
      flavor_id: firstFlavorId || undefined,
      flavor_ids: flavorIds.length > 0 ? flavorIds : undefined,
      expires_at: new Date(expiry).toISOString(),
    };

    await onSave(nextOffer);
  }

  function toggleFlavor(flavorId: string) {
    const next = new Set(selectedFlavorIds);
    if (next.has(flavorId)) {
      next.delete(flavorId);
    } else {
      next.add(flavorId);
    }
    selectedFlavorIds = next;
  }

  function toDatetimeLocalValue(isoDate: string): string {
    const value = new Date(isoDate);
    if (Number.isNaN(value.getTime())) return "";
    const offsetMs = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
  }
</script>

<AdminModalShell
  bind:dialogRef
  title={`Oferta de ${product?.name ?? "producto"}`}
  icon="lucide:tag"
  widthClass="max-w-md"
  {onClose}
>
  <p class="text-sm text-base-content/60">
    Visible en la portada hasta que expire.
  </p>

  {#if label.trim()}
    <div class="flex items-center gap-2 text-sm">
      <span class="text-base-content/60">Vista previa:</span>
      <span class="badge badge-warning badge-sm">{label.trim()}</span>
    </div>
  {/if}

  {#if error}
    <div class="alert alert-warning alert-sm py-2">
      <Icon icon="lucide:alert-triangle" class="h-4 w-4" />
      <span class="text-sm">{error}</span>
    </div>
  {/if}

  <div class="space-y-4">
    <label class="form-control w-full">
      <span class="label-text text-sm">Etiqueta</span>
      <input
        class="input input-bordered input-sm w-full"
        type="text"
        placeholder="2x1"
        bind:value={label}
        disabled={busy}
      />
      {#if labelError}
        <span class="label-text-alt text-error text-xs mt-1">{labelError}</span>
      {/if}
    </label>

    <label class="form-control w-full">
      <span class="label-text text-sm">Precio oferta</span>
      <span class="text-xs text-base-content/60">
        Precio normal: {formatCurrency(regularPrice)}
      </span>
      <input
        class="input input-bordered input-sm w-full"
        type="number"
        min="0"
        step="0.01"
        placeholder="Opcional"
        bind:value={discountPrice}
        disabled={busy}
      />
      {#if discountPriceError}
        <span class="label-text-alt text-error text-xs mt-1"
          >{discountPriceError}</span
        >
      {:else if typeof discountPrice === "number" && discountPrice > 0}
        <span class="label-text-alt text-success text-xs mt-1">
          Precio final: {formatCurrency(offerPrice)} · Ahorro: {formatCurrency(
            savings,
          )} ({savingsPercent}%)
        </span>
      {/if}
    </label>

    {#if activeFlavors.length > 0}
      <div class="form-control w-full">
        <span class="label-text text-sm">Sabores incluidos en la oferta</span>
        <span class="text-xs text-base-content/60 mb-1">
          Opcional. Selecciona los sabores a los que aplica la oferta.
        </span>

        <div
          class="max-h-48 overflow-y-auto rounded-box border border-base-300 p-2 space-y-1"
        >
          {#each activeFlavors as flavor (flavor.id)}
            <label
              class="flex items-center gap-2 cursor-pointer hover:bg-base-200/50 rounded px-2 py-1.5"
            >
              <input
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary"
                checked={selectedFlavorIds.has(flavor.id)}
                onchange={() => toggleFlavor(flavor.id)}
                disabled={busy}
              />
              <span class="text-sm">
                {flavor.name}{#if flavor.is_seasonal}<span
                    class="ml-0.5 text-xs opacity-70">★</span
                  >{/if}
              </span>
            </label>
          {/each}
        </div>
      </div>
    {/if}

    <label class="form-control w-full">
      <span class="label-text text-sm">Expira</span>
      <input
        class="input input-bordered input-sm w-full"
        type="datetime-local"
        bind:value={expiry}
        disabled={busy}
      />
      {#if expiryError}
        <span class="label-text-alt text-error text-xs mt-1">{expiryError}</span
        >
      {/if}
    </label>
  </div>

  <div class="flex flex-wrap justify-end gap-2 pt-2">
    {#if existingOffer}
      <button
        class="btn btn-sm btn-ghost text-error hover:bg-error/10"
        type="button"
        onclick={onRemove}
        disabled={busy}
      >
        Quitar oferta
      </button>
    {/if}
    <button
      class="btn btn-sm btn-primary"
      type="button"
      onclick={handleSave}
      disabled={busy}
    >
      {#if busy}
        <span class="loading loading-spinner loading-xs"></span>
      {/if}
      Guardar
    </button>
  </div>
</AdminModalShell>
