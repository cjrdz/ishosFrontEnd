<script lang="ts">
  import IconifyIcon from "@iconify/svelte";
  import { registerIconCollections } from "@shared/icons/register";

  registerIconCollections();

  let props = $props();
</script>

<IconifyIcon {...props} />
