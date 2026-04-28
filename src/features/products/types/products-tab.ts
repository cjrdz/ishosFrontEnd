import type {
  Addon,
  AdminImage,
  Category,
  Flavor,
  Product,
} from "@features/admin-management";

export interface ProductsTabProps {
  categories: Category[];
  products: Product[];
  flavors: Flavor[];
  addons: Addon[];
  galleryImages: AdminImage[];
  busy: boolean;
  galleryBusy: boolean;
  moduleError: string;
  onCreate: (payload: {
    name: string;
    description: string;
    price: number;
    category_id: string;
    image_path?: string;
    is_available: boolean;
    exclude_global_flavors?: boolean;
    exclude_global_addons?: boolean;
  }) => void;
  onUpdate: (
    id: string,
    payload: {
      name: string;
      description: string;
      price: number;
      category_id: string;
      image_path?: string;
      is_available: boolean;
      exclude_global_flavors?: boolean;
      exclude_global_addons?: boolean;
    },
  ) => void;
  onDelete: (id: string) => void;
  onCreateFlavor: (payload: {
    name: string;
    display_order: number;
    is_seasonal: boolean;
  }) => void;
  onUpdateFlavor: (
    id: string,
    payload: {
      name: string;
      display_order: number;
      is_seasonal: boolean;
      is_active: boolean;
    },
  ) => void;
  onDeleteFlavor: (id: string) => void;
  onCreateAddon: (payload: {
    name: string;
    price: number;
    group_name: string;
    display_order: number;
  }) => void;
  onUpdateAddon: (
    id: string,
    payload: {
      name: string;
      price: number;
      group_name: string;
      display_order: number;
      is_active: boolean;
    },
  ) => void;
  onDeleteAddon: (id: string) => void;
  flavorBusy: boolean;
  addonBusy: boolean;
  flavorError: string;
  addonError: string;
  onLinkFlavor: (productId: string, flavorId: string) => Promise<void>;
  onUnlinkFlavor: (productId: string, flavorId: string) => Promise<void>;
  onLinkAddon: (productId: string, addonId: string) => Promise<void>;
  onUnlinkAddon: (productId: string, addonId: string) => Promise<void>;
  onReloadGallery: () => void | Promise<void>;
  onUploadGalleryImage: (file: File) => Promise<string | null>;
  onDeleteGalleryImage: (path: string) => Promise<boolean>;
}
