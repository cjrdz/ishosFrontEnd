<script lang="ts">
  import type { Flavor } from "../../../../lib/api/admin";
  import { sortByDisplayOrderAndName } from "../../../../lib/admin/addon-groups";

  interface Props {
    open: boolean;
    flavors: Flavor[];
    busy: boolean;
    error: string;
    onClose: () => void;
    onCreate: (payload: {
      name: string;
      display_order: number;
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
      const payload = {
        name: flavorForm.name.trim(),
        display_order: Number(flavorForm.display_order),
        is_seasonal: Boolean(flavorForm.is_seasonal),
        is_active: Boolean(flavorForm.is_active),
      };

      if (flavorForm.id) {
        await onUpdate(flavorForm.id, payload);
      } else {
        await onCreate({
          name: payload.name,
          display_order: payload.display_order,
          is_seasonal: payload.is_seasonal,
        });
      }

      resetFlavorForm();
    } finally {
      formBusy = false;
    }
  }

  async function requestDeleteFlavor(flavor: Flavor) {
    if (!confirm(`Seguro que deseas eliminar ${flavor.name}?`)) return;
    await onDelete(flavor.id);
  }
</script>

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div class="modal-box w-11/12 max-w-6xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 class="font-bold text-lg">Sabores globales</h3>
        <p class="text-sm text-base-content/70">
          Gestiona sabores disponibles para enlazar a productos.
        </p>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" onclick={onClose}
        >Cerrar</button
      >
    </div>

    {#if error}
      <div class="alert alert-warning mt-3"><span>{error}</span></div>
    {/if}

    <div class="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] mt-4">
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
                  <td class="text-center">{flavor.display_order}</td>
                  <td class="text-center">
                    {#if flavor.is_seasonal}
                      <span class="badge badge-warning badge-sm">Temporada</span
                      >
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
                    <div class="flex justify-center gap-2">
                      <button
                        class="btn btn-xs btn-soft btn-accent"
                        type="button"
                        onclick={() => editFlavor(flavor)}
                        disabled={busy || formBusy}>Editar</button
                      >
                      <button
                        class="btn btn-xs btn-soft btn-error"
                        type="button"
                        onclick={() => requestDeleteFlavor(flavor)}
                        disabled={busy || formBusy}>Eliminar</button
                      >
                    </div>
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

        <form class="mt-4 grid items-start gap-4" onsubmit={submitFlavor}>
          <div class="form-control w-full">
            <span class="label-text mb-1">Nombre</span>
            <input
              class="input input-bordered w-full"
              placeholder="Vainilla"
              bind:value={flavorForm.name}
              required
            />
          </div>
          <div class="form-control w-full">
            <span class="label-text mb-1">Orden de visualizacion</span>
            <input
              type="number"
              class="input input-bordered w-full"
              placeholder="0"
              bind:value={flavorForm.display_order}
            />
          </div>
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">Sabor de temporada</span>
              <input
                type="checkbox"
                bind:checked={flavorForm.is_seasonal}
                class="checkbox"
              />
            </label>
          </div>
          {#if editingFlavorId}
            <div class="form-control">
              <label class="label cursor-pointer">
                <span class="label-text">Activo</span>
                <input
                  type="checkbox"
                  bind:checked={flavorForm.is_active}
                  class="checkbox"
                />
              </label>
            </div>
          {/if}

          <div class="pt-1 flex gap-2">
            <button
              type="submit"
              class="btn btn-primary"
              disabled={busy || formBusy || !flavorForm.name.trim()}
            >
              {editingFlavorId ? "Actualizar" : "Crear"}
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              onclick={resetFlavorForm}
              disabled={busy || formBusy}>Limpiar</button
            >
          </div>
        </form>
      </section>
    </div>
  </div>
</dialog>
