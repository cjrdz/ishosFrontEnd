<script lang="ts">
  import IconifyIcon from "@iconify/svelte";
  import { registerIconCollections } from "../../../lib/icons/register";

  registerIconCollections();

  let props = $props();
</script>

<IconifyIcon {...props} />
