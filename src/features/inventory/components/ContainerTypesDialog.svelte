<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import type { ContainerType } from "@features/admin-management/lib/bff";

  interface Props {
    open: boolean;
    containerTypes: ContainerType[];
    loading: boolean;
    onClose: () => void;
    onCreate: (payload: {
      name: string;
      balls_per_container: number;
      is_custom: boolean;
    }) => void;
    onUpdate: (
      id: string,
      payload: {
        name?: string;
        balls_per_container?: number;
        is_custom?: boolean;
      },
    ) => void;
    onDelete: (id: string) => void;
  }

  let {
    open,
    containerTypes,
    loading,
    onClose,
    onCreate,
    onUpdate,
    onDelete,
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let editingId = $state<string | null>(null);
  let form = $state({
    name: "",
    balls_per_container: 80,
    is_custom: false,
  });

  let canSubmit = $derived(
    form.name.trim() && (form.is_custom || form.balls_per_container > 0),
  );

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

  function resetForm() {
    editingId = null;
    form = { name: "", balls_per_container: 80, is_custom: false };
  }

  function startEdit(ct: ContainerType) {
    editingId = ct.id;
    form = {
      name: ct.name,
      balls_per_container: ct.balls_per_container,
      is_custom: ct.is_custom,
    };
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    if (editingId) {
      onUpdate(editingId, {
        name: form.name.trim(),
        balls_per_container: form.is_custom
          ? undefined
          : form.balls_per_container,
        is_custom: form.is_custom,
      });
    } else {
      onCreate({
        name: form.name.trim(),
        balls_per_container: form.balls_per_container,
        is_custom: form.is_custom,
      });
    }
    resetForm();
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este tipo de recipiente?")) return;
    onDelete(id);
  }
</script>

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div
    class="modal-box w-11/12 md:max-w-2xl max-h-[90vh] overflow-y-auto p-0 animate-scaleIn"
  >
    <div
      class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-base-200 bg-base-100 px-5 py-4"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10"
        >
          <Icon icon="lucide:box" width="16" height="16" class="text-info" />
        </div>
        <h3 class="font-bold text-base leading-tight">Tipos de Recipiente</h3>
      </div>
      <button
        class="btn btn-ghost btn-sm btn-circle"
        type="button"
        onclick={onClose}
        aria-label="Cerrar"
      >
        <Icon icon="lucide:x" width="16" height="16" />
      </button>
    </div>

    <div class="p-5 space-y-5">
      <!-- Form -->
      <div class="space-y-2 rounded-lg border border-base-300/70 p-3">
        <div class="form-control">
          <span class="label-text mb-1 text-sm">Nombre</span>
          <input
            type="text"
            class="input input-bordered input-sm w-full"
            placeholder="Ej: Mediano"
            bind:value={form.name}
          />
        </div>
        <div class="form-control">
          <span class="label-text mb-1 text-sm">Bolas por recipiente</span>
          <input
            type="number"
            class="input input-bordered input-sm w-full"
            placeholder="80"
            min="1"
            disabled={form.is_custom}
            bind:value={form.balls_per_container}
          />
        </div>
        <label class="label cursor-pointer justify-start gap-2 p-0">
          <input
            class="checkbox checkbox-sm"
            type="checkbox"
            bind:checked={form.is_custom}
          />
          <span class="label-text text-sm">Custom (capacidad variable)</span>
        </label>
        <div class="flex gap-2 pt-1">
          <button
            class="btn btn-primary btn-sm"
            onclick={handleSubmit}
            disabled={!canSubmit}
          >
            {editingId ? "Actualizar" : "Crear"}
          </button>
          {#if editingId}
            <button class="btn btn-ghost btn-sm" onclick={resetForm}>
              Cancelar
            </button>
          {/if}
        </div>
      </div>

      <!-- List -->
      {#if loading}
        <div class="text-center py-4">
          <span class="loading loading-spinner loading-sm"></span>
        </div>
      {:else if containerTypes.length > 0}
        <div
          class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
        >
          <table class="table table-sm">
            <thead class="bg-base-200/60 text-base-content">
              <tr>
                <th class="font-bold">Nombre</th>
                <th class="text-right font-bold">Bolas</th>
                <th class="font-bold">Tipo</th>
                <th class="text-right font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#each containerTypes as ct (ct.id)}
                <tr>
                  <td class="font-medium">{ct.name}</td>
                  <td class="text-right font-mono">{ct.balls_per_container}</td>
                  <td>
                    {#if ct.is_custom}
                      <span class="badge badge-sm badge-warning">Custom</span>
                    {:else}
                      <span class="badge badge-sm badge-info">Fijo</span>
                    {/if}
                  </td>
                  <td class="text-right">
                    <div class="flex justify-end gap-1">
                      <button
                        class="btn btn-xs btn-soft btn-accent"
                        onclick={() => startEdit(ct)}
                      >
                        Editar
                      </button>
                      <button
                        class="btn btn-xs btn-soft btn-error"
                        onclick={() => handleDelete(ct.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="text-center py-4 text-base-content/50">
          No hay tipos de recipiente registrados
        </div>
      {/if}
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={onClose}>close</button>
  </form>
</dialog>

<style>
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  .animate-scaleIn {
    animation: scaleIn 0.2s ease-out;
  }
</style>
