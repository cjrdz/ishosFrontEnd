<script lang="ts">
  import { onMount } from "svelte";

  let itemCount = $state(0);

  function updateCount(event: Event) {
    const custom = event as CustomEvent<number>;
    itemCount = Number(custom.detail || 0);
  }

  onMount(() => {
    const persisted = localStorage.getItem("ishos_storefront_cart_count");
    if (persisted) {
      itemCount = Number(persisted) || 0;
    }

    window.addEventListener("storefront-cart-count", updateCount as EventListener);
    return () => {
      window.removeEventListener("storefront-cart-count", updateCount as EventListener);
    };
  });
</script>

<a href="/order/cart" class="btn btn-ghost btn-circle relative" aria-label="Ver carrito">
  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
  {#if itemCount > 0}
    <span class="badge badge-sm badge-primary absolute -top-1 -right-1">{itemCount}</span>
  {/if}
</a>
