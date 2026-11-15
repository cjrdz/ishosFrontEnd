<script lang="ts">
  /**
   * Admin switch for the public "Seguir mi orden" page. It stays off while
   * only staff test ordering; turning it on shows the menu link, the tracking
   * page and the link after an online order.
   */
  import { onMount } from "svelte";
  import { showToast } from "@shared/toast/toast";
  import {
    getAdminStoreSettings,
    setPublicTracking,
  } from "@features/admin-management/lib/bff";

  let enabled = $state(false);
  let loading = $state(true);
  let saving = $state(false);
  let loadError = $state(false);

  onMount(async () => {
    try {
      enabled = Boolean((await getAdminStoreSettings()).tracking_enabled);
    } catch {
      loadError = true;
    } finally {
      loading = false;
    }
  });

  async function change(next: boolean) {
    const previous = enabled;
    enabled = next;
    saving = true;
    try {
      const saved = await setPublicTracking(next);
      enabled = Boolean(saved.tracking_enabled);
      showToast(
        enabled
          ? "«Seguir mi orden» visible en la tienda"
          : "«Seguir mi orden» oculto en la tienda",
        { tone: "success" },
      );
    } catch (error) {
      enabled = previous;
      showToast(
        error instanceof Error
          ? error.message
          : "No se pudo guardar. Intenta de nuevo.",
        { tone: "error" },
      );
    } finally {
      saving = false;
    }
  }
</script>

<label
  class="flex items-start justify-between gap-3 rounded-lg border border-base-300 p-3"
>
  <span>
    <span class="block font-medium">Seguimiento de órdenes en la tienda</span>
    <span class="block text-sm text-ink-muted">
      {#if loadError}
        No se pudo cargar este ajuste. Recarga la página.
      {:else}
        Muestra «Seguir mi orden» a los clientes. Déjalo apagado mientras solo
        el equipo prueba las órdenes.
      {/if}
    </span>
  </span>
  <input
    type="checkbox"
    class="toggle toggle-success"
    checked={enabled}
    disabled={loading || saving || loadError}
    aria-busy={saving}
    onchange={(e) => void change((e.currentTarget as HTMLInputElement).checked)}
  />
</label>
