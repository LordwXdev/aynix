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

export const categoryService = {
  listActive: () => categoryRepository.listActive(),

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
    return categoryRepository.create({ ...input, slug });
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
    return categoryRepository.update(id, input);
  },
};
