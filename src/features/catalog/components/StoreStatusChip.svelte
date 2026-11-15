<script lang="ts">
  /**
   * Header chip summarising the locations: "Abierto", "2 de 3 abiertas" or
   * "Cerrado · abrimos 2:00 pm". Refreshes each minute.
   */
  import { onMount } from "svelte";
  import {
    fetchStoreLocations,
    type PublicLocation,
  } from "@features/catalog/lib/api";
  import { describeLocations } from "@features/catalog/lib/locations";
  import type { StoreStatus } from "@features/catalog/lib/store-status";

  let status = $state<StoreStatus | null>(null);
  let locations: PublicLocation[] = [];

  async function refresh(fresh = false) {
    try {
      locations = await fetchStoreLocations({ fresh });
    } catch {
      return; // keep the last known status
    }
    status = describeLocations(locations);
  }

  onMount(() => {
    void refresh();
    // Re-evaluate the label every minute, refetch every 5.
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      if (ticks % 5 === 0) void refresh(true);
      else if (locations.length) status = describeLocations(locations);
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
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 0.8125rem;
    font-weight: 700;
    white-space: nowrap;
    background: var(--st-ready);
    color: var(--st-ready-ink);
  }
  .store-status--closing {
    background: var(--st-review);
    color: var(--st-review-ink);
  }
  .store-status--closed {
    background: var(--st-done);
    color: var(--st-done-ink);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: currentColor;
  }
</style>
