import { productRepository } from "./product.repository.js";
import { vendorService } from "../vendor/vendor.service.js";

const ALLOWED_STATUS = ["DRAFT", "ACTIVE", "INACTIVE", "OUT_OF_STOCK"] as const;
type ProductStatus = (typeof ALLOWED_STATUS)[number];

export const productService = {
  // a vendor adds a product to their own store
  createProduct: async (input: {
    userId: string;
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    comparePrice?: number;
    stockQty?: number;
    images?: string[];
    status?: ProductStatus;
  }) => {
    // the user must own a store
    const vendor = await vendorService.getMyStore(input.userId);

    if (vendor.status === "SUSPENDED" || vendor.status === "REJECTED") {
      throw new Error("Your store cannot add products right now");
    }

    if (!Number.isFinite(input.price) || input.price <= 0) {
      throw new Error("Price must be a number greater than 0");
    }

    if (input.stockQty !== undefined) {
      if (!Number.isInteger(input.stockQty) || input.stockQty < 0) {
        throw new Error("Stock must be a whole number, 0 or more");
      }
    }

    if (input.status && !ALLOWED_STATUS.includes(input.status)) {
      throw new Error("Invalid status");
    }

    const category = await productRepository.findCategoryById(input.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    return productRepository.create({
      vendorId: vendor.id,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      price: input.price,
      comparePrice: input.comparePrice,
      stockQty: input.stockQty,
      images: input.images,
      status: input.status,
    });
  },

  // public list with search and paging
  listProducts: async (input: {
    q?: string;
    categoryId?: string;
    page: number;
    limit: number;
  }) => {
    const page = Math.max(1, input.page);
    const limit = Math.min(50, Math.max(1, input.limit));

    const { items, total } = await productRepository.listActive({
      q: input.q,
      categoryId: input.categoryId,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  },

  // public: one product, only if it is active
  getProduct: async (id: string) => {
    const product = await productRepository.findById(id);
    if (!product || product.status !== "ACTIVE") {
      throw new Error("Product not found");
    }
    return product;
  },

  // a vendor sees all of their own products, drafts included
  listMyProducts: async (userId: string) => {
    const vendor = await vendorService.getMyStore(userId);
    return productRepository.listByVendor(vendor.id);
  },

  // a vendor edits one of their own products
  updateProduct: async (
    userId: string,
    productId: string,
    input: {
      name?: string;
      description?: string;
      price?: number;
      comparePrice?: number;
      stockQty?: number;
      images?: string[];
      status?: ProductStatus;
    }
  ) => {
    const vendor = await vendorService.getMyStore(userId);

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }
    if (product.vendorId !== vendor.id) {
      throw new Error("You can only edit your own products");
    }

    if (input.price !== undefined) {
      if (!Number.isFinite(input.price) || input.price <= 0) {
        throw new Error("Price must be a number greater than 0");
      }
    }
    if (input.stockQty !== undefined) {
      if (!Number.isInteger(input.stockQty) || input.stockQty < 0) {
        throw new Error("Stock must be a whole number, 0 or more");
      }
    }
    if (input.status && !ALLOWED_STATUS.includes(input.status)) {
      throw new Error("Invalid status");
    }

    return productRepository.update(productId, input);
  },
};