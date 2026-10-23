// fills a fresh database with what the app needs to start:
// the first admin account and the main product categories
// run with:  npm run seed
import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CATEGORIES = [
  { name: "Food & Groceries", slug: "food-groceries" },
  { name: "Fashion & Clothing", slug: "fashion-clothing" },
  { name: "Phones & Accessories", slug: "phones-accessories" },
  { name: "Electronics", slug: "electronics" },
  { name: "Beauty & Personal Care", slug: "beauty-personal-care" },
  { name: "Home & Kitchen", slug: "home-kitchen" },
  { name: "Health & Pharmacy", slug: "health-pharmacy" },
  { name: "Baby & Kids", slug: "baby-kids" },
  { name: "Agriculture & Farm", slug: "agriculture-farm" },
  { name: "Art & Crafts", slug: "art-crafts" },
];

const main = async () => {
  for (const [index, category] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: { ...category, sortOrder: index },
    });
  }
  console.log(`Categories ready (${CATEGORIES.length})`);

  // users who opened a store before roles were set automatically
  const fixed = await prisma.user.updateMany({
    where: { role: "CUSTOMER", vendor: { isNot: null } },
    data: { role: "VENDOR" },
  });
  if (fixed.count > 0) {
    console.log(`Set role VENDOR on ${fixed.count} existing store owner(s)`);
  }

  const phone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  if (!phone || !password) {
    console.log("ADMIN_PHONE / ADMIN_PASSWORD not set, skipping admin account");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    await prisma.user.update({ where: { phone }, data: { role: "ADMIN", isActive: true } });
    console.log(`Admin ready (existing account ${phone})`);
  } else {
    await prisma.user.create({
      data: {
        name: process.env.ADMIN_NAME ?? "Aynix Admin",
        phone,
        passwordHash: await bcrypt.hash(password, 10),
        role: "ADMIN",
      },
    });
    console.log(`Admin created (${phone})`);
  }
};

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
