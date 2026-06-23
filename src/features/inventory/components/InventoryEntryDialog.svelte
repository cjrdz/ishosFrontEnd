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
    onClose: () => void;
    onSubmit: (payload: {
      type: "flavor" | "unit";
      flavor_id?: string;
      container_type_id?: string;
      quantity_containers?: number;
      balls_per_container?: number;
      inventory_item_id?: string;
      quantity?: number;
    }) => void;
    onOpenContainerTypes: () => void;
  }

  let {
    open,
    containerTypes,
    flavorItems,
    unitItems,
    onClose,
    onSubmit,
    onOpenContainerTypes,
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
      selectedFlavorItem &&
      selectedFlavorItem.current_stock === 0 &&
      selectedFlavorItem.low_stock_threshold === 0,
  );

  let canSubmit = $derived(
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
    if (!canSubmit) return;
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
    onOpenContainerTypes();
    onClose();
  }
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
          class="btn btn-sm join-item flex-1"
          class:btn-neutral={entryType === "flavor"}
          class:btn-ghost={entryType !== "flavor"}
          onclick={() => (entryType = "flavor")}
        >
          <Icon icon="lucide:ice-cream-cone" width="14" height="14" />
          Sabor
        </button>
        <button
          type="button"
          class="btn btn-sm join-item flex-1"
          class:btn-neutral={entryType === "unit"}
          class:btn-ghost={entryType !== "unit"}
          onclick={() => (entryType = "unit")}
        >
          <Icon icon="lucide:box" width="14" height="14" />
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
            <option value="">Seleccionar sabor...</option>
            {#each flavorItems as item (item.id)}
              <option value={item.flavor_id ?? item.id}>
                {item.name}
              </option>
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
          <div class="flex items-center justify-between">
            <span class="label-text text-xs mb-1">Tipo de recipiente</span>
            <button
              type="button"
              class="btn btn-xs btn-outline"
              onclick={handleOpenContainerTypes}
            >
              <Icon icon="lucide:settings" width="12" height="12" />
              Gestionar contenedores
            </button>
          </div>
          <select
            class="select select-bordered select-sm w-full mt-1"
            bind:value={flavorForm.container_type_id}
            required
          >
            <option value="">Seleccionar...</option>
            {#each containerTypes as ct (ct.id)}
              <option value={ct.id}>
                {ct.name}
                {#if !ct.is_custom}
                  ({ct.balls_per_container} bolas)
                {:else}
                  (custom)
                {/if}
              </option>
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
        </div>

        {#if flavorForm.container_type_id && flavorForm.quantity_containers > 0}
          <div class="alert alert-info text-sm py-2">
            <span>
              Total: <strong>{totalBalls.toLocaleString()}</strong> bolas
            </span>
          </div>
        {/if}
      </div>
    {/if}

    {#if entryType === "unit"}
      <div class="space-y-3 rounded-lg border border-base-300/70 p-3">
        <div class="form-control">
          <span class="label-text text-xs mb-1">Producto</span>
          <select
            class="select select-bordered select-sm w-full"
            bind:value={unitForm.inventory_item_id}
            required
          >
            <option value="">Seleccionar producto...</option>
            {#each unitItems as item (item.id)}
              <option value={item.id}>{item.name}</option>
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
      </div>
    {/if}

    <AdminFormActions
      submitLabel="Registrar Entrada"
      onCancel={onClose}
      disabled={!canSubmit}
    />
  </form>
</AdminModalShell>
