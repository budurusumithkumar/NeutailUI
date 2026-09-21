import { create } from "zustand";
import { localCartRepository } from "./LocalCartRepository";
import type { CartItem } from "./types";

interface CartState {
  ownerId: string | null;
  items: CartItem[];
  setOwner: (ownerId: string | null) => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (sku: string, size: string | null, quantity: number) => void;
  changeSize: (sku: string, size: string | null, newSize: string) => void;
  removeItem: (sku: string, size: string | null) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  ownerId: null,
  items: [],

  setOwner: (ownerId) =>
    set((state) => {
      if (state.ownerId === ownerId) return state;
      return {
        ownerId,
        items: ownerId ? localCartRepository.getItems(ownerId) : [],
      };
    }),

  addItem: (item, quantity) =>
    set((state) =>
      state.ownerId
        ? { items: localCartRepository.addItem(state.ownerId, item, quantity) }
        : state,
    ),

  updateQuantity: (sku, size, quantity) =>
    set((state) =>
      state.ownerId
        ? {
            items: localCartRepository.updateQuantity(
              state.ownerId,
              sku,
              size,
              quantity,
            ),
          }
        : state,
    ),

  changeSize: (sku, size, newSize) =>
    set((state) =>
      state.ownerId
        ? { items: localCartRepository.changeSize(state.ownerId, sku, size, newSize) }
        : state,
    ),

  removeItem: (sku, size) =>
    set((state) =>
      state.ownerId
        ? { items: localCartRepository.removeItem(state.ownerId, sku, size) }
        : state,
    ),

  clear: () =>
    set((state) =>
      state.ownerId ? { items: localCartRepository.clear(state.ownerId) } : state,
    ),
}));

export function useCartCount(): number {
  return useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
}

export function useCartSubtotal(): number {
  return useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.price_gbp * item.quantity, 0),
  );
}
