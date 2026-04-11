<script lang="ts">
  export interface PanelConfigValues {
    auth_cookie_ttl_hours: number;
    auth_token_ttl_hours: number;
    tracking_token_ttl_hours: number;
  }

  interface Props {
    tabOrder: string[];
    panelConfig: PanelConfigValues;
    busy: boolean;
    moduleError: string;
    onSave: (tabOrder: string[]) => void;
    onSavePanelConfig: (config: PanelConfigValues) => void;
  }

  const TAB_LABELS: Record<string, string> = {
    ordenes: "Ordenes",
    categorias: "Categorias",
    productos: "Productos",
    empleados: "Empleados",
    usuarios: "Usuarios",
    herramientas: "Herramientas",
  };

  let { tabOrder, panelConfig, busy, moduleError, onSave, onSavePanelConfig }: Props = $props();
  let localOrder = $state<string[]>([]);
  let localPanelConfig = $state<PanelConfigValues>({
    auth_cookie_ttl_hours: 24,
    auth_token_ttl_hours: 168,
    tracking_token_ttl_hours: 720,
  });

  $effect(() => {
    localOrder = [...tabOrder];
  });

  $effect(() => {
    localPanelConfig = {
      auth_cookie_ttl_hours: panelConfig.auth_cookie_ttl_hours,
      auth_token_ttl_hours: panelConfig.auth_token_ttl_hours,
      tracking_token_ttl_hours: panelConfig.tracking_token_ttl_hours,
    };
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

  function handleSavePanelConfig() {
    onSavePanelConfig({
      auth_cookie_ttl_hours: normalizeHours(localPanelConfig.auth_cookie_ttl_hours, panelConfig.auth_cookie_ttl_hours),
      auth_token_ttl_hours: normalizeHours(localPanelConfig.auth_token_ttl_hours, panelConfig.auth_token_ttl_hours),
      tracking_token_ttl_hours: normalizeHours(localPanelConfig.tracking_token_ttl_hours, panelConfig.tracking_token_ttl_hours),
    });
  }

  function normalizeHours(value: number, fallback: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return fallback;
    }

    return Math.round(value);
  }
</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <div class="card bg-base-100 shadow">
    <div class="card-body space-y-4">
      <div>
        <h2 class="card-title">Panel de configuracion</h2>
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

  <div class="card bg-base-100 shadow">
    <div class="card-body space-y-4">
      <div>
        <h2 class="card-title">Expiracion de tokens</h2>
        <p class="text-sm text-base-content/70">Configura en horas la duracion para login y seguimiento publico de ordenes.</p>
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <label class="form-control">
          <span class="label-text font-semibold">Cookie de sesion (horas)</span>
          <input
            class="input input-bordered"
            type="number"
            min="1"
            step="1"
            bind:value={localPanelConfig.auth_cookie_ttl_hours}
            disabled={busy}
          />
          <span class="label-text-alt text-base-content/60">Usado por el backend para cookie HttpOnly.</span>
        </label>

        <label class="form-control">
          <span class="label-text font-semibold">Token de login (horas)</span>
          <input
            class="input input-bordered"
            type="number"
            min="1"
            step="1"
            bind:value={localPanelConfig.auth_token_ttl_hours}
            disabled={busy}
          />
          <span class="label-text-alt text-base-content/60">JWT de empleados para iniciar sesion.</span>
        </label>

        <label class="form-control">
          <span class="label-text font-semibold">Token de seguimiento (horas)</span>
          <input
            class="input input-bordered"
            type="number"
            min="1"
            step="1"
            bind:value={localPanelConfig.tracking_token_ttl_hours}
            disabled={busy}
          />
          <span class="label-text-alt text-base-content/60">Token publico para rastreo de ordenes.</span>
        </label>
      </div>

      <div class="flex justify-end">
        <button class="btn btn-primary" type="button" onclick={handleSavePanelConfig} disabled={busy}>Guardar expiraciones</button>
      </div>
    </div>
  </div>
</section>
