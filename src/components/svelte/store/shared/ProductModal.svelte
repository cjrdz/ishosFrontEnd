<script lang="ts">
  import Icon from "../../shared/AppIcon.svelte";
  import { formatCurrency } from "../../../../lib/utils/formatters";
  import type { PublicProduct } from "../../../../lib/api/store";

  interface Props {
    product: PublicProduct | null;
    quantity: number;
    displayPrice: number;
    ordersEnabled: boolean;
    showImageDetails: boolean;
    imageUrl?: string;
    onClose?: () => void;
    onToggleImageDetails?: () => void;
    onDecreaseQty?: () => void;
    onIncreaseQty?: () => void;
    onAdd?: () => void;
    onCheckout?: () => void;
  }

  let {
    product,
    quantity,
    displayPrice,
    ordersEnabled,
    showImageDetails,
    imageUrl,
    onClose = () => {},
    onToggleImageDetails = () => {},
    onDecreaseQty = () => {},
    onIncreaseQty = () => {},
    onAdd = () => {},
    onCheckout = () => {},
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let closeDispatched = $state(false);

  function normalizeQty(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.floor(value));
  }

  $effect(() => {
    if (!dialogRef) return;

    if (product) {
      closeDispatched = false;
      if (!dialogRef.open) {
        if (typeof dialogRef.showModal === "function") {
          dialogRef.showModal();
        } else {
          dialogRef.setAttribute("open", "");
        }
      }
      return;
    }

    if (dialogRef.open) {
      if (typeof dialogRef.close === "function") {
        dialogRef.close();
      } else {
        dialogRef.removeAttribute("open");
      }
    }
  });

  function emitCloseOnce() {
    if (closeDispatched) return;
    closeDispatched = true;
    onClose();
  }

  function closeDialog() {
    if (dialogRef && typeof dialogRef.close === "function") {
      dialogRef.close();
    } else {
      dialogRef?.removeAttribute("open");
    }
    emitCloseOnce();
  }

  function handleNativeClose() {
    emitCloseOnce();
  }
</script>

