<script lang="ts">
  import { onMount } from "svelte";
  import { formatCurrency } from "../../../lib/utils/formatters";
  import { listPublicProducts, type PublicProduct } from "../../../lib/api/store";

  let loading = $state(true);
  let error = $state("");
  let featured = $state<PublicProduct[]>([]);
  const featuredSkeletonCards = Array.from({ length: 4 }, (_, index) => index);

  onMount(() => {
    void loadFeatured();
  });

  async function loadFeatured() {
    loading = true;
    error = "";

    try {
      const products = await listPublicProducts();
      featured = products
        .filter((product) => product.is_available)
        .slice(0, 4);
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
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each featuredSkeletonCards as cardIndex (cardIndex)}
          <article class="card card-sm bg-base-200 w-full max-w-64 mx-auto shadow-md overflow-hidden h-full" aria-hidden="true">
            <div class="skeleton w-full aspect-3/4"></div>
            <div class="card-body p-4 space-y-3">
              <div class="skeleton h-5 w-3/4"></div>
              <div class="space-y-2">
                <div class="skeleton h-4 w-full"></div>
                <div class="skeleton h-4 w-5/6"></div>
              </div>
              <div class="card-actions justify-between items-center mt-2">
                <div class="skeleton h-8 w-20"></div>
                <div class="skeleton h-6 w-24 rounded-full"></div>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {:else if error}
      <div class="alert alert-error">{error}</div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each featured as product (product.id)}
          <div class="hover-3d h-full">
            <article class="card card-sm bg-base-200 w-full max-w-64 mx-auto shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden h-full">
              {#if product.image_url}
                <figure class="bg-base-100 w-full aspect-3/4 overflow-hidden">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    class="w-full h-full object-cover object-center"
                    loading="lazy"
                  />
                </figure>
              {/if}
              <div class="card-body p-4">
                <h3 class="card-title">{product.name}</h3>
                <p class="text-sm text-base-content/70">{product.description}</p>
                
                {#if product.flavors && product.flavors.length > 0}
                  <div class="flex flex-wrap gap-2 my-2">
                    {#each product.flavors.slice(0, 2) as flavor (flavor.id)}
                      <div class="flex items-center gap-1">
                        <span class="text-xs text-base-content/60">{flavor.name}</span>
                        {#if flavor.is_seasonal}
                          <span class="badge badge-sm badge-warning">Temporada</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
                
                <div class="card-actions justify-between items-center mt-2">
                  <span class="text-2xl font-bold text-primary">{formatCurrency(product.price)}</span>
                  <span class="badge badge-success">Disponible</span>
                </div>
              </div>
            </article>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
