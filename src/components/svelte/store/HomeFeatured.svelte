<script lang="ts">
  import { onMount } from "svelte";
  import { formatCurrency } from "../../../lib/utils/formatters";
  import { listPublicProducts, type PublicProduct } from "../../../lib/api/store";

  let loading = $state(true);
  let error = $state("");
  let featured = $state<PublicProduct[]>([]);

  onMount(() => {
    void loadFeatured();
  });

  async function loadFeatured() {
    loading = true;
    error = "";

    try {
      const products = await listPublicProducts();
      featured = products
        .filter((product) => product.is_available && product.stock_status === "in_stock")
        .slice(0, 3);
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "No se pudo cargar el menú.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-6 space-y-8">
  <section class="hero bg-base-100 rounded-2xl shadow-xl border border-base-300">
    <div class="hero-content text-center py-14">
      <div class="max-w-2xl">
        <h1 class="text-4xl font-bold mb-4">IshosFactory — Gelatos & Sorbetes</h1>
        <p class="py-4 text-base-content/70">
          Helados artesanales hechos con amor en El Salvador.
        </p>
        <a href="/menu" class="btn btn-primary">Ver todo el menú</a>
      </div>
    </div>
  </section>

  <section class="space-y-4">
    <h2 class="text-3xl font-bold text-center mb-8">Productos Destacados</h2>

    {#if loading}
      <div class="skeleton h-48 w-full rounded-xl"></div>
    {:else if error}
      <div class="alert alert-error">{error}</div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each featured as product (product.id)}
          <article class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 h-full flex flex-col">
            {#if product.image_url}
              <figure class="overflow-hidden">
                <img src={product.image_url} alt={product.name} class="w-full h-32 sm:h-40 md:h-48 object-contain bg-base-200" loading="lazy" />
              </figure>
            {/if}
            <div class="card-body grow">
              <h3 class="card-title">{product.name}</h3>
              <p class="text-sm text-base-content/70 grow">{product.description}</p>
              <div class="card-actions justify-between items-center mt-4">
                <span class="text-2xl font-bold text-primary">{formatCurrency(product.price)}</span>
                <span class="badge badge-success">Disponible</span>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {/if}

    <div class="text-center">
      <a href="/menu" class="btn btn-outline">Ir al menú</a>
    </div>
  </section>
</div>
