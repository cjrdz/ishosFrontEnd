<script lang="ts">
  /**
   * Weekly opening hours from the schedule admins edit in Settings, so the
   * home and About pages never disagree with what the store enforces.
   */
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import {
    fetchStoreSettings,
    type StorePublicSettings,
  } from "@features/catalog/lib/api";
  import {
    describeStoreStatus,
    scheduleRows,
  } from "@features/catalog/lib/store-status";

  interface Props {
    headingLevel?: "h2" | "h3";
  }
  let { headingLevel = "h2" }: Props = $props();

  let settings = $state<StorePublicSettings | null>(null);
  let loaded = $state(false);
  let now = $state(new Date());

  const schedule = $derived(scheduleRows(settings?.hours, now));
  const status = $derived(describeStoreStatus(settings, now));

  onMount(() => {
    fetchStoreSettings()
      .then((value) => (settings = value))
      .catch(() => (settings = null))
      .finally(() => (loaded = true));
    const timer = setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(timer);
  });
</script>

<div class="h-full rounded-box border border-base-300 bg-base-100 p-5 md:p-6">
  <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
    <div class="flex items-center gap-2">
      <Icon
        icon="lucide:clock"
        class="size-5 text-primary"
        aria-hidden="true"
      />
      <svelte:element this={headingLevel} class="text-lg font-bold"
        >Horario</svelte:element
      >
    </div>
    {#if loaded && status.label}
      <span
        class={`badge border-0 ${status.tone === "open" ? "bg-success/15 text-success" : status.tone === "closing" ? "bg-warning/25 text-base-content" : "bg-base-200 text-base-content/80"}`}
      >
        {status.label}
      </span>
    {/if}
  </div>

  {#if !loaded}
    <div class="space-y-2" aria-hidden="true">
      {#each Array.from({ length: 7 }) as _, i (i)}
        <div class="skeleton h-5 w-full"></div>
      {/each}
    </div>
  {:else if schedule.length > 0}
    <dl class="divide-y divide-base-300">
      {#each schedule as row (row.key)}
        <div
          class="flex justify-between gap-4 py-2 text-sm"
          class:font-semibold={row.isToday}
        >
          <dt>{row.label}{row.isToday ? " (hoy)" : ""}</dt>
          <dd
            class={`text-right ${row.isToday ? "text-base-content" : "text-base-content/75"}`}
          >
            {row.hours}
          </dd>
        </div>
      {/each}
    </dl>
  {:else}
    <p class="text-base-content/75">
      Atendemos pedidos en línea mientras la tienda esté abierta. Escríbenos por
      <a
        href="https://wa.me/50376454347"
        class="link text-primary"
        rel="noopener noreferrer"
        target="_blank">WhatsApp</a
      >
      para confirmar el horario de hoy.
    </p>
  {/if}
</div>
