// the shapes the backend sends back (money comes as strings, like "450.00")

export type Role = "CUSTOMER" | "VENDOR" | "DRIVER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  city: string | null;
  department: string | null;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Vendor {
  id: string;
  userId: string;
  storeName: string;
  storeSlug: string;
  description: string | null;
  whatsapp: string | null;
  city: string | null;
  department: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
  createdAt: string;
  user: { name: string; phone: string; isActive: boolean };
  _count: { products: number };
}

export interface Driver {
  id: string;
  userId: string;
  vehicleType: "MOTO" | "CAR" | "BICYCLE" | "FOOT";
  plateNumber: string | null;
  city: string;
  department: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
  isOnline: boolean;
  latitude: number | null;
  longitude: number | null;
  lastSeenAt: string | null;
  createdAt: string;
  user: { name: string; phone: string; isActive: boolean };
  _count: { deliveries: number };
}

export type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type DeliveryStatus =
  | "WAITING_FOR_DRIVER"
  | "ASSIGNED"
  | "PICKED_UP"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export interface OrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string;
  total: string;
  deliveryCity: string;
  deliveryDepartment: string;
  createdAt: string;
  customer: { name: string; phone: string };
  delivery: { status: DeliveryStatus } | null;
  _count: { items: number };
}

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  commissionAmount: string;
  vendorPayout: string;
  status: OrderStatus;
  vendor: { storeName: string; storeSlug: string };
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: string;
  deliveryFee: string;
  total: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDepartment: string;
  deliveryNotes: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  items: OrderItem[];
  delivery: {
    id: string;
    status: DeliveryStatus;
    failReason: string | null;
    assignedAt: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    driver: (Driver & { user: { name: string; phone: string } }) | null;
  } | null;
}

export interface DeliveryRow {
  id: string;
  orderId: string;
  status: DeliveryStatus;
  failReason: string | null;
  declinedDriverIds: string[];
  createdAt: string;
  assignedAt: string | null;
  order: { orderNumber: string; deliveryCity: string; deliveryDepartment: string; total: string };
  driver: {
    id: string;
    latitude: number | null;
    longitude: number | null;
    lastSeenAt: string | null;
    user: { name: string; phone: string };
  } | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number };
}

export interface Dashboard {
  users: Record<string, number>;
  vendors: Record<string, number>;
  drivers: Record<string, number> & { online: number };
  orders: Record<string, number>;
  deliveries: Record<string, number>;
  money: { deliveredSales: string; commissionEarned: string; owedToVendors: string };
  today: { orders: number; sales: string };
  last30Days: { day: string; orders: number; sales: string }[];
  topVendors: { vendor?: { id: string; storeName: string; storeSlug: string }; sales: string; commission: string }[];
}
