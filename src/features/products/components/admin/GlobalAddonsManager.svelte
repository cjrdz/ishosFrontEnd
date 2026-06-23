<script lang="ts">
  import type { Addon } from "@features/admin-management";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import {
    addonGroupLabel,
    collectAddonGroupOptions,
    PRIMARY_ADDON_GROUPS,
    normalizeAddonGroupName,
    sortByDisplayOrderAndName,
  } from "@features/products";
  import { formatCurrency } from "@shared/utils/formatters";

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

  type AddonFormState = {
    id: string;
    name: string;
    price: number;
    group_name: string;
    display_order: number;
    is_active: boolean;
  };

  let {
    open,
    addons,
    busy,
    error,
    onClose,
    onCreate,
    onUpdate,
    onDelete,
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let editingAddonId = $state<string | null>(null);
  let formBusy = $state(false);
  let customGroups = $state<string[]>([]);
  let customGroupName = $state("");
  let selectingCustomGroup = $state(false);
  let addonForm = $state<AddonFormState>({
    id: "",
    name: "",
    price: 0,
    group_name: PRIMARY_ADDON_GROUPS[0],
    display_order: 0,
    is_active: true,
  });

  const CUSTOM_GROUP_OPTION = "__custom_group__";

  const sortedAddons = $derived(
    addons.slice().sort((left, right) => {
      const leftGroup = normalizeAddonGroupName(left.group_name);
      const rightGroup = normalizeAddonGroupName(right.group_name);
      return (
        leftGroup.localeCompare(rightGroup) ||
        sortByDisplayOrderAndName(left, right)
      );
    }),
  );
  const addonGroupOptions = $derived(
    collectAddonGroupOptions(addons, customGroups),
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
    selectingCustomGroup = false;
    customGroupName = "";
    addonForm = {
      id: "",
      name: "",
      price: 0,
      group_name: PRIMARY_ADDON_GROUPS[0],
      display_order: 0,
      is_active: true,
    };
  }

  function openCreateAddonModal() {
    resetAddonForm();
  }

  function editAddon(addon: Addon) {
    editingAddonId = addon.id;
    selectingCustomGroup = false;
    customGroupName = "";
    addonForm = {
      id: addon.id,
      name: addon.name,
      price: addon.price,
      group_name: normalizeAddonGroupName(addon.group_name),
      display_order: addon.display_order,
      is_active: addon.is_active,
    };
  }

  function normalizeCustomGroupValue(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return normalizeAddonGroupName(trimmed);
  }

  function selectAddonGroup(event: Event) {
    const selected = (event.currentTarget as HTMLSelectElement).value;
    if (selected === CUSTOM_GROUP_OPTION) {
      selectingCustomGroup = true;
      return;
    }

    selectingCustomGroup = false;
    customGroupName = "";
    addonForm.group_name = selected;
  }

  function addCustomGroup() {
    const normalized = normalizeCustomGroupValue(customGroupName);
    if (!normalized) {
      return;
    }

    if (!addonGroupOptions.includes(normalized)) {
      customGroups = [...customGroups, normalized];
    }

    addonForm.group_name = normalized;
    selectingCustomGroup = false;
    customGroupName = "";
  }

  function applyPendingCustomGroup() {
    if (!selectingCustomGroup) {
      return;
    }

    addCustomGroup();
  }

  async function submitAddon(event: SubmitEvent) {
    event.preventDefault();
    formBusy = true;
    try {
      applyPendingCustomGroup();
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

<AdminModalShell
  bind:dialogRef
  title="Complementos globales"
  icon="lucide:puzzle"
  widthClass="max-w-6xl"
  {onClose}
>
  <p class="text-sm text-base-content/70">
    Gestiona toppings, jalea y extras disponibles para productos.
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
            <th class="text-center font-bold">Grupo</th>
            <th class="text-center font-bold">Precio</th>
            <th class="text-center font-bold">Estado</th>
            <th class="text-center font-bold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {#if sortedAddons.length === 0}
            <tr><td colspan="5" class="text-center">No hay complementos</td></tr
            >
          {:else}
            {#each sortedAddons as addon}
              <tr>
                <td>{addon.name}</td>
                <td class="text-center">{addonGroupLabel(addon.group_name)}</td>
                <td class="text-center">{formatCurrency(addon.price)}</td>
                <td class="text-center">
                  <span
                    class={`badge badge-sm ${addon.is_active ? "badge-success" : "badge-ghost"}`}
                    >{addon.is_active ? "Activo" : "Inactivo"}</span
                  >
                </td>
                <td class="text-center">
                  <div class="flex justify-center gap-2">
                    <button
                      class="btn btn-xs btn-soft btn-accent"
                      type="button"
                      onclick={() => editAddon(addon)}
                      disabled={busy || formBusy}>Editar</button
                    >
                    <button
                      class="btn btn-xs btn-soft btn-error"
                      type="button"
                      onclick={() => requestDeleteAddon(addon)}
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
          {editingAddonId ? "Editar complemento" : "Crear complemento"}
        </h4>
        <button
          class="btn btn-xs btn-outline"
          type="button"
          onclick={openCreateAddonModal}
          disabled={busy || formBusy}>Nuevo</button
        >
      </div>

      <form class="mt-4 grid items-start gap-3" onsubmit={submitAddon}>
        <div class="form-control">
          <span class="label-text text-xs mb-1">Nombre</span>
          <input
            class="input input-bordered input-sm w-full"
            placeholder="Granola"
            bind:value={addonForm.name}
            required
          />
        </div>
        <div class="form-control">
          <span class="label-text text-xs mb-1">Precio</span>
          <input
            type="number"
            class="input input-bordered input-sm w-full"
            min="0"
            step="0.01"
            bind:value={addonForm.price}
            required
          />
        </div>
        <div class="form-control">
          <span class="label-text text-xs mb-1">Grupo</span>
          <select
            class="select select-bordered select-sm w-full"
            value={selectingCustomGroup
              ? CUSTOM_GROUP_OPTION
              : normalizeAddonGroupName(addonForm.group_name)}
            onchange={selectAddonGroup}
          >
            {#each addonGroupOptions as groupName}
              <option value={groupName}>{addonGroupLabel(groupName)}</option>
            {/each}
            <option value={CUSTOM_GROUP_OPTION}>+ Agregar nuevo grupo</option>
          </select>

          {#if selectingCustomGroup}
            <div class="mt-2 flex items-center gap-2">
              <input
                class="input input-bordered input-sm w-full"
                placeholder="Ej. Frutas"
                bind:value={customGroupName}
              />
              <button
                type="button"
                class="btn btn-outline btn-sm"
                onclick={addCustomGroup}
                disabled={!customGroupName.trim()}
              >
                Agregar
              </button>
            </div>
          {/if}
        </div>
        <div class="form-control">
          <span class="label-text text-xs mb-1">Orden de visualizacion</span>
          <input
            type="number"
            class="input input-bordered input-sm w-full"
            bind:value={addonForm.display_order}
          />
        </div>
        {#if editingAddonId}
          <label
            class="flex items-center justify-between gap-3 rounded-lg border border-base-300/70 px-3 py-2 cursor-pointer"
          >
            <span class="label-text text-sm">Activo</span>
            <input
              type="checkbox"
              bind:checked={addonForm.is_active}
              class="checkbox checkbox-sm"
            />
          </label>
        {/if}

        <AdminFormActions
          submitLabel={editingAddonId ? "Actualizar" : "Crear"}
          cancelLabel="Limpiar"
          onCancel={resetAddonForm}
          busy={busy || formBusy}
          disabled={!addonForm.name.trim()}
        />
      </form>
    </section>
  </div>
</AdminModalShell>
