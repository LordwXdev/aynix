import { categoryRepository } from "./category.repository.js";

const makeSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // "Électronique" -> "electronique"
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

// categories almost never change, but every app screen asks for them:
// keep them in memory for 5 minutes, and throw the copy away when an admin edits one
const CACHE_MS = 5 * 60_000;
let cached: { at: number; value: Awaited<ReturnType<typeof categoryRepository.listActive>> } | null = null;
const invalidate = () => {
  cached = null;
};

export const categoryService = {
  listActive: async () => {
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
    const value = await categoryRepository.listActive();
    cached = { at: Date.now(), value };
    return value;
  },

  listAll: () => categoryRepository.listAll(),

  create: async (input: { name: string; parentId?: string; sortOrder?: number }) => {
    const slug = makeSlug(input.name);
    if (!slug) {
      throw new Error("Invalid category name");
    }
    if (await categoryRepository.findBySlug(slug)) {
      throw new Error("A category with this name already exists");
    }
    if (input.parentId && !(await categoryRepository.findById(input.parentId))) {
      throw new Error("Parent category not found");
    }
    const category = await categoryRepository.create({ ...input, slug });
    invalidate();
    return category;
  },

  update: async (
    id: string,
    input: { name?: string; parentId?: string | null; sortOrder?: number; isActive?: boolean }
  ) => {
    if (!(await categoryRepository.findById(id))) {
      throw new Error("Category not found");
    }
    if (input.parentId === id) {
      throw new Error("A category cannot be its own parent");
    }
    const category = await categoryRepository.update(id, input);
    invalidate();
    return category;
  },
};
