<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "../../shared/AppIcon.svelte";
  import {
    getAdminStoreSettings,
    updateAdminStoreSettings,
    type StoreOfferItem,
  } from "../../../../lib/bff/admin";
  import { ApiError } from "../../../../lib/errors/api";
  import type { Product } from "../../../../lib/api/admin";
  import { formatCurrency } from "../../../../lib/utils/formatters";

  interface Props {
    products: Product[];
  }

  let { products }: Props = $props();

  let localBusy = $state(false);
  let moduleError = $state("");
  let notice = $state("");
  let ordersEnabled = $state(true);
  let offers = $state<StoreOfferItem[]>([]);

  let editingOfferIndex = $state<number | null>(null);
  let newOfferProductId = $state("");
  let newOfferLabel = $state("");
  let newOfferNote = $state("");
  let newOfferDiscount = $state<number | undefined>(undefined);
  let newOfferExpiry = $state("");

  const selectableProducts = $derived(
    products.filter((product) => product.is_available),
  );

  onMount(() => {
    void loadStoreSettings();
  });

  function setNotice(message: string) {
    notice = message;
    setTimeout(() => {
      if (notice === message) notice = "";
    }, 2500);
  }

  async function loadStoreSettings() {
    localBusy = true;
    moduleError = "";
    try {
      const response = await getAdminStoreSettings();
      ordersEnabled = response.orders_enabled;
      offers = response.offers ?? [];
    } catch (requestError) {
      moduleError =
        requestError instanceof ApiError && requestError.status === 404
          ? "No se pudo conectar con la configuracion de ofertas. Verifica que el backend este actualizado."
          : requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar configuracion de ofertas";
    } finally {
      localBusy = false;
    }
  }

  const isEditing = $derived(editingOfferIndex !== null);
  const editingOfferProductId = $derived(
    editingOfferIndex !== null
      ? (offers[editingOfferIndex]?.product_id ?? "")
      : "",
  );
  const formActionLabel = $derived(
    isEditing ? "Actualizar oferta" : "Agregar oferta",
  );

  function resetOfferForm() {
    editingOfferIndex = null;
    newOfferProductId = "";
    newOfferLabel = "";
    newOfferNote = "";
    newOfferDiscount = undefined;
    newOfferExpiry = "";
  }

  function submitOfferForm() {
    moduleError = "";

    const normalizedLabel = newOfferLabel.trim();
    const normalizedNote = newOfferNote.trim();

    if (!newOfferProductId || !normalizedLabel || !newOfferExpiry) {
      moduleError = "Completa producto, etiqueta y fecha de expiracion.";
      return;
    }

    if ((!newOfferDiscount || newOfferDiscount <= 0) && !normalizedNote) {
      moduleError =
        "Si no hay descuento, agrega una nota para publicar en la oferta.";
      return;
    }

    const nextExpiry = new Date(newOfferExpiry);
    if (Number.isNaN(nextExpiry.getTime())) {
      moduleError = "La fecha de expiracion no es valida.";
      return;
    }

    if (nextExpiry.getTime() <= Date.now()) {
      moduleError = "La fecha de expiracion debe ser futura.";
      return;
    }

    const nextOffer: StoreOfferItem = {
      product_id: newOfferProductId,
      label: normalizedLabel,
      note: normalizedNote || undefined,
      discount_price:
        newOfferDiscount && newOfferDiscount > 0 ? newOfferDiscount : undefined,
      expires_at: nextExpiry.toISOString(),
    };

    if (editingOfferIndex !== null && offers[editingOfferIndex]) {
      const clone = [...offers];
      clone[editingOfferIndex] = nextOffer;
      offers = clone;
    } else {
      offers = [...offers, nextOffer];
    }

    resetOfferForm();
  }

  function startEditOffer(index: number) {
    moduleError = "";
    const offer = offers[index];
    if (!offer) return;

    editingOfferIndex = index;
    newOfferProductId = offer.product_id;
    newOfferLabel = offer.label;
    newOfferNote = offer.note ?? "";
    newOfferDiscount = offer.discount_price;
    newOfferExpiry = toDatetimeLocalValue(offer.expires_at);
  }

  function removeOfferRow(index: number) {
    offers = offers.filter((_, currentIndex) => currentIndex !== index);

    if (editingOfferIndex === index) {
      resetOfferForm();
      return;
    }

    if (editingOfferIndex !== null && editingOfferIndex > index) {
      editingOfferIndex = editingOfferIndex - 1;
    }
  }

  async function saveOffers() {
    await persistStoreSettings(
      {
        orders_enabled: ordersEnabled,
        offers,
      },
      "Ofertas guardadas",
    );
  }

  async function persistStoreSettings(
    payload: { orders_enabled: boolean; offers: StoreOfferItem[] },
    successNotice: string,
  ) {
    localBusy = true;
    moduleError = "";
    try {
      const saved = await updateAdminStoreSettings(payload);
      ordersEnabled = saved.orders_enabled;
      offers = saved.offers ?? [];
      resetOfferForm();
      setNotice(successNotice);
    } catch (requestError) {
      moduleError =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar la configuracion";
    } finally {
      localBusy = false;
    }
  }

  function productNameById(productId: string): string {
    const found = products.find((item) => item.id === productId);
    return found?.name ?? productId;
  }

  function productPriceById(productId: string): number | null {
    const found = products.find((item) => item.id === productId);
    return typeof found?.price === "number" ? found.price : null;
  }

  function formatExpiry(isoDate: string): string {
    const value = new Date(isoDate);
    if (Number.isNaN(value.getTime())) return "Fecha invalida";
    return value.toLocaleString();
  }

  function toDatetimeLocalValue(isoDate: string): string {
    const value = new Date(isoDate);
    if (Number.isNaN(value.getTime())) return "";
    const offsetMs = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function hasDiscount(offer: StoreOfferItem): boolean {
    return typeof offer.discount_price === "number" && offer.discount_price > 0;
  }
</script>

<section class="space-y-4">
  {#if notice}
    <div class="alert alert-success shadow-sm"><span>{notice}</span></div>
  {/if}

  {#if moduleError}
    <div class="alert alert-warning shadow-sm"><span>{moduleError}</span></div>
  {/if}

  <div class="card bg-base-100 shadow">
    <div class="card-body gap-4">
      <div>
        <h2 class="card-title">Ofertas de portada</h2>
        <p class="text-sm text-base-content/70">
          Se muestran en la homepage. Puedes crear, editar o eliminar ofertas
          antes de guardarlas.
        </p>
      </div>

      <!-- Desktop table (hidden on small/medium screens) -->
      <div
        class="hidden xl:block overflow-x-auto rounded-xl border border-base-300"
      >
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Etiqueta</th>
              <th>Precio normal</th>
              <th>Precio oferta</th>
              <th>Nota</th>
              <th>Expira</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#if offers.length === 0}
              <tr>
                <td colspan="7" class="text-center text-base-content/60"
                  >Aun no hay ofertas activas.</td
                >
              </tr>
            {/if}
            {#each offers as offer, offerIndex}
              <tr>
                <td>
                  <div class="font-medium">
                    {productNameById(offer.product_id)}
                  </div>
                </td>
                <td>{offer.label}</td>
                <td>
                  {#if productPriceById(offer.product_id) != null}
                    <span class="text-base-content/70"
                      >{formatCurrency(
                        productPriceById(offer.product_id) ?? 0,
                      )}</span
                    >
                  {:else}
                    <span class="text-base-content/40">-</span>
                  {/if}
                </td>
                <td>
                  {#if hasDiscount(offer)}
                    <span class="font-semibold text-primary"
                      >{formatCurrency(offer.discount_price ?? 0)}</span
                    >
                  {:else}
                    <span class="text-base-content/40">Sin descuento</span>
                  {/if}
                </td>
                <td>
                  {#if offer.note}
                    <span class="text-sm text-base-content/80"
                      >{offer.note}</span
                    >
                  {:else}
                    <span class="text-base-content/40">-</span>
                  {/if}
                </td>
                <td>{formatExpiry(offer.expires_at)}</td>
                <td class="text-right">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      onclick={() => startEditOffer(offerIndex)}
                      disabled={localBusy}
                    >
                      <Icon icon="lucide:pencil" class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm btn-error"
                      onclick={() => removeOfferRow(offerIndex)}
                      disabled={localBusy}
                    >
                      <Icon icon="lucide:trash-2" class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}

            <tr class="bg-base-200/50">
              <td>
                <select
                  class="select select-bordered select-sm w-full min-w-36"
                  bind:value={newOfferProductId}
                  disabled={localBusy || isEditing}
                >
                  <option value="">Seleccionar...</option>
                  {#each selectableProducts as product (product.id)}
                    <option value={product.id}>{product.name}</option>
                  {/each}
                </select>
              </td>
              <td>
                <input
                  class="input input-bordered input-sm w-full min-w-32"
                  type="text"
                  placeholder="Ej: 2x1 Fresa"
                  bind:value={newOfferLabel}
                  disabled={localBusy}
                />
              </td>
              <td>
                {#if productPriceById(newOfferProductId) != null}
                  {formatCurrency(productPriceById(newOfferProductId) ?? 0)}
                {:else}
                  <span class="text-base-content/40">-</span>
                {/if}
              </td>
              <td>
                <input
                  class="input input-bordered input-sm w-full min-w-24"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Opcional"
                  bind:value={newOfferDiscount}
                  disabled={localBusy}
                />
              </td>
              <td>
                <input
                  class="input input-bordered input-sm w-full min-w-28"
                  type="text"
                  placeholder="Nota publica"
                  bind:value={newOfferNote}
                  disabled={localBusy}
                />
              </td>
              <td>
                <input
                  class="input input-bordered input-sm w-full min-w-40"
                  type="datetime-local"
                  bind:value={newOfferExpiry}
                  disabled={localBusy}
                />
              </td>
              <td class="text-right">
                <button
                  type="button"
                  class="btn btn-sm btn-outline"
                  onclick={submitOfferForm}
                  disabled={localBusy}
                >
                  <Icon
                    icon={isEditing ? "lucide:save" : "lucide:plus"}
                    class="h-4 w-4"
                  />
                  {formActionLabel}
                </button>
                {#if isEditing}
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost"
                    onclick={resetOfferForm}
                    disabled={localBusy}>Cancelar</button
                  >
                {/if}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile/Tablet card layout (visible below xl) -->
      <div class="xl:hidden space-y-3">
        {#if offers.length === 0}
          <div
            class="rounded-xl border border-base-300 p-4 text-center text-base-content/60"
          >
            Aun no hay ofertas activas.
          </div>
        {/if}
        {#each offers as offer, offerIndex}
          <div
            class="rounded-xl border border-base-300 bg-base-100 p-3 sm:p-4 space-y-2"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-sm truncate">
                  {productNameById(offer.product_id)}
                </p>
                <span class="badge badge-sm badge-outline mt-1"
                  >{offer.label}</span
                >
              </div>
              <div class="flex gap-1 shrink-0">
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  onclick={() => startEditOffer(offerIndex)}
                  disabled={localBusy}
                >
                  <Icon icon="lucide:pencil" class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs btn-error"
                  onclick={() => removeOfferRow(offerIndex)}
                  disabled={localBusy}
                >
                  <Icon icon="lucide:trash-2" class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div
              class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-base-content/70"
            >
              <div>
                <span
                  class="font-semibold text-base-content/50 uppercase tracking-wider text-[10px]"
                  >Normal</span
                >
                <p class="font-medium">
                  {#if productPriceById(offer.product_id) != null}
                    {formatCurrency(productPriceById(offer.product_id) ?? 0)}
                  {:else}
                    -
                  {/if}
                </p>
              </div>
              <div>
                <span
                  class="font-semibold text-base-content/50 uppercase tracking-wider text-[10px]"
                  >Oferta</span
                >
                <p class="font-medium">
                  {#if hasDiscount(offer)}
                    <span class="text-primary"
                      >{formatCurrency(offer.discount_price ?? 0)}</span
                    >
                  {:else}
                    Sin descuento
                  {/if}
                </p>
              </div>
              {#if offer.note}
                <div class="col-span-2">
                  <span
                    class="font-semibold text-base-content/50 uppercase tracking-wider text-[10px]"
                    >Nota</span
                  >
                  <p>{offer.note}</p>
                </div>
              {/if}
              <div class="col-span-2">
                <span
                  class="font-semibold text-base-content/50 uppercase tracking-wider text-[10px]"
                  >Expira</span
                >
                <p>{formatExpiry(offer.expires_at)}</p>
              </div>
            </div>
          </div>
        {/each}

        <!-- Mobile add/edit form -->
        <div
          class="rounded-xl border border-dashed border-base-300 bg-base-200/40 p-3 sm:p-4 space-y-3"
        >
          <p
            class="text-xs font-semibold uppercase tracking-wider text-base-content/50"
          >
            {isEditing ? "Editar oferta" : "Nueva oferta"}
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label class="form-control w-full">
              <span class="label-text text-xs mb-1">Producto</span>
              <select
                class="select select-bordered select-sm w-full"
                bind:value={newOfferProductId}
                disabled={localBusy || isEditing}
              >
                <option value="">Seleccionar...</option>
                {#each selectableProducts as product (product.id)}
                  <option value={product.id}>{product.name}</option>
                {/each}
              </select>
            </label>
            <label class="form-control w-full">
              <span class="label-text text-xs mb-1">Etiqueta</span>
              <input
                class="input input-bordered input-sm w-full"
                type="text"
                placeholder="Ej: 2x1 Fresa"
                bind:value={newOfferLabel}
                disabled={localBusy}
              />
            </label>
            <label class="form-control w-full">
              <span class="label-text text-xs mb-1">Precio oferta</span>
              <input
                class="input input-bordered input-sm w-full"
                type="number"
                min="0"
                step="0.01"
                placeholder="Opcional"
                bind:value={newOfferDiscount}
                disabled={localBusy}
              />
            </label>
            <label class="form-control w-full">
              <span class="label-text text-xs mb-1">Nota</span>
              <input
                class="input input-bordered input-sm w-full"
                type="text"
                placeholder="Nota publica"
                bind:value={newOfferNote}
                disabled={localBusy}
              />
            </label>
            <label class="form-control w-full sm:col-span-2">
              <span class="label-text text-xs mb-1">Expira</span>
              <input
                class="input input-bordered input-sm w-full"
                type="datetime-local"
                bind:value={newOfferExpiry}
                disabled={localBusy}
              />
            </label>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="btn btn-sm btn-outline flex-1"
              onclick={submitOfferForm}
              disabled={localBusy}
            >
              <Icon
                icon={isEditing ? "lucide:save" : "lucide:plus"}
                class="h-4 w-4"
              />
              {formActionLabel}
            </button>
            {#if isEditing}
              <button
                type="button"
                class="btn btn-sm btn-ghost"
                onclick={resetOfferForm}
                disabled={localBusy}>Cancelar</button
              >
            {/if}
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-base-content/60">
          {#if isEditing}
            Editando la oferta de <span class="font-semibold text-base-content"
              >{productNameById(editingOfferProductId)}</span
            >.
          {:else}
            Las ofertas se publican cuando presionas guardar.
          {/if}
        </p>
        <button
          class="btn btn-primary"
          type="button"
          onclick={saveOffers}
          disabled={localBusy}>Guardar ofertas</button
        >
      </div>
    </div>
  </div>
</section>
