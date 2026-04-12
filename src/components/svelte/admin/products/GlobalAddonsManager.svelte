<script lang="ts">
  import type { Addon } from "../../../../lib/api/admin";
  import {
    DEFAULT_ADDON_GROUP_NAME,
    addonGroupLabel,
    normalizeAddonGroupName,
    sortByDisplayOrderAndName,
  } from "../../../../lib/admin/addon-groups";
  import { formatCurrency } from "../../../../lib/utils/formatters";

  interface Props {
    open: boolean;
    addons: Addon[];
    busy: boolean;
    error: string;
    onClose: () => void;
    onCreate: (payload: {
      name: string;
      price: number;
      group_name: string;
      display_order: number;
    }) => void | Promise<void>;
    onUpdate: (
      id: string,
      payload: {
        name: string;
        price: number;
        group_name: string;
        display_order: number;
        is_active: boolean;
      },
    ) => void | Promise<void>;
    onDelete: (id: string) => void | Promise<void>;
  }

  let { open, addons, busy, error, onClose, onCreate, onUpdate, onDelete }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let editingAddonId = $state<string | null>(null);
  let formBusy = $state(false);
  let addonForm = $state({
    id: "",
    name: "",
    price: 0,
    group_name: DEFAULT_ADDON_GROUP_NAME,
    display_order: 0,
    is_active: true,
  });

  const sortedAddons = $derived(
    addons.slice().sort((left, right) => {
      const leftGroup = normalizeAddonGroupName(left.group_name);
      const rightGroup = normalizeAddonGroupName(right.group_name);
      return leftGroup.localeCompare(rightGroup) || sortByDisplayOrderAndName(left, right);
    }),
  );

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

  function resetAddonForm() {
    editingAddonId = null;
    addonForm = {
      id: "",
      name: "",
      price: 0,
      group_name: DEFAULT_ADDON_GROUP_NAME,
      display_order: 0,
      is_active: true,
    };
  }

  function openCreateAddonModal() {
    resetAddonForm();
  }

  function editAddon(addon: Addon) {
    editingAddonId = addon.id;
    addonForm = {
      id: addon.id,
      name: addon.name,
      price: addon.price,
      group_name: normalizeAddonGroupName(addon.group_name),
      display_order: addon.display_order,
      is_active: addon.is_active,
    };
  }

  async function submitAddon(event: SubmitEvent) {
    event.preventDefault();
    formBusy = true;
    try {
      const payload = {
        name: addonForm.name.trim(),
        price: Number(addonForm.price),
        group_name: normalizeAddonGroupName(addonForm.group_name),
        display_order: Number(addonForm.display_order),
        is_active: Boolean(addonForm.is_active),
      };

      if (addonForm.id) {
        await onUpdate(addonForm.id, payload);
      } else {
        await onCreate({
          name: payload.name,
          price: payload.price,
          group_name: payload.group_name,
          display_order: payload.display_order,
        });
      }

      resetAddonForm();
    } finally {
      formBusy = false;
    }
  }

  async function requestDeleteAddon(addon: Addon) {
    if (!confirm(`Seguro que deseas eliminar ${addon.name}?`)) return;
    await onDelete(addon.id);
  }
</script>

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div class="modal-box w-11/12 max-w-6xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 class="font-bold text-lg">Complementos globales</h3>
        <p class="text-sm text-base-content/70">Gestiona toppings, jalea y extras disponibles para productos.</p>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" onclick={onClose}>Cerrar</button>
    </div>

    {#if error}
      <div class="alert alert-warning mt-3"><span>{error}</span></div>
    {/if}

    <div class="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] mt-4">
      <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
        <table class="table table-sm">
          <thead class="bg-base-200/60 text-base-content">
            <tr>
              <th class="font-bold">Nombre</th>
              <th class="text-center font-bold">Grupo</th>
              <th class="text-center font-bold">Precio</th>
              <th class="text-center font-bold">Estado</th>
              <th class="text-center font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#if sortedAddons.length === 0}
              <tr><td colspan="5" class="text-center">No hay complementos</td></tr>
            {:else}
              {#each sortedAddons as addon}
                <tr>
                  <td>{addon.name}</td>
                  <td class="text-center">{addonGroupLabel(addon.group_name)}</td>
                  <td class="text-center">{formatCurrency(addon.price)}</td>
                  <td class="text-center">
                    <span class={`badge badge-sm ${addon.is_active ? "badge-success" : "badge-ghost"}`}>{addon.is_active ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td class="text-center">
                    <div class="flex justify-center gap-2">
                      <button class="btn btn-xs btn-soft btn-accent" type="button" onclick={() => editAddon(addon)} disabled={busy || formBusy}>Editar</button>
                      <button class="btn btn-xs btn-soft btn-error" type="button" onclick={() => requestDeleteAddon(addon)} disabled={busy || formBusy}>Eliminar</button>
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
          <h4 class="font-semibold">{editingAddonId ? "Editar complemento" : "Crear complemento"}</h4>
          <button class="btn btn-xs btn-outline" type="button" onclick={openCreateAddonModal} disabled={busy || formBusy}>Nuevo</button>
        </div>

        <form class="mt-4 grid items-start gap-4" onsubmit={submitAddon}>
          <div class="form-control w-full">
            <span class="label-text mb-1">Nombre</span>
            <input class="input input-bordered w-full" placeholder="Granola" bind:value={addonForm.name} required />
          </div>
          <div class="form-control w-full">
            <span class="label-text mb-1">Precio</span>
            <input type="number" class="input input-bordered w-full" min="0" step="0.01" bind:value={addonForm.price} required />
          </div>
          <div class="form-control w-full">
            <span class="label-text mb-1">Grupo</span>
            <input class="input input-bordered w-full" placeholder="extras" bind:value={addonForm.group_name} list="addon-groups-list" />
            <datalist id="addon-groups-list">
              <option value="toppings"></option>
              <option value="jalea"></option>
              <option value="extras"></option>
            </datalist>
          </div>
          <div class="form-control w-full">
            <span class="label-text mb-1">Orden de visualizacion</span>
            <input type="number" class="input input-bordered w-full" bind:value={addonForm.display_order} />
          </div>
          {#if editingAddonId}
            <div class="form-control">
              <label class="label cursor-pointer">
                <span class="label-text">Activo</span>
                <input type="checkbox" bind:checked={addonForm.is_active} class="checkbox" />
              </label>
            </div>
          {/if}

          <div class="pt-1 flex gap-2">
            <button type="submit" class="btn btn-primary" disabled={busy || formBusy || !addonForm.name.trim()}>
              {editingAddonId ? "Actualizar" : "Crear"}
            </button>
            <button type="button" class="btn btn-ghost" onclick={resetAddonForm} disabled={busy || formBusy}>Limpiar</button>
          </div>
        </form>
      </section>
    </div>
  </div>
</dialog>
