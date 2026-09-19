import type { CartRepository } from "./CartRepository";
import type { CartItem } from "./types";

const CART_STORAGE_KEY_PREFIX = "neutail_cart_";

function storageKey(customerId: string): string {
  return `${CART_STORAGE_KEY_PREFIX}${encodeURIComponent(customerId)}`;
}

function sameLine(item: CartItem, sku: string, size: string | null): boolean {
  return item.sku === sku && (item.size ?? null) === size;
}

function read(customerId: string): CartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(customerId));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function write(customerId: string, items: CartItem[]): CartItem[] {
  try {
    localStorage.setItem(storageKey(customerId), JSON.stringify(items));
  } catch {
    // storage unavailable — cart simply won't survive a reload this session
  }
  return items;
}

export const localCartRepository: CartRepository = {
  getItems(customerId) {
    return read(customerId);
  },

  addItem(customerId, item, quantity = 1) {
    const items = read(customerId);
    const size = item.size ?? null;
    const existing = items.find((line) => sameLine(line, item.sku, size));
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ ...item, size, quantity });
    }
    return write(customerId, items);
  },

  updateQuantity(customerId, sku, size, quantity) {
    const items = read(customerId);
    if (quantity <= 0) {
      return write(
        customerId,
        items.filter((line) => !sameLine(line, sku, size)),
      );
    }
    const existing = items.find((line) => sameLine(line, sku, size));
    if (existing) {
      existing.quantity = quantity;
    }
    return write(customerId, items);
  },

  removeItem(customerId, sku, size) {
    const items = read(customerId).filter((line) => !sameLine(line, sku, size));
    return write(customerId, items);
  },

  clear(customerId) {
    return write(customerId, []);
  },
};