<dialog class="modal" bind:this={dialogRef} onclose={handleNativeClose}>
  <div
    class="modal-box w-[calc(100%-0.5rem)] sm:w-[min(96vw,980px)] max-w-5xl p-0 relative overflow-y-auto overflow-x-hidden max-h-[92dvh] rounded-2xl sm:rounded-3xl shadow-2xl"
  >
    <button
      type="button"
      class="btn btn-sm sm:btn-md btn-circle btn-ghost bg-base-200/20 hover:bg-base-200 backdrop-blur-md absolute right-3 top-3 sm:right-4 sm:top-4 z-99"
      aria-label="Cerrar"
      onclick={closeDialog}
    >
      <Icon icon="lucide:x" class="size-5" aria-hidden="true" />
    </button>

    {#if product}
      <div
        class="flex flex-col md:grid md:grid-cols-[1fr_1fr] md:h-full bg-base-100"
      >
        <div
          class="bg-base-200/30 p-3 sm:p-5 md:p-8 flex flex-col items-center justify-center relative"
        >
          {#if imageUrl}
            <div
              class="flip-3d-card w-full max-w-50 sm:max-w-70 md:max-w-90 mx-auto hover:scale-[1.02] transition-transform duration-300"
              data-flipped={showImageDetails ? "true" : "false"}
            >
              <button
                type="button"
                class="flip-3d-toggle w-full cursor-pointer focus:outline-none focus:ring-4 focus:ring-primary/20 rounded-3xl"
                aria-label={showImageDetails
                  ? "Ver imagen del producto"
                  : "Ver descripcion del producto"}
                onclick={onToggleImageDetails}
              >
                <div
                  class="flip-3d-inner aspect-square sm:aspect-4/5 rounded-2xl sm:rounded-3xl"
                >
                  <figure
                    class="flip-3d-face overflow-hidden rounded-2xl sm:rounded-3xl bg-base-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)]"
                  >
                    <img
                      src={imageUrl}
                      alt={product.name}
                      class="w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                  </figure>

                  <div
                    class="flip-3d-face flip-3d-back rounded-2xl sm:rounded-3xl overflow-hidden border border-base-200 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] bg-base-100"
                  >
                    <div
                      class="h-full w-full p-6 sm:p-8 flex items-center justify-center text-center"
                    >
                      <div class="space-y-3">
                        <h4
                          class="text-xl sm:text-2xl font-bold text-base-content"
                        >
                          {product.name}
                        </h4>
                        <p
                          class="text-sm sm:text-base text-base-content/70 leading-relaxed"
                        >
                          {product.description || "Sin descripcion disponible."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>
            <div
              class="mt-3 sm:mt-5 flex items-center gap-2 text-base-content/50 bg-base-100/50 backdrop-blur-sm py-1 px-3 sm:py-1.5 sm:px-4 rounded-full text-[11px] sm:text-sm font-medium"
            >
              <Icon icon="lucide:info" class="size-3.5 sm:size-4" />
              <span>Toca la tarjeta para detalles</span>
            </div>
          {:else}
            <div
              class="w-full max-w-50 sm:max-w-70 md:max-w-90 aspect-square sm:aspect-4/5 rounded-2xl sm:rounded-3xl bg-base-200 border border-base-300 grid place-items-center text-base-content/50 shadow-inner"
            >
              <div class="flex flex-col items-center gap-2">
                <Icon icon="lucide:image-off" class="size-8 opacity-50" />
                <span class="font-medium">Sin imagen</span>
              </div>
            </div>
          {/if}
        </div>

        <div
          class="p-4 sm:p-5 md:p-8 lg:p-10 space-y-3 sm:space-y-5 md:space-y-6 flex flex-col"
        >
          <div class="space-y-1.5 sm:space-y-2 pr-10 sm:pr-12">
            <h3
              class="text-xl sm:text-2xl md:text-3xl font-bold leading-tight bg-clip-text text-transparent bg-linear-to-r from-base-content to-base-content/80"
            >
              {product.name}
            </h3>
            <p
              class="text-lg sm:text-xl md:text-2xl font-extrabold text-primary"
            >
              {formatCurrency(displayPrice)}
            </p>
            {#if product.description}
              <p class="text-sm text-base-content/70 leading-relaxed">
                {product.description}
              </p>
            {/if}
            <p
              class="text-xs sm:text-sm font-medium text-base-content/60 inline-flex items-center gap-1.5 mt-2 bg-base-200/50 py-1.5 px-3 rounded-lg"
            >
              <Icon icon="lucide:sliders-horizontal" class="size-4" />
              Personaliza sabores en el carrito
            </p>
          </div>

          <div
            class="form-control bg-base-200/30 p-3 sm:p-4 rounded-2xl border border-base-200/50 space-y-2 sm:space-y-3 mt-auto"
          >
            <span
              class="label-text font-bold text-base-content/80 uppercase tracking-wider text-xs px-1"
              >Cantidad</span
            >
            <div
              class="grid grid-cols-3 w-full bg-base-100 rounded-xl overflow-hidden shadow-sm border border-base-200/80"
            >
              <button
                class="btn btn-ghost hover:bg-base-200 rounded-none h-12 sm:h-14"
                type="button"
                onclick={onDecreaseQty}
                aria-label="Reducir cantidad"
              >
                <Icon icon="lucide:minus" class="size-5" />
              </button>
              <div
                class="flex items-center justify-center font-bold text-lg sm:text-xl h-12 sm:h-14 border-x border-base-200/50 bg-base-50"
              >
                {normalizeQty(quantity)}
              </div>
              <button
                class="btn btn-ghost hover:bg-base-200 rounded-none h-12 sm:h-14"
                type="button"
                onclick={onIncreaseQty}
                aria-label="Aumentar cantidad"
              >
                <Icon icon="lucide:plus" class="size-5" />
              </button>
            </div>
          </div>

          <div class="grid gap-2 sm:gap-3 pt-1 sm:pt-2">
            {#if ordersEnabled}
              <button
                type="button"
                class="btn btn-primary btn-md sm:btn-lg rounded-xl font-bold shadow-md hover:shadow-lg transition-all w-full leading-none"
                onclick={onAdd}
              >
                <span class="mr-2">Agregar al pedido</span>
                <Icon icon="lucide:plus-circle" class="size-5" />
              </button>
              <button
                type="button"
                class="btn btn-outline btn-md sm:btn-lg rounded-xl font-bold hover:bg-base-200 hover:text-base-content w-full leading-none"
                onclick={onCheckout}
              >
                <Icon
                  icon="lucide:shopping-bag"
                  class="size-5 mr-2"
                  aria-hidden="true"
                />
                Ir al Carrito
              </button>
            {:else}
              <div class="store-paused-banner text-center text-sm font-medium">
                ¡Gracias por escoger nuestros productos 🙂!
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop bg-base-300/60 backdrop-blur-sm">
    <button>Cerrar</button>
  </form>
</dialog>
