"use client";

import { type Product } from "@/lib/products";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  id: string;
  cartItemId: string;
  productId: string;
  slug: string;
  name: string;
  price: number;
  selectedSize: string;
  quantity: number;
  category: Product["category"];
  subcategory: Product["subcategory"];
  product: Product;
};

type AddItemOptions = {
  selectedSize: string;
  quantity?: number;
};

type CartStore = {
  items: CartItem[];
  isOpen: boolean;
  isCartOpen: boolean;

  addItem: (product: Product, options: AddItemOptions) => void;
  increaseItem: (cartItemId: string) => void;
  decreaseItem: (cartItemId: string) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;

  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  setCartOpen: (value: boolean) => void;

  totalItems: () => number;
  totalPrice: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      isCartOpen: false,

      addItem: (product, options) => {
        const selectedSize = options.selectedSize;
        const quantityToAdd = Math.max(1, options.quantity ?? 1);
        const cartItemId = `${product.id}-${selectedSize}`;

        set((state) => {
          const existingItem = state.items.find(
            (item) => item.cartItemId === cartItemId || item.id === cartItemId
          );

          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item.cartItemId === cartItemId || item.id === cartItemId
                  ? {
                      ...item,
                      quantity: item.quantity + quantityToAdd,
                    }
                  : item
              ),
            };
          }

          const newItem: CartItem = {
            id: cartItemId,
            cartItemId,
            productId: product.id,
            slug: product.slug,
            name: product.name,
            price: product.price,
            selectedSize,
            quantity: quantityToAdd,
            category: product.category,
            subcategory: product.subcategory,
            product,
          };

          return {
            items: [...state.items, newItem],
          };
        });
      },

      removeItem: (cartItemId) => {
        set((state) => ({
          items: state.items.filter(
            (item) => item.cartItemId !== cartItemId && item.id !== cartItemId
          ),
        }));
      },

      increaseItem: (cartItemId) => {
        const item = get().items.find(
          (cartItem) =>
            cartItem.cartItemId === cartItemId || cartItem.id === cartItemId
        );

        if (!item) return;

        get().updateQuantity(cartItemId, item.quantity + 1);
      },

      decreaseItem: (cartItemId) => {
        const item = get().items.find(
          (cartItem) =>
            cartItem.cartItemId === cartItemId || cartItem.id === cartItemId
        );

        if (!item) return;

        get().updateQuantity(cartItemId, item.quantity - 1);
      },

      updateQuantity: (cartItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartItemId);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.cartItemId === cartItemId || item.id === cartItemId
              ? { ...item, quantity }
              : item
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      openCart: () => {
        set({ isOpen: true, isCartOpen: true });
      },

      closeCart: () => {
        set({ isOpen: false, isCartOpen: false });
      },

      toggleCart: () => {
        const currentValue = get().isOpen || get().isCartOpen;
        set({ isOpen: !currentValue, isCartOpen: !currentValue });
      },

      setCartOpen: (value) => {
        set({ isOpen: value, isCartOpen: value });
      },

      totalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      totalPrice: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        );
      },
    }),
    {
      name: "charly-alexa-cart",
      partialize: (state) => ({
        items: state.items,
      }),
    }
  )
);
