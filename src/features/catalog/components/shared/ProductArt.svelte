<script lang="ts">
  /**
   * Brand line illustration (outlined in wine, cream at night, like the
   * paletero and frutera artwork) used when a product has no photo (or it fails to
   * load), so cards never show a broken-image icon. The shape follows the
   * product's category; scoop colours vary per product so a grid of
   * illustrations doesn't look repetitive.
   */
  interface Props {
    name: string;
    category?: string;
    scoops?: number;
    seed?: string;
  }
  let { name, category = "", scoops = 1, seed = name }: Props = $props();

  // Gelato tones: leche, fresa, pistacho, chocolate, mango, café, menta, jocote.
  const TONES = [
    "#fff7e6",
    "#f9b4da",
    "#c8e3a0",
    "#7a4a3a",
    "#ffc857",
    "#b88a6a",
    "#91e2d6",
    "#e8623c",
  ];

  function hash(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++)
      h = (h * 31 + value.charCodeAt(i)) >>> 0;
    return h;
  }

  type Kind = "cone" | "cup" | "bowl" | "drink" | "banana" | "tub";
  const kind = $derived.by((): Kind => {
    const text = `${category} ${name}`.toLowerCase();
    if (/chocobanan/.test(text)) return "banana";
    if (/bebida|malteada|frappe|agua|batido/.test(text)) return "drink";
    if (/cono|barquillo/.test(text)) return "cone";
    if (/bowl/.test(text)) return "bowl";
    if (/llevar|pinta|litro|compartir|cajita/.test(text)) return "tub";
    return "cup";
  });

  const h = $derived(hash(seed));
  const count = $derived(Math.max(1, Math.min(scoops || 1, 3)));
  const tone = (i: number) => TONES[(h + i * 3) % TONES.length];
  // Tile tint per product, like the printed menu's colour blocks.
  const TINTS = ["mint", "pink", "cream"] as const;
  const tint = $derived(TINTS[h % TINTS.length]);
</script>

<svg
  viewBox="0 0 120 90"
  class={`product-art product-art--${tint}`}
  role="img"
  aria-label={name}
>
  <rect width="120" height="90" class="art-bg" />
  <circle cx="102" cy="14" r="22" class="art-sun" />
  {#if kind === "drink"}
    <rect
      x="63"
      y="6"
      width="5"
      height="24"
      rx="2.5"
      class="ink-fill"
      transform="rotate(14 65 18)"
    />
    <path d="M42 18h36l-6 60H48z" class="ink art-cup" />
    <path d="M45 38h30l-4 37H49z" fill={tone(0)} class="ink" />
  {:else if kind === "banana"}
    <rect x="94" y="45" width="16" height="8" rx="4" class="ink art-cup" />
    <rect
      x="18"
      y="38"
      width="78"
      height="22"
      rx="11"
      fill="#f9e9a9"
      class="ink"
    />
    <path
      d="M28 38h36v22H29a11 11 0 0 1-11-11 11 11 0 0 1 10-11z"
      fill="#7a4a3a"
      class="ink"
    />
    <circle cx="36" cy="44" r="2" class="sprinkle" />
    <circle cx="48" cy="52" r="2" class="sprinkle" />
    <circle cx="56" cy="43" r="2" class="sprinkle" />
  {:else}
    {#each Array.from({ length: count }) as _, i}
      <circle
        cx={60 + (i - (count - 1) / 2) * 20}
        cy={kind === "cone" ? 34 - (i % 2) * 6 : 40 - (i % 2) * 6}
        r="17"
        fill={tone(i)}
        class="ink"
      />
    {/each}
    {#if kind === "cone"}
      <path d="M42 44h36L60 87z" class="ink art-cone" />
      <path d="M50 52l18 10M48 60l20 11M55 74l9 5" class="ink-line" />
    {:else if kind === "bowl"}
      <path d="M26 46h68c0 19-15 31-34 31S26 65 26 46z" class="ink art-bowl" />
    {:else if kind === "tub"}
      <path d="M31 46h58l-5 33H36z" class="ink art-cup" />
      <rect x="43" y="56" width="34" height="10" rx="5" class="ink-fill" />
    {:else}
      <path d="M33 46h54l-7 31H40z" class="ink art-cup" />
    {/if}
  {/if}
</svg>

<style>
  .product-art {
    width: 100%;
    height: 100%;
    display: block;
    --art-ink: var(--brand-scoop-line);
  }
  .product-art--mint .art-bg {
    fill: var(--brand-mint-tint);
  }
  .product-art--pink .art-bg {
    fill: var(--brand-pink-tint);
  }
  .product-art--cream .art-bg {
    fill: var(--brand-cream-tint);
  }
  .art-sun {
    fill: var(--color-base-100);
    opacity: 0.55;
  }
  .ink {
    stroke: var(--art-ink);
    stroke-width: 2.5;
    stroke-linejoin: round;
  }
  .ink-line {
    stroke: var(--art-ink);
    stroke-width: 2;
    stroke-linecap: round;
    fill: none;
  }
  .ink-fill,
  .sprinkle {
    fill: var(--art-ink);
  }
  .art-cone,
  .art-cup {
    fill: var(--color-base-100);
  }
  .art-bowl {
    fill: var(--brand-menu-bar);
  }
  :global([data-theme="night"]) .art-sun {
    opacity: 0.25;
  }
</style>
