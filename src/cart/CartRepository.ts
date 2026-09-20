import type { CartItem } from "./types";

// Swap the implementation (see LocalCartRepository.ts) once the backend team adds
// real cart endpoints — no screen/component should depend on the storage mechanism.
export interface CartRepository {
  getItems(): CartItem[];
  addItem(item: Omit<CartItem, "quantity">, quantity?: number): CartItem[];
  updateQuantity(sku: string, size: string | null, quantity: number): CartItem[];
  /** Moves a line to a new size, merging quantities if that sku+size line already exists. */
  changeSize(sku: string, size: string | null, newSize: string): CartItem[];
  removeItem(sku: string, size: string | null): CartItem[];
  clear(): CartItem[];
}
