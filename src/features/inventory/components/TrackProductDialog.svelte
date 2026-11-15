<script lang="ts">
  /**
   * Admin: start tracking a product sold by unit (paletas, bebidas…). The
   * product gets a stock row with 0 at every location; staff then register
   * what arrives with «Nueva entrada» → Unitario. Products made with flavour
   * balls are tracked through their flavours instead.
   */
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import {
    listProducts,
    type InventoryItem,
  } from "@features/admin-management/lib/bff";

  interface Props {
    open: boolean;
    /** Unit items already tracked at the working location. */
    trackedItems: InventoryItem[];
    onClose: () => void;
    onSubmit: (payload: {
      name: string;
      product_id: string;
      low_stock_threshold: number;
    }) => void;
  }

  let { open, trackedItems, onClose, onSubmit }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let products = $state<{ id: string; name: string; ball_based?: boolean }[]>(
    [],
  );
  let loadError = $state("");
  let productId = $state("");
  let threshold = $state(10);

  const candidates = $derived.by(() => {
    const tracked = new Set(trackedItems.map((item) => item.product_id));
    return products
      .filter((p) => !p.ball_based && !tracked.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  });
  const selected = $derived(candidates.find((p) => p.id === productId));
  const valid = $derived(
    !!selected &&
      Number.isInteger(threshold) &&
      threshold >= 0 &&
      threshold <= 100000,
  );

  let loaded = false;
  async function loadProducts() {
    if (loaded) return;
    loaded = true;
    try {
      const result = await listProducts({ all: true });
      products = result.products ?? [];
    } catch {
      loaded = false;
      loadError = "No se pudieron cargar los productos.";
    }
  }

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      void loadProducts();
      productId = "";
      threshold = 10;
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!valid || !selected) return;
    onSubmit({
      name: selected.name,
      product_id: selected.id,
      low_stock_threshold: threshold,
    });
  }
</script>

<AdminModalShell
  bind:dialogRef
  title="Llevar inventario de un producto"
  icon="lucide:package-plus"
  widthClass="max-w-md"
  {onClose}
>
  <form class="space-y-4" onsubmit={handleSubmit}>
    <p class="text-sm text-ink-muted">
      Para productos que se venden por unidad (paletas, bebidas, toppings
      empacados). Los conos y vasos descuentan de sus sabores.
    </p>

    {#if loadError}
      <p class="text-sm text-error" role="alert">{loadError}</p>
    {:else if products.length > 0 && candidates.length === 0}
      <p class="rounded-box bg-base-200 p-3 text-sm">
        Todos los productos por unidad ya llevan inventario.
      </p>
    {/if}

    <label class="form-control">
      <span class="label-text mb-1 text-sm">Producto</span>
      <select class="select select-bordered w-full" bind:value={productId}>
        <option value="" disabled>Elige un producto…</option>
        {#each candidates as product (product.id)}
          <option value={product.id}>{product.name}</option>
        {/each}
      </select>
    </label>

    <label class="form-control">
      <span class="label-text mb-1 text-sm">Mínimo (unidades)</span>
      <input
        type="number"
        min="0"
        max="100000"
        step="1"
        inputmode="numeric"
        class="input input-bordered w-full"
        bind:value={threshold}
      />
      <span class="mt-1 text-xs text-ink-muted"
        >Con menos de este número se marca «Stock bajo».</span
      >
    </label>

    <p class="text-xs text-ink-muted">
      Empieza con 0 en todas las sucursales. Después registra lo que tengas con
      «Nueva entrada» → Unitario.
    </p>

    <AdminFormActions
      submitLabel="Empezar a llevar inventario"
      onCancel={onClose}
      disabled={!valid}
    />
  </form>
</AdminModalShell>
