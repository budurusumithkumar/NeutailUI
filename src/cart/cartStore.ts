import { create } from "zustand";
import { localCartRepository } from "./LocalCartRepository";
import type { CartItem } from "./types";

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (sku: string, size: string | null, quantity: number) => void;
  removeItem: (sku: string, size: string | null) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: localCartRepository.getItems(),

  addItem: (item, quantity) =>
    set({ items: localCartRepository.addItem(item, quantity) }),

  updateQuantity: (sku, size, quantity) =>
    set({ items: localCartRepository.updateQuantity(sku, size, quantity) }),

  removeItem: (sku, size) => set({ items: localCartRepository.removeItem(sku, size) }),

  clear: () => set({ items: localCartRepository.clear() }),
}));

export function useCartCount(): number {
  return useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
}

export function useCartSubtotal(): number {
  return useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.price_gbp * item.quantity, 0),
  );
}
