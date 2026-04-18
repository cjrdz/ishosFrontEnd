import { addCollection } from "@iconify/svelte";
import lucideIcons from "@iconify-json/lucide/icons.json";

let registered = false;

export function registerIconCollections(): void {
  if (registered) {
    return;
  }

  addCollection(lucideIcons);
  registered = true;
}
