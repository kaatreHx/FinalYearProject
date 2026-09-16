"use client";

import { createContext, ReactNode, useContext, useState } from "react";

interface CartContextValue {
  cartIds: string[];
  isInCart: (id: string) => boolean;
  toggleCart: (id: string) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartIds, setCartIds] = useState<string[]>([]);

  function isInCart(id: string) {
    return cartIds.includes(id);
  }

  function toggleCart(id: string) {
    setCartIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function removeFromCart(id: string) {
    setCartIds((prev) => prev.filter((i) => i !== id));
  }

  function clearCart() {
    setCartIds([]);
  }

  return (
    <CartContext.Provider
      value={{ cartIds, isInCart, toggleCart, removeFromCart, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
