<script lang="ts">
  import type { Addon } from "@features/admin-management";
  import {
    addonGroupLabel,
    groupAddonsByGroup,
    normalizeAddonGroupName,
    sortByDisplayOrderAndName,
  } from "@features/products";
  import { formatCurrency } from "@shared/utils/formatters";
  import { toggleSelection } from "@shared/utils/collections";
  import {
    countInactiveAddons,
    filterActiveAddons,
    selectedIds,
    splitAddonAssignments,
  } from "../../lib/addon-assignment-helpers";

  interface Props {
    open: boolean;
    productName: string;
    allAddons: Addon[];
    assignedAddonIds: string[];
    busy: boolean;
    onClose: () => void;
    onAssignMany: (addonIds: string[]) => void | Promise<void>;
    onUnassignMany: (addonIds: string[]) => void | Promise<void>;
  }

  let {
    open,
    productName,
    allAddons,
    assignedAddonIds,
    busy,
    onClose,
    onAssignMany,
    onUnassignMany,
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let actionBusy = $state(false);
  let selectedAvailableAddonIds = $state<string[]>([]);
  let selectedAssignedAddonIds = $state<string[]>([]);

  const split = $derived(splitAddonAssignments(allAddons, assignedAddonIds));
  const availableActiveAddons = $derived(
    filterActiveAddons(split.available)
      .slice()
      .sort((left, right) => {
        const leftGroup = normalizeAddonGroupName(left.group_name);
        const rightGroup = normalizeAddonGroupName(right.group_name);
        return (
          leftGroup.localeCompare(rightGroup) ||
          sortByDisplayOrderAndName(left, right)
        );
      }),
  );
  const assignedAddons = $derived(
    split.assigned.slice().sort((left, right) => {
      const leftGroup = normalizeAddonGroupName(left.group_name);
      const rightGroup = normalizeAddonGroupName(right.group_name);
      return (
        leftGroup.localeCompare(rightGroup) ||
        sortByDisplayOrderAndName(left, right)
      );
    }),
  );
  const availableInactiveAddonsCount = $derived(
    countInactiveAddons(split.available),
  );
  const availableGroups = $derived(groupAddonsByGroup(availableActiveAddons));

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

  $effect(() => {
    if (!open) {
      selectedAvailableAddonIds = [];
      selectedAssignedAddonIds = [];
    }
  });

  async function moveSelectedAddonsToAssigned() {
    if (selectedAvailableAddonIds.length === 0) return;
    actionBusy = true;
    try {
      await onAssignMany(
        selectedIds(availableActiveAddons, selectedAvailableAddonIds),
      );
      selectedAvailableAddonIds = [];
    } finally {
      actionBusy = false;
    }
  }

  async function moveSelectedAddonsToAvailable() {
    if (selectedAssignedAddonIds.length === 0) return;
    actionBusy = true;
    try {
      await onUnassignMany(
        selectedIds(assignedAddons, selectedAssignedAddonIds),
      );
      selectedAssignedAddonIds = [];
    } finally {
      actionBusy = false;
    }
  }
</script>

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">Complementos: {productName}</h3>
      {#if availableInactiveAddonsCount > 0}
        <span class="badge badge-ghost"
          >{availableInactiveAddonsCount} inactivos no disponibles</span
        >
      {/if}
    </div>

    <div class="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr] items-start">
      <div class="space-y-2">
        <h4
          class="px-1 font-semibold text-sm uppercase tracking-wide text-base-content/70"
        >
          No asignados
        </h4>
        <section class="rounded-box bg-base-200/60 p-3">
          {#if availableActiveAddons.length === 0}
            <p
              class="flex min-h-[50vh] items-center justify-center text-sm text-base-content/70"
            >
              No hay complementos disponibles
            </p>
          {:else}
            <div class="max-h-[50vh] overflow-y-auto space-y-3">
              {#each availableGroups as group}
                <section class="space-y-2">
                  <h5
                    class="text-xs font-semibold uppercase tracking-wide text-base-content/70"
                  >
                    {group.label}
                  </h5>
                  <ul class="space-y-2">
                    {#each group.items as addon}
                      <li
                        class="flex items-center gap-2 rounded-lg bg-base-100 px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm"
                          checked={selectedAvailableAddonIds.includes(addon.id)}
                          onchange={() => {
                            selectedAvailableAddonIds = toggleSelection(
                              selectedAvailableAddonIds,
                              addon.id,
                            );
                          }}
                          disabled={busy || actionBusy}
                        />
                        <div class="flex-1 truncate">
                          {addon.name}
                          <span class="text-xs text-base-content/70 ml-2"
                            >{formatCurrency(addon.price)}</span
                          >
                        </div>
                        <span class="badge badge-outline badge-sm"
                          >{group.label}</span
                        >
                      </li>
                    {/each}
                  </ul>
                </section>
              {/each}
            </div>
          {/if}
        </section>
      </div>

      <section
        class="flex flex-col items-center justify-center gap-2 self-stretch"
      >
        <button
          class="btn btn-sm btn-primary"
          type="button"
          onclick={moveSelectedAddonsToAssigned}
          disabled={busy ||
            actionBusy ||
            selectedAvailableAddonIds.length === 0}
        >
          &gt;&gt;
        </button>
        <div class="divider md:divider-horizontal m-0"></div>
        <button
          class="btn btn-sm btn-outline"
          type="button"
          onclick={moveSelectedAddonsToAvailable}
          disabled={busy || actionBusy || selectedAssignedAddonIds.length === 0}
        >
          &lt;&lt;
        </button>
      </section>

      <div class="space-y-2">
        <h4
          class="px-1 font-semibold text-sm uppercase tracking-wide text-base-content/70"
        >
          Asignados
        </h4>
        <section class="rounded-box bg-base-200/60 p-3">
          {#if assignedAddons.length === 0}
            <p
              class="flex min-h-[50vh] items-center justify-center text-sm text-base-content/70"
            >
              No hay complementos asignados
            </p>
          {:else}
            <ul class="space-y-2 max-h-[50vh] overflow-y-auto">
              {#each assignedAddons as addon}
                <li
                  class="flex items-center gap-2 rounded-lg bg-base-100 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={selectedAssignedAddonIds.includes(addon.id)}
                    onchange={() => {
                      selectedAssignedAddonIds = toggleSelection(
                        selectedAssignedAddonIds,
                        addon.id,
                      );
                    }}
                    disabled={busy || actionBusy}
                  />
                  <div class="flex-1 truncate">
                    {addon.name}
                    <span class="text-xs text-base-content/70 ml-2"
                      >{formatCurrency(addon.price)}</span
                    >
                  </div>
                  <span class="badge badge-outline badge-sm"
                    >{addonGroupLabel(addon.group_name)}</span
                  >
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </div>
    </div>

    <div class="modal-action mt-5">
      <button type="button" class="btn btn-ghost" onclick={onClose}
        >Cerrar</button
      >
    </div>
  </div>
</dialog>
