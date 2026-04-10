<script lang="ts">
  interface Props {
    tabOrder: string[];
    busy: boolean;
    moduleError: string;
    onSave: (tabOrder: string[]) => void;
  }

  const TAB_LABELS: Record<string, string> = {
    ordenes: "Ordenes",
    categorias: "Categorias",
    productos: "Productos",
    empleados: "Empleados",
    usuarios: "Usuarios",
    herramientas: "Herramientas",
  };

  let { tabOrder, busy, moduleError, onSave }: Props = $props();
  let localOrder = $state<string[]>([]);

  $effect(() => {
    localOrder = [...tabOrder];
  });

  function moveUp(index: number) {
    if (index <= 0) return;
    const clone = [...localOrder];
    const current = clone[index];
    clone[index] = clone[index - 1];
    clone[index - 1] = current;
    localOrder = clone;
  }

  function moveDown(index: number) {
    if (index >= localOrder.length - 1) return;
    const clone = [...localOrder];
    const current = clone[index];
    clone[index] = clone[index + 1];
    clone[index + 1] = current;
    localOrder = clone;
  }

  function handleSave() {
    onSave(localOrder);
  }
</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <div class="card bg-base-100 shadow">
    <div class="card-body space-y-4">
      <div>
        <h2 class="card-title">Configuracion del panel</h2>
        <p class="text-sm text-base-content/70">Reordena las pestanas globales del panel administrativo.</p>
      </div>

      <div class="rounded-xl border border-base-300 bg-base-50 p-4 space-y-2">
        {#each localOrder as tab, index}
          <div class="flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-100 px-3 py-2">
            <span class="font-medium">{TAB_LABELS[tab] ?? tab}</span>
            <div class="flex gap-2">
              <button class="btn btn-sm" type="button" onclick={() => moveUp(index)} disabled={busy || index === 0}>Subir</button>
              <button class="btn btn-sm" type="button" onclick={() => moveDown(index)} disabled={busy || index === localOrder.length - 1}>Bajar</button>
            </div>
          </div>
        {/each}
      </div>

      <div class="flex justify-end">
        <button class="btn btn-primary" type="button" onclick={handleSave} disabled={busy}>Guardar orden global</button>
      </div>
    </div>
  </div>
</section>
