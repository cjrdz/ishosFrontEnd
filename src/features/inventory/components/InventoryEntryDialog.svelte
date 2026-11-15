<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import type {
    ContainerType,
    InventoryItem,
  } from "@features/admin-management/lib/bff";

  interface Props {
    open: boolean;
    containerTypes: ContainerType[];
    flavorItems: InventoryItem[];
    unitItems: InventoryItem[];
    /**
     * Every product sold by unit. Ones without inventory yet are listed too:
     * admins start tracking them with this entry; others cannot pick them.
     */
    unitProducts?: { id: string; name: string }[];
    /** A submit is in flight: block double submits. */
    busy?: boolean;
    onClose: () => void;
    onSubmit: (payload: {
      type: "flavor" | "unit";
      flavor_id?: string;
      container_type_id?: string;
      quantity_containers?: number;
      balls_per_container?: number;
      inventory_item_id?: string;
      /** A unit product without inventory yet: start tracking it first. */
      new_product?: { id: string; name: string };
      quantity?: number;
    }) => void;
    /** Absent for managers: only admins edit container types. */
    onOpenContainerTypes?: () => void;
    /** Admin only: open "Llevar inventario de un producto". */
    onTrackProduct?: () => void;
    /** Opened from a row's "+ Entrada": start with that item selected. */
    preselect?: { type: "flavor" | "unit"; id: string } | null;
  }

  let {
    open,
    containerTypes,
    flavorItems,
    unitItems,
    unitProducts = [],
    busy = false,
    onClose,
    onSubmit,
    onOpenContainerTypes,
    onTrackProduct,
    preselect = null,
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let entryType = $state<"flavor" | "unit">("flavor");

  let flavorForm = $state({
    flavor_id: "",
    container_type_id: "",
    quantity_containers: 1,
    balls_per_container: 0,
  });

  let unitForm = $state({
    inventory_item_id: "",
    quantity: 1,
  });

  let selectedContainerType = $derived(
    containerTypes.find((c) => c.id === flavorForm.container_type_id),
  );
  let isCustom = $derived(selectedContainerType?.is_custom ?? false);
  let totalBalls = $derived(
    flavorForm.quantity_containers *
      (isCustom
        ? flavorForm.balls_per_container || 0
        : selectedContainerType?.balls_per_container || 0),
  );

  let selectedFlavorItem = $derived(
    flavorItems.find(
      (f) =>
        f.id === flavorForm.flavor_id || f.flavor_id === flavorForm.flavor_id,
    ),
  );
  let isUnregisteredFlavor = $derived(
    entryType === "flavor" &&
      !!selectedFlavorItem &&
      selectedFlavorItem.id === selectedFlavorItem.flavor_id,
  );

  let formValid = $derived(
    entryType === "flavor"
      ? flavorForm.flavor_id &&
          flavorForm.container_type_id &&
          flavorForm.quantity_containers > 0 &&
          (!isCustom || flavorForm.balls_per_container > 0)
      : unitForm.inventory_item_id && unitForm.quantity > 0,
  );

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      if (preselect) {
        entryType = preselect.type;
        if (preselect.type === "flavor") flavorForm.flavor_id = preselect.id;
        else unitForm.inventory_item_id = preselect.id;
      }
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

  function resetForms() {
    flavorForm = {
      flavor_id: "",
      container_type_id: "",
      quantity_containers: 1,
      balls_per_container: 0,
    };
    unitForm = {
      inventory_item_id: "",
      quantity: 1,
    };
    entryType = "flavor";
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!formValid || busy) return;
    if (entryType === "flavor") {
      onSubmit({
        type: "flavor",
        flavor_id: flavorForm.flavor_id,
        container_type_id: flavorForm.container_type_id,
        quantity_containers: flavorForm.quantity_containers,
        balls_per_container: isCustom
          ? flavorForm.balls_per_container
          : undefined,
      });
    } else if (unitForm.inventory_item_id.startsWith(NEW_PREFIX)) {
      const id = unitForm.inventory_item_id.slice(NEW_PREFIX.length);
      const product = untrackedProducts.find((p) => p.id === id);
      if (!product) return;
      onSubmit({
        type: "unit",
        new_product: { id: product.id, name: product.name },
        quantity: unitForm.quantity,
      });
    } else {
      onSubmit({
        type: "unit",
        inventory_item_id: unitForm.inventory_item_id,
        quantity: unitForm.quantity,
      });
    }
    resetForms();
  }

  function handleOpenContainerTypes() {
    onOpenContainerTypes?.();
    onClose();
  }

  // Each <select> renders a single {#each} over a prepared list (placeholder
  // included): extra blocks or nodes beside it trip the browser's
  // select-content check.
  type SelectOption = { key: string; value: string; label: string };
  const flavorOptions = $derived<SelectOption[]>([
    { key: "", value: "", label: "Elige un sabor…" },
    ...flavorItems.map((item) => ({
      key: item.id,
      value: item.flavor_id ?? item.id,
      label: item.name,
    })),
  ]);
  const containerOptions = $derived<SelectOption[]>([
    { key: "", value: "", label: "Seleccionar..." },
    ...containerTypes.map((ct) => ({
      key: ct.id,
      value: ct.id,
      label: `${ct.name} (${ct.is_custom ? "personalizado" : `${ct.balls_per_container} bolas`})`,
    })),
  ]);
  // Untracked products use this value prefix (they have no inventory id yet).
  const NEW_PREFIX = "new:";
  const untrackedProducts = $derived.by(() => {
    const tracked = new Set(unitItems.map((item) => item.product_id));
    return unitProducts
      .filter((p) => !tracked.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  });
  const unitOptions = $derived<(SelectOption & { disabled?: boolean })[]>([
    { key: "", value: "", label: "Elige un producto…" },
    ...[...unitItems]
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((item) => ({ key: item.id, value: item.id, label: item.name })),
    ...untrackedProducts.map((p) => ({
      key: `${NEW_PREFIX}${p.id}`,
      value: `${NEW_PREFIX}${p.id}`,
      label: onTrackProduct
        ? `${p.name} · empieza a llevar inventario`
        : `${p.name} · sin inventario (lo activa un admin)`,
      disabled: !onTrackProduct,
    })),
  ]);
  const startsTracking = $derived(
    entryType === "unit" && unitForm.inventory_item_id.startsWith(NEW_PREFIX),
  );
</script>

<AdminModalShell
  bind:dialogRef
  title="Nueva entrada de inventario"
  icon="lucide:package-plus"
  widthClass="max-w-xl"
  {onClose}
>
  <form class="space-y-4" onsubmit={handleSubmit}>
    <!-- Type toggle -->
    <div class="form-control">
      <span class="label-text text-xs mb-1">Tipo de entrada</span>
      <div class="join w-full">
        <button
          type="button"
          class="btn btn-md join-item flex-1"
          class:btn-neutral={entryType === "flavor"}
          class:btn-ghost={entryType !== "flavor"}
          onclick={() => (entryType = "flavor")}
        >
          <Icon icon="lucide:ice-cream-cone" width="16" height="16" />
          Sabor
        </button>
        <button
          type="button"
          class="btn btn-md join-item flex-1"
          class:btn-neutral={entryType === "unit"}
          class:btn-ghost={entryType !== "unit"}
          onclick={() => (entryType = "unit")}
        >
          <Icon icon="lucide:box" width="16" height="16" />
          Unitario
        </button>
      </div>
    </div>

    {#if entryType === "flavor"}
      <div class="space-y-3 rounded-lg border border-base-300/70 p-3">
        <div class="form-control">
          <span class="label-text text-xs mb-1">Sabor</span>
          <select
            class="select select-bordered select-sm w-full"
            bind:value={flavorForm.flavor_id}
            required
          >
            {#each flavorOptions as option (option.key)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>

        {#if isUnregisteredFlavor}
          <div class="alert alert-info text-sm py-2">
            <Icon icon="lucide:info" width="16" height="16" />
            <span
              >Este sabor aún no está en inventario. Se registrará
              automáticamente.</span
            >
          </div>
        {/if}

        <div class="form-control">
          <span class="label-text text-xs mb-1">Tipo de recipiente</span>
          <select
            class="select select-bordered select-sm w-full"
            bind:value={flavorForm.container_type_id}
            required
          >
            {#each containerOptions as option (option.key)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>

        {#if isCustom}
          <div class="form-control">
            <span class="label-text text-xs mb-1">Bolas por recipiente</span>
            <input
              type="number"
              class="input input-bordered input-sm w-full"
              bind:value={flavorForm.balls_per_container}
              min="1"
              placeholder="Ej: 50"
              required
            />
          </div>
        {/if}

        <div class="form-control">
          <span class="label-text text-xs mb-1">Cantidad de recipientes</span>
          <input
            type="number"
            class="input input-bordered input-sm w-full"
            bind:value={flavorForm.quantity_containers}
            min="1"
            placeholder="Ej: 5"
            required
          />
          {#if flavorForm.container_type_id && flavorForm.quantity_containers > 0}
            <p class="text-sm text-ink-muted mt-1.5">
              = {totalBalls.toLocaleString()} bolas totales
            </p>
          {/if}
        </div>

        <div class="flex justify-end">
          {#if onOpenContainerTypes}
            <button
              type="button"
              class="btn btn-xs btn-ghost gap-1"
              onclick={handleOpenContainerTypes}
            >
              <Icon icon="lucide:settings" width="12" height="12" />
              Gestionar contenedores
            </button>
          {/if}
        </div>
      </div>
    {/if}

    {#if entryType === "unit" && unitItems.length === 0 && untrackedProducts.length === 0}
      <div class="space-y-3 rounded-lg border border-base-300/70 p-4 text-sm">
        <p class="font-medium">
          Aún no llevas inventario de productos por unidad.
        </p>
        <p class="text-ink-muted">
          Los conos y vasos descuentan de sus sabores. Para paletas, bebidas y
          otros productos por unidad, primero activa su inventario.
        </p>
        {#if onTrackProduct}
          <button
            type="button"
            class="btn btn-outline btn-sm gap-2"
            onclick={onTrackProduct}
          >
            <Icon icon="lucide:package-plus" width="16" height="16" />
            Llevar inventario de un producto
          </button>
        {:else}
          <p class="text-ink-muted">Pídeselo a un administrador.</p>
        {/if}
      </div>
    {:else if entryType === "unit"}
      <div class="space-y-3 rounded-lg border border-base-300/70 p-3">
        <div class="form-control">
          <span class="label-text text-xs mb-1">Producto</span>
          <select
            class="select select-bordered select-sm w-full"
            bind:value={unitForm.inventory_item_id}
            required
          >
            {#each unitOptions as option (option.key)}
              <option value={option.value} disabled={option.disabled}
                >{option.label}</option
              >
            {/each}
          </select>
        </div>

        <div class="form-control">
          <span class="label-text text-xs mb-1">Cantidad</span>
          <input
            type="number"
            class="input input-bordered input-sm w-full"
            bind:value={unitForm.quantity}
            min="1"
            placeholder="Ej: 20"
            required
          />
        </div>
        {#if startsTracking}
          <p class="text-xs text-ink-muted" role="note">
            Al registrar, este producto empieza a llevar inventario en todas las
            sucursales (mínimo 10, puedes cambiarlo) y la entrada se suma aquí.
          </p>
        {/if}
      </div>
    {/if}

    <AdminFormActions
      submitLabel="Registrar entrada"
      {busy}
      onCancel={onClose}
      disabled={!formValid}
    />
  </form>
</AdminModalShell>
