/**
 * Store/Storefront data types
 */

/**
 * Product category
 */
export interface Category {
  id: string;
  name: string;
  description?: string;
  priority: number;
  active: boolean;
}

/**
 * Product item
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  category_id: string;
  category?: Category;
  stock: number;
  active: boolean;
}

/**
 * Cart item (product + quantity)
 */
export interface CartItem {
  product_id: string;
  product?: Product;
  quantity: number;
  price: number;
}

/**
 * Order status
 */
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

/**
 * Order item (product in order)
 */
export interface OrderItem {
  id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  price: number;
}

/**
 * Order
 */
export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  status: OrderStatus;
  total_price: number;
  items: OrderItem[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Order create request
 */
export interface CreateOrderRequest {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
  notes?: string;
}
