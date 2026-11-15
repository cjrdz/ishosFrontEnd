<script lang="ts">
  /**
   * Opening hours of the locations, from the schedules admins edit in
   * Settings, so the home and About pages never disagree with the shops.
   * Locations sharing one schedule are shown as a single table.
   */
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import {
    fetchStoreLocations,
    type PublicLocation,
  } from "@features/catalog/lib/api";
  import { scheduleRows } from "@features/catalog/lib/store-status";
  import {
    DEFAULT_WHATSAPP,
    describeLocations,
    sharesOneSchedule,
    whatsappLink,
  } from "@features/catalog/lib/locations";

  interface Props {
    headingLevel?: "h2" | "h3";
  }
  let { headingLevel = "h2" }: Props = $props();

  let locations = $state<PublicLocation[]>([]);
  let loaded = $state(false);
  let now = $state(new Date());

  const status = $derived(describeLocations(locations, now));
  // One table when every location has the same hours, one per location otherwise.
  const tables = $derived.by(() => {
    if (locations.length === 0) return [];
    if (sharesOneSchedule(locations)) {
      return [
        {
          id: "all",
          title: locations.length > 1 ? "Todas las sucursales" : "",
          rows: scheduleRows(locations[0].hours, now),
        },
      ];
    }
    return locations.map((l) => ({
      id: l.id,
      title: l.name,
      rows: scheduleRows(l.hours, now),
    }));
  });
  const hasSchedule = $derived(tables.some((t) => t.rows.length > 0));

  onMount(() => {
    fetchStoreLocations()
      .then((value) => (locations = value))
      .catch(() => (locations = []))
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
    {#if loaded && status?.label}
      <span
        class={`badge border-0 ${status.tone === "open" ? "bg-success/15 text-success" : "bg-base-200 text-base-content/80"}`}
        title={status.detail ?? status.label}
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
  {:else if hasSchedule}
    <div class="space-y-4">
      {#each tables as table (table.id)}
        {#if table.rows.length > 0}
          <div>
            {#if table.title}
              <p class="mb-1 text-sm font-semibold text-base-content/70">
                {table.title}
              </p>
            {/if}
            <dl class="divide-y divide-base-300">
              {#each table.rows as row (row.key)}
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
          </div>
        {/if}
      {/each}
    </div>
  {:else}
    <p class="text-base-content/75">
      Escríbenos por
      <a
        href={whatsappLink(locations[0]?.whatsapp ?? DEFAULT_WHATSAPP)}
        class="link text-primary"
        rel="noopener noreferrer"
        target="_blank">WhatsApp</a
      >
      para confirmar el horario de hoy.
    </p>
  {/if}
</div>
