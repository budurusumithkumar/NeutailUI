import type { CartRepository } from "./CartRepository";
import type { CartItem } from "./types";

const CART_STORAGE_KEY = "neutail_cart";

function sameLine(item: CartItem, sku: string, size: string | null): boolean {
  return item.sku === sku && (item.size ?? null) === size;
}

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: CartItem[]): CartItem[] {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage unavailable — cart simply won't survive a reload this session
  }
  return items;
}

export const localCartRepository: CartRepository = {
  getItems() {
    return read();
  },

  addItem(item, quantity = 1) {
    const items = read();
    const size = item.size ?? null;
    const existing = items.find((line) => sameLine(line, item.sku, size));
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ ...item, size, quantity });
    }
    return write(items);
  },

  updateQuantity(sku, size, quantity) {
    const items = read();
    if (quantity <= 0) {
      return write(items.filter((line) => !sameLine(line, sku, size)));
    }
    const existing = items.find((line) => sameLine(line, sku, size));
    if (existing) {
      existing.quantity = quantity;
    }
    return write(items);
  },

  changeSize(sku, size, newSize) {
    const items = read();
    const line = items.find((entry) => sameLine(entry, sku, size));
    if (!line || newSize === size) return items;
    const target = items.find((entry) => sameLine(entry, sku, newSize));
    if (target) {
      target.quantity += line.quantity;
      return write(items.filter((entry) => entry !== line));
    }
    line.size = newSize;
    return write(items);
  },

  removeItem(sku, size) {
    const items = read().filter((line) => !sameLine(line, sku, size));
    return write(items);
  },

  clear() {
    return write([]);
  },
};
