export type Role = "CUSTOMER" | "VENDOR" | "DRIVER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  address: string | null;
  city: string | null;
  department: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  vendorId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  comparePrice: string | null;
  stockQty: number;
  images: string[] | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";
  vendor?: { id?: string; storeName: string; storeSlug: string; whatsapp?: string | null };
}

export interface Store {
  id: string;
  storeName: string;
  storeSlug: string;
  description: string | null;
  whatsapp: string | null;
  city: string | null;
  department: string | null;
  products: Product[];
}

export interface Vendor {
  id: string;
  storeName: string;
  storeSlug: string;
  description: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
}

export type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type DeliveryStatus =
  | "WAITING_FOR_DRIVER"
  | "ASSIGNED"
  | "PICKED_UP"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  vendorPayout: string;
  status: OrderStatus;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  subtotal: string;
  deliveryFee: string;
  total: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDepartment: string;
  deliveryNotes: string | null;
  createdAt: string;
  items: OrderItem[];
  delivery: { status: DeliveryStatus } | null;
}

export interface Tracking {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  delivery: {
    status: DeliveryStatus;
    assignedAt: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    driver: {
      name: string;
      phone: string;
      vehicleType: string;
      plateNumber: string | null;
      latitude: number | null;
      longitude: number | null;
      lastSeenAt: string | null;
    } | null;
  } | null;
}

export interface VendorItem extends OrderItem {
  order: {
    orderNumber: string;
    deliveryAddress: string;
    deliveryCity: string;
    deliveryDepartment: string;
    deliveryNotes: string | null;
    createdAt: string;
    customer: { name: string; phone: string };
  };
}

export interface Sales {
  itemsByStatus: Record<string, number>;
  delivered: { unitsSold: number; grossSales: string; commission: string; payout: string };
}

export interface Driver {
  id: string;
  vehicleType: "MOTO" | "CAR" | "BICYCLE" | "FOOT";
  plateNumber: string | null;
  city: string;
  department: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
  isOnline: boolean;
}

export interface Job {
  id: string;
  orderId: string;
  status: DeliveryStatus;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    total: string;
    paymentMethod: string;
    deliveryAddress: string;
    deliveryCity: string;
    deliveryDepartment: string;
    deliveryNotes: string | null;
    customer: { name: string; phone: string };
    items: {
      id: string;
      productName: string;
      quantity: number;
      vendor: {
        id: string;
        storeName: string;
        whatsapp: string | null;
        address: string | null;
        city: string | null;
        user: { phone: string };
      };
    }[];
  };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  readAt: string | null;
  createdAt: string;
}
