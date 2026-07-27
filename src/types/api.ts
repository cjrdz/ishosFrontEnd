/**
 * Re-exports of the OpenAPI-generated schema types.
 *
 * These aliases are the frontend source of truth for API contracts.
 * Regenerate `api-generated.ts` with `pnpm run generate:api-types`.
 */

import type { components } from "@api-types/api-generated";

export type Product = components["schemas"]["Product"];
export type Category = components["schemas"]["Category"];
export type Flavor = components["schemas"]["Flavor"];
export type Addon = components["schemas"]["Addon"];
export type OrderItem = components["schemas"]["OrderItem"];
export type ActiveOffer = components["schemas"]["ActiveOffer"];
export type PaginationMetadata = components["schemas"]["PaginationMetadata"];

export type PaginatedList<T> =
  | { data: T[]; pagination: PaginationMetadata }
  | T[];

export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

// Product admin payload types derived from the generated Product schema.
type ProductExcludedFields =
  | "id"
  | "category_name"
  | "image_url"
  | "flavors"
  | "addons"
  | "created_at";

export type ProductCreatePayload = Omit<Product, ProductExcludedFields> &
  Required<Pick<Product, "category_id">>;

export type ProductUpdatePayload = Partial<
  Omit<Product, ProductExcludedFields>
>;

// Request/response bodies for common operations.
export type LoginRequest = components["schemas"]["LoginInputBody"];
export type LoginResponse = components["schemas"]["LoginOutputBody"];
export type CreateOrderRequest = components["schemas"]["CreateOrderInputBody"];

// Order request bodies. The Order entity type is defined locally in
// `features/admin-management/lib/api.ts` to match the UI's stricter enums.
export type UpdateOrderRequest = components["schemas"]["UpdateOrderInputBody"];
export type UpdateOrderStatusRequest =
  components["schemas"]["UpdateOrderStatusInputBody"];
export type UpdateOrderNotesRequest =
  components["schemas"]["UpdateOrderNotesInputBody"];
export type RejectOrderRequest = components["schemas"]["RejectOrderInputBody"];
export type ArchiveOrderRequest =
  components["schemas"]["ArchiveOrderInputBody"];

// Employees. The Employee entity type is defined locally to match UI enums.
export type CreateEmployeeRequest =
  components["schemas"]["CreateEmployeeInputBody"];
export type UpdateEmployeeRequest =
  components["schemas"]["UpdateEmployeeInputBody"];

// Users. The User entity type is defined locally to match UI enums.
export type CreateUserRequest = components["schemas"]["CreateUserInputBody"];
export type UpdateUserRequest = components["schemas"]["UpdateUserInputBody"];

// Categories
export type CreateCategoryRequest =
  components["schemas"]["CreateCategoryInputBody"];
export type UpdateCategoryRequest =
  components["schemas"]["UpdateCategoryInputBody"];

// Flavors
export type CreateFlavorRequest =
  components["schemas"]["CreateFlavorInputBody"];
export type UpdateFlavorRequest =
  components["schemas"]["UpdateFlavorInputBody"];

// Addons
export type CreateAddonRequest = components["schemas"]["CreateAddonInputBody"];
export type UpdateAddonRequest = components["schemas"]["UpdateAddonInputBody"];

// Container types
export type ContainerType = components["schemas"]["ContainerType"];

// Settings entity types are defined locally in the BFF module.
export type StoreSettings = components["schemas"]["StoreSettings"];
export type ArchiveConfig = components["schemas"]["ArchiveConfig"];
export type PublicOrderRateLimitConfig =
  components["schemas"]["PublicOrderRateLimitConfig"];
export type TokenTTLConfig = components["schemas"]["TokenTTLConfig"];

// Common
export type MessageResponse = components["schemas"]["MessageResponse"];
