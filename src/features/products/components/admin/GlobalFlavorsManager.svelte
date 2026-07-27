<script lang="ts">
  import type { Flavor } from "@features/admin-management";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import AdminTableRowActions from "@features/admin-management/components/shared/AdminTableRowActions.svelte";
  import ConfirmDialog from "@shared/components/ConfirmDialog.svelte";
  import {
    closeConfirmDialog,
    confirmDialogNow,
    createConfirmDialogState,
    openConfirmDialog,
  } from "@shared/utils/confirm-dialog";
  import { sortByDisplayOrderAndName } from "@features/products";

  interface Props {
    open: boolean;
    flavors: Flavor[];
    busy: boolean;
    error: string;
    onClose: () => void;
    onCreate: (payload: {
      name: string;
      is_seasonal: boolean;
    }) => void | Promise<void>;
    onUpdate: (
      id: string,
      payload: {
        name: string;
        display_order: number;
        is_seasonal: boolean;
        is_active: boolean;
      },
    ) => void | Promise<void>;
    onDelete: (id: string) => void | Promise<void>;
  }

  let {
    open,
    flavors,
    busy,
    error,
    onClose,
    onCreate,
    onUpdate,
    onDelete,
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let editingFlavorId = $state<string | null>(null);
  let formBusy = $state(false);
  let flavorForm = $state({
    id: "",
    name: "",
    display_order: 0,
    is_seasonal: false,
    is_active: true,
  });
  let confirmDialog = $state(createConfirmDialogState());

  const sortedFlavors = $derived(
    flavors
      .slice()
      .sort((left, right) => sortByDisplayOrderAndName(left, right)),
  );

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

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
  }

  async function submitFlavor(event: SubmitEvent) {
    event.preventDefault();
    formBusy = true;
    try {
      if (flavorForm.id) {
        await onUpdate(flavorForm.id, {
          name: flavorForm.name.trim(),
          display_order: Number(flavorForm.display_order),
          is_seasonal: Boolean(flavorForm.is_seasonal),
          is_active: Boolean(flavorForm.is_active),
        });
      } else {
        await onCreate({
          name: flavorForm.name.trim(),
          is_seasonal: Boolean(flavorForm.is_seasonal),
        });
      }

      resetFlavorForm();
    } finally {
      formBusy = false;
    }
  }

  function requestDeleteFlavor(flavor: Flavor) {
    openConfirmDialog(
      confirmDialog,
      "Eliminar sabor",
      `Seguro que deseas eliminar ${flavor.name}?`,
      () => onDelete(flavor.id),
    );
  }

  async function moveFlavor(flavor: Flavor, direction: -1 | 1) {
    const index = sortedFlavors.findIndex((f) => f.id === flavor.id);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedFlavors.length) return;

    const target = sortedFlavors[targetIndex];
    const currentPayload = {
      name: flavor.name,
      display_order: target.display_order,
      is_seasonal: flavor.is_seasonal,
      is_active: flavor.is_active,
    };
    const targetPayload = {
      name: target.name,
      display_order: flavor.display_order,
      is_seasonal: target.is_seasonal,
      is_active: target.is_active,
    };

    await onUpdate(flavor.id, currentPayload);
    await onUpdate(target.id, targetPayload);
  }
</script>

<AdminModalShell
  bind:dialogRef
  title="Sabores globales"
  icon="lucide:ice-cream-bowl"
  widthClass="max-w-6xl"
  {onClose}
>
  <p class="text-sm text-base-content/70">
    Gestiona sabores disponibles para enlazar a productos.
  </p>

  {#if error}
    <div class="alert alert-warning"><span>{error}</span></div>
  {/if}

  <div class="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
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
                <td class="text-center">{flavor.display_order + 1}</td>
                <td class="text-center">
                  {#if flavor.is_seasonal}
                    <span class="badge badge-warning badge-sm">Temporada</span>
                  {:else}
                    <span class="badge badge-ghost badge-sm">Regular</span>
                  {/if}
                </td>
                <td class="text-center">
                  <span
                    class={`badge badge-sm ${flavor.is_active ? "badge-success" : "badge-ghost"}`}
                    >{flavor.is_active ? "Activo" : "Inactivo"}</span
                  >
                </td>
                <td class="text-center">
                  <AdminTableRowActions
                    itemName={flavor.name}
                    {busy}
                    {formBusy}
                    canMoveUp={sortedFlavors.findIndex(
                      (f) => f.id === flavor.id,
                    ) > 0}
                    canMoveDown={sortedFlavors.findIndex(
                      (f) => f.id === flavor.id,
                    ) <
                      sortedFlavors.length - 1}
                    onEdit={() => editFlavor(flavor)}
                    onDelete={() => requestDeleteFlavor(flavor)}
                    onMoveUp={() => moveFlavor(flavor, -1)}
                    onMoveDown={() => moveFlavor(flavor, 1)}
                  />
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <section class="rounded-box border border-base-content/5 bg-base-100 p-4">
      <div class="flex items-center justify-between gap-2">
        <h4 class="font-semibold">
          {editingFlavorId ? "Editar sabor" : "Crear sabor"}
        </h4>
        <button
          class="btn btn-xs btn-outline"
          type="button"
          onclick={openCreateFlavorModal}
          disabled={busy || formBusy}>Nuevo</button
        >
      </div>

      <form class="mt-4 grid items-start gap-3" onsubmit={submitFlavor}>
        <div class="form-control">
          <span class="label-text text-xs mb-1">Nombre</span>
          <input
            class="input input-bordered input-sm w-full"
            placeholder="Vainilla"
            bind:value={flavorForm.name}
            required
          />
        </div>
        <label
          class="flex items-center justify-between gap-3 rounded-lg border border-base-300/70 px-3 py-2 cursor-pointer"
        >
          <span class="label-text text-sm">Sabor de temporada</span>
          <input
            type="checkbox"
            bind:checked={flavorForm.is_seasonal}
            class="checkbox checkbox-sm"
          />
        </label>
        {#if editingFlavorId}
          <label
            class="flex items-center justify-between gap-3 rounded-lg border border-base-300/70 px-3 py-2 cursor-pointer"
          >
            <span class="label-text text-sm">Activo</span>
            <input
              type="checkbox"
              bind:checked={flavorForm.is_active}
              class="checkbox checkbox-sm"
            />
          </label>
        {/if}

        <AdminFormActions
          submitLabel={editingFlavorId ? "Actualizar" : "Crear"}
          cancelLabel="Limpiar"
          onCancel={resetFlavorForm}
          busy={busy || formBusy}
          disabled={!flavorForm.name.trim()}
        />
      </form>
    </section>
  </div>
</AdminModalShell>

<ConfirmDialog
  open={confirmDialog.open}
  title={confirmDialog.title}
  message={confirmDialog.message}
  busy={busy || formBusy}
  variant="error"
  onConfirm={() => confirmDialogNow(confirmDialog)}
  onCancel={() => closeConfirmDialog(confirmDialog)}
/>
