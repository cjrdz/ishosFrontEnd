<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "../shared/AppIcon.svelte";
  import { fetchStoreSettings } from "../../../lib/api/store";

  let itemCount = $state(0);
  let ordersEnabled = $state(true);

  function updateCount(event: Event) {
    const custom = event as CustomEvent<number>;
    itemCount = Number(custom.detail || 0);
  }

  onMount(() => {
    const persisted = localStorage.getItem("ishos_storefront_cart_count");
    if (persisted) {
      itemCount = Number(persisted) || 0;
    }

    fetchStoreSettings()
      .then((s) => {
        ordersEnabled = s.orders_enabled;
      })
      .catch(() => {
        ordersEnabled = true;
      });

    window.addEventListener(
      "storefront-cart-count",
      updateCount as EventListener,
    );
    return () => {
      window.removeEventListener(
        "storefront-cart-count",
        updateCount as EventListener,
      );
    };
  });
</script>

{#if ordersEnabled}
  <a
    href="/order/cart"
    class="btn btn-ghost btn-circle relative"
    aria-label="Ver carrito"
  >
    <Icon icon="lucide:shopping-cart" class="h-6 w-6" />
    {#if itemCount > 0}
      <span class="badge badge-sm badge-primary absolute -top-1 -right-1"
        >{itemCount}</span
      >
    {/if}
  </a>
{/if}
