import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { local } from "./storage";
import type { Product } from "./types";

export interface CartLine {
  productId: string;
  name: string;
  price: number;
  stockQty: number;
  categoryId: string;
  image: string | null;
  storeName: string;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | null>(null);
const KEY = "aynix.cart";

// the cart lives on the phone, so it survives closing the app
export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    local.get<CartLine[]>(KEY).then((saved) => {
      if (saved) setLines(saved);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) void local.set(KEY, lines);
  }, [lines, loaded]);

  const add = useCallback((product: Product, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((l) => l.productId === product.id);
      if (existing) {
        return current.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: Math.min(l.quantity + quantity, product.stockQty) }
            : l
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          stockQty: product.stockQty,
          categoryId: product.categoryId,
          image: product.images?.[0] ?? null,
          storeName: product.vendor?.storeName ?? "",
          quantity: Math.min(quantity, product.stockQty),
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((l) => l.productId !== productId)
        : current.map((l) =>
            l.productId === productId ? { ...l, quantity: Math.min(quantity, l.stockQty) } : l
          )
    );
  }, []);

  const remove = useCallback(
    (productId: string) => setLines((current) => current.filter((l) => l.productId !== productId)),
    []
  );
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, add, setQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
};
