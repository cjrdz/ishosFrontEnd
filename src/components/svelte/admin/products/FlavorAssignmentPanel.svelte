<script lang="ts">
  import type { Flavor } from "../../../../lib/api/admin";
  import { sortByDisplayOrderAndName } from "../../../../lib/admin/addon-groups";
  import { toggleSelection } from "../tabs/utils/list";
  import {
    countInactiveFlavors,
    filterActiveFlavors,
    selectedIds,
    splitFlavorAssignments,
  } from "../../../../lib/admin/products/flavor-assignment-helpers";

  interface Props {
    open: boolean;
    productName: string;
    allFlavors: Flavor[];
    assignedFlavorIds: string[];
    busy: boolean;
    onClose: () => void;
    onAssignMany: (flavorIds: string[]) => void | Promise<void>;
    onUnassignMany: (flavorIds: string[]) => void | Promise<void>;
  }

  let {
    open,
    productName,
    allFlavors,
    assignedFlavorIds,
    busy,
    onClose,
    onAssignMany,
    onUnassignMany,
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let actionBusy = $state(false);
  let selectedAvailableFlavorIds = $state<string[]>([]);
  let selectedAssignedFlavorIds = $state<string[]>([]);

  const split = $derived(splitFlavorAssignments(allFlavors, assignedFlavorIds));
  const availableActiveFlavors = $derived(
    filterActiveFlavors(split.available)
      .slice()
      .sort((left, right) => sortByDisplayOrderAndName(left, right)),
  );
  const assignedFlavors = $derived(
    split.assigned
      .slice()
      .sort((left, right) => sortByDisplayOrderAndName(left, right)),
  );
  const availableInactiveFlavorsCount = $derived(
    countInactiveFlavors(split.available),
  );

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
      selectedAvailableFlavorIds = [];
      selectedAssignedFlavorIds = [];
    }
  });

  async function moveSelectedFlavorsToAssigned() {
    if (selectedAvailableFlavorIds.length === 0) return;
    actionBusy = true;
    try {
      await onAssignMany(
        selectedIds(availableActiveFlavors, selectedAvailableFlavorIds),
      );
      selectedAvailableFlavorIds = [];
    } finally {
      actionBusy = false;
    }
  }

  async function moveSelectedFlavorsToAvailable() {
    if (selectedAssignedFlavorIds.length === 0) return;
    actionBusy = true;
    try {
      await onUnassignMany(
        selectedIds(assignedFlavors, selectedAssignedFlavorIds),
      );
      selectedAssignedFlavorIds = [];
    } finally {
      actionBusy = false;
    }
  }
</script>

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">Sabores: {productName}</h3>
      {#if availableInactiveFlavorsCount > 0}
        <span class="badge badge-ghost"
          >{availableInactiveFlavorsCount} inactivos no disponibles</span
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
          {#if availableActiveFlavors.length === 0}
            <p
              class="flex min-h-[50vh] items-center justify-center text-sm text-base-content/70"
            >
              No hay sabores disponibles
            </p>
          {:else}
            <ul class="space-y-2 max-h-[50vh] overflow-y-auto">
              {#each availableActiveFlavors as flavor}
                <li
                  class="flex items-center gap-2 rounded-lg bg-base-100 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={selectedAvailableFlavorIds.includes(flavor.id)}
                    onchange={() => {
                      selectedAvailableFlavorIds = toggleSelection(
                        selectedAvailableFlavorIds,
                        flavor.id,
                      );
                    }}
                    disabled={busy || actionBusy}
                  />
                  <div class="flex-1 truncate">{flavor.name}</div>
                  {#if flavor.is_seasonal}
                    <span class="badge badge-warning badge-sm">Temporada</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </div>

      <section
        class="flex flex-col items-center justify-center gap-2 self-stretch"
      >
        <button
          class="btn btn-sm btn-primary"
          type="button"
          onclick={moveSelectedFlavorsToAssigned}
          disabled={busy ||
            actionBusy ||
            selectedAvailableFlavorIds.length === 0}
        >
          &gt;&gt;
        </button>
        <div class="divider md:divider-horizontal m-0"></div>
        <button
          class="btn btn-sm btn-outline"
          type="button"
          onclick={moveSelectedFlavorsToAvailable}
          disabled={busy ||
            actionBusy ||
            selectedAssignedFlavorIds.length === 0}
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
          {#if assignedFlavors.length === 0}
            <p
              class="flex min-h-[50vh] items-center justify-center text-sm text-base-content/70"
            >
              No hay sabores asignados
            </p>
          {:else}
            <ul class="space-y-2 max-h-[50vh] overflow-y-auto">
              {#each assignedFlavors as flavor}
                <li
                  class="flex items-center gap-2 rounded-lg bg-base-100 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={selectedAssignedFlavorIds.includes(flavor.id)}
                    onchange={() => {
                      selectedAssignedFlavorIds = toggleSelection(
                        selectedAssignedFlavorIds,
                        flavor.id,
                      );
                    }}
                    disabled={busy || actionBusy}
                  />
                  <div class="flex-1 truncate">{flavor.name}</div>
                  {#if flavor.is_seasonal}
                    <span class="badge badge-warning badge-sm">Temporada</span>
                  {/if}
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
