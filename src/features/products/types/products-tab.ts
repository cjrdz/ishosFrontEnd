import type {
  Addon,
  AdminImage,
  Category,
  Flavor,
  Product,
} from "@features/admin-management";
import type {
  PaginationInfo,
  ProductCreatePayload,
  ProductUpdatePayload,
} from "@api-types/api";

export interface ProductsTabProps {
  categories: Category[];
  /** Products are typed from the generated OpenAPI contract. */
  products: Product[];
  flavors: Flavor[];
  addons: Addon[];
  galleryImages: AdminImage[];
  busy: boolean;
  galleryBusy: boolean;
  moduleError: string;
  pagination: PaginationInfo;
  /** Create payload derived from the generated OpenAPI Product schema. */
  onCreate: (payload: ProductCreatePayload) => void;
  /** Update payload derived from the generated OpenAPI Product schema. */
  onUpdate: (id: string, payload: ProductUpdatePayload) => void;
  onDelete: (id: string) => void;
  onCreateFlavor: (payload: { name: string; is_seasonal: boolean }) => void;
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
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}
