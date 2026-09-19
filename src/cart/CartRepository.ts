import type { CartItem } from "./types";

// Swap the implementation (see LocalCartRepository.ts) once the backend team adds
// real cart endpoints — no screen/component should depend on the storage mechanism.
export interface CartRepository {
  getItems(customerId: string): CartItem[];
  addItem(
    customerId: string,
    item: Omit<CartItem, "quantity">,
    quantity?: number,
  ): CartItem[];
  updateQuantity(
    customerId: string,
    sku: string,
    size: string | null,
    quantity: number,
  ): CartItem[];
  removeItem(customerId: string, sku: string, size: string | null): CartItem[];
  clear(customerId: string): CartItem[];
}
