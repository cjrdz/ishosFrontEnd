<script lang="ts">
  /** Header chip: "Abierto · cierra 9:00 pm" / "Cerrado". Refreshes each minute. */
  import { onMount } from "svelte";
  import {
    fetchStoreSettings,
    type StorePublicSettings,
  } from "@features/catalog/lib/api";
  import {
    describeStoreStatus,
    type StoreStatus,
  } from "@features/catalog/lib/store-status";

  let status = $state<StoreStatus | null>(null);
  let settings: StorePublicSettings | null = null;

  async function refresh(fresh = false) {
    try {
      settings = await fetchStoreSettings({ fresh });
    } catch {
      return; // keep the last known status; ordering still works server-side
    }
    status = describeStoreStatus(settings);
  }

  onMount(() => {
    void refresh();
    // Re-evaluate the label every minute ("cierra pronto"), refetch every 5.
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      if (ticks % 5 === 0) void refresh(true);
      else if (settings) status = describeStoreStatus(settings);
    }, 60_000);
    return () => clearInterval(timer);
  });
</script>

{#if status?.label}
  <span
    class={`store-status store-status--${status.tone}`}
    title={status.detail ?? status.label}
  >
    <span class="dot" aria-hidden="true"></span>{status.label}
  </span>
{/if}

<style>
  .store-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    white-space: nowrap;
    background: color-mix(in oklab, var(--color-success) 14%, transparent);
    color: color-mix(
      in oklab,
      var(--color-success) 80%,
      var(--color-base-content)
    );
  }
  .store-status--closing {
    background: color-mix(in oklab, var(--color-warning) 30%, transparent);
    color: var(--color-warning-content);
  }
  .store-status--closed {
    background: var(--color-base-300);
    color: var(--color-base-content);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: currentColor;
  }
</style>
