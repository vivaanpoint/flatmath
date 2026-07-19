import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  'Rent',
  'Groceries',
  'Electricity',
  'Water',
  'Internet',
  'Gas',
  'Food',
  'Shopping',
  'Miscellaneous'
];

async function main() {
  console.log('Starting category seeding...');
  for (const categoryName of categories) {
    await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });
    console.log(`Seeded category: ${categoryName}`);
  }
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding categories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
