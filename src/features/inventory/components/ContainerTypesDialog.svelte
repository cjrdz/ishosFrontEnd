<script lang="ts">
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
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

<AdminModalShell
  bind:dialogRef
  title="Tipos de Recipiente"
  icon="lucide:box"
  widthClass="max-w-2xl"
  {onClose}
>
  <div class="space-y-4">
    <!-- Form -->
    <form
      class="space-y-2 rounded-lg border border-base-300/70 p-3"
      onsubmit={handleSubmit}
    >
      <div class="form-control">
        <span class="label-text text-xs mb-1">Nombre</span>
        <input
          type="text"
          class="input input-bordered input-sm w-full"
          placeholder="Ej: Mediano"
          bind:value={form.name}
        />
      </div>
      <div class="form-control">
        <span class="label-text text-xs mb-1">Bolas por recipiente</span>
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
      <AdminFormActions
        submitLabel={editingId ? "Actualizar" : "Crear"}
        onCancel={editingId ? resetForm : onClose}
        disabled={!canSubmit}
      />
    </form>

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
</AdminModalShell>
