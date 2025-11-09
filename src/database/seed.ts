import { db } from "@/database/drizzle";
// import { seed } from "drizzle-seed";
import { sql } from "drizzle-orm";
import { users, watches, products, productImages, productSafetyInfo, addresses, brands, currencies, countries } from "./schema.ts";

/*
At the moment seed script wont work with this import type in envConfig.ts file:
import { loadEnvConfig } from "@next/env";


change to this as a workaround, then switch back when db has been seeded:

import pkg from '@next/env';
const { loadEnvConfig } = pkg;
*/

async function seedDatabase() {
//   // Clean tables
//   await db.execute(sql`TRUNCATE TABLE users, watches, products, product_images, product_safety_info RESTART IDENTITY CASCADE`);

//   await seed(db, {
//     addresses,
//     users: {
//       exclude: ["country"], // we’ll ignore this field for now
//       relations: {
//         addressId: { table: addresses }, // automatically assign a random address ID
//       },
//       refinements: {
//         role: () => "user", // example of custom generation
//       },
//     },
//     productSafetyInfo,
//     brands,
//     watches,
//     productImages,
//     products,
//   });

    await db.execute(sql`
        TRUNCATE TABLE
            addresses,
            users,
            countries,
            product_safety_info,
            brands,
            products,
            product_images,
            watches,
            currencies
        RESTART IDENTITY CASCADE
        `);

    await seed();
    await seedCurrencies();
}



async function seedCurrencies() {
  await db.insert(currencies).values([
    {
      code: "DKK",
      exchangeRate: "1.000000",
      isActive: true,
      updatedAt: new Date(),
    },
    {
      code: "EUR",
      exchangeRate: "0.134000", // Example rate: 1 DKK = 0.134 EUR
      isActive: true,
      updatedAt: new Date(),
    }
  ]);

  console.log("Currencies seeded successfully");
}




async function seed() {
  console.log("🌱 Starting seed...");

  // 1. Countries
  const [denmark] = await db
    .insert(countries)
    .values({
      name: "Denmark",
      abbreviation: "DK",
      currency: "DKK",
    })
    .returning();

  // 2. Addresses
  const [address] = await db
    .insert(addresses)
    .values({
      userId: 1, // temporary placeholder, will be updated later if needed
      address1: "Strandgade 12",
      city: "Copenhagen",
      zipCode: "1401",
      stateProvince: "Capital Region",
    })
    .returning();

  // 3. Product Safety Info
  const [safetyInfo] = await db
    .insert(productSafetyInfo)
    .values({
      country: "Denmark",
      address: "Strandgade 12",
      city: "Copenhagen",
      zipCode: "1401",
      phoneNumber: "+45 12345678",
      email: "support@watchco.dk",
      website: "https://watchco.dk",
    })
    .returning();

  // 4. Brands
const [rolex] = await db
  .insert(brands)
  .values({
    name: "Rolex",
    slug: "rolex",
    productSafetyInfoId: safetyInfo.id,
  })
  .returning();

const [omega] = await db
  .insert(brands)
  .values({
    name: "Omega",
    slug: "omega",
    productSafetyInfoId: safetyInfo.id,
  })
  .returning();

const [tagHeuer] = await db
  .insert(brands)
  .values({
    name: "Tag Heuer",
    slug: "tag-heuer",
    productSafetyInfoId: safetyInfo.id,
  })
  .returning();

const [patekPhilippe] = await db
  .insert(brands)
  .values({
    name: "Patek Philippe",
    slug: "patek-philippe",
    productSafetyInfoId: safetyInfo.id,
  })
  .returning();

const [audemarsPiguet] = await db
  .insert(brands)
  .values({
    name: "Audemars Piguet",
    slug: "audemars-piguet",
    productSafetyInfoId: safetyInfo.id,
  })
  .returning();

// 5. Products
const seededProducts = await db
  .insert(products)
  .values([
    {
      productType: "watch",
      name: "Submariner",
      priceDkk: 9500000,
      description: "The iconic diver’s watch, crafted in Oystersteel.",
      stock: 5,
    },
    {
      productType: "watch",
      name: "Speedmaster",
      priceDkk: 6200000,
      description: "The legendary chronograph that went to the moon.",
      stock: 3,
    },
    {
      productType: "watch",
      name: "Monaco",
      priceDkk: 4900000,
      description: "Distinctive square case with racing heritage.",
      stock: 4,
    },
    {
      productType: "watch",
      name: "Nautilus",
      priceDkk: 28000000,
      description: "A luxury sports watch with timeless elegance.",
      stock: 2,
    },
    {
      productType: "watch",
      name: "Royal Oak",
      priceDkk: 31000000,
      description: "Iconic octagonal bezel and refined craftsmanship.",
      stock: 1,
    },
  ])
  .returning();

// 6. Product Images
await db.insert(productImages).values([
  {
    productId: seededProducts[0].id,
    imageUrl: "https://images.unsplash.com/photo-1587925358603-c2eea5305bbc?fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d3Jpc3R3YXRjaHxlbnwwfHwwfHx8MA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000",
    isThumbnail: true,
  },
  {
    productId: seededProducts[0].id,
    imageUrl: "https://images.unsplash.com/photo-1587925358603-c2eea5305bbc?fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d3Jpc3R3YXRjaHxlbnwwfHwwfHx8MA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000",
  },
  {
    productId: seededProducts[1].id,
    imageUrl: "https://images.unsplash.com/photo-1689287428096-7e1dcc705a5c?fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fHdyaXN0d2F0Y2h8ZW58MHx8MHx8fDA%3D&ixlib=rb-4.1.0&q=60&w=3000",
    isThumbnail: true,
  },
  {
    productId: seededProducts[1].id,
    imageUrl: "https://images.unsplash.com/photo-1689287428096-7e1dcc705a5c?fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fHdyaXN0d2F0Y2h8ZW58MHx8MHx8fDA%3D&ixlib=rb-4.1.0&q=60&w=3000",
  },
  {
    productId: seededProducts[2].id,
    imageUrl: "https://images.unsplash.com/photo-1604242692760-2f7b0c26856d?fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGx1eHVyeSUyMHdhdGNofGVufDB8fDB8fHww&ixlib=rb-4.1.0&q=60&w=3000",
    isThumbnail: true,
  },
  {
    productId: seededProducts[2].id,
    imageUrl: "https://images.unsplash.com/photo-1604242692760-2f7b0c26856d?fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGx1eHVyeSUyMHdhdGNofGVufDB8fDB8fHww&ixlib=rb-4.1.0&q=60&w=3000",
  },
  {
    productId: seededProducts[3].id,
    imageUrl: "https://images.unsplash.com/photo-1670404160620-a3a86428560e?fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bHV4dXJ5JTIwd2F0Y2h8ZW58MHx8MHx8fDA%3D&ixlib=rb-4.1.0&q=60&w=3000",
    isThumbnail: true,
  },
  {
    productId: seededProducts[3].id,
    imageUrl: "https://images.unsplash.com/photo-1670404160620-a3a86428560e?fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bHV4dXJ5JTIwd2F0Y2h8ZW58MHx8MHx8fDA%3D&ixlib=rb-4.1.0&q=60&w=3000",
  },
  {
    productId: seededProducts[4].id,
    imageUrl: "https://images.unsplash.com/photo-1508962914676-134849a727f0?fm=jpg&ixid=M3wxMjA3fDB8MHxwcm9maWxlLWxpa2VkfDE3fHx8ZW58MHx8fHx8&ixlib=rb-4.0.3&q=60&w=3000",
    isThumbnail: true,
  },
  {
    productId: seededProducts[4].id,
    imageUrl: "https://images.unsplash.com/photo-1508962914676-134849a727f0?fm=jpg&ixid=M3wxMjA3fDB8MHxwcm9maWxlLWxpa2VkfDE3fHx8ZW58MHx8fHx8&ixlib=rb-4.0.3&q=60&w=3000",
  },
  {
    productId: seededProducts[4].id,
    imageUrl: "https://images.unsplash.com/photo-1633451238208-11c8e6c1fed4?fm=jpg&ixid=M3wxMjA3fDB8MHxwcm9maWxlLWxpa2VkfDEwfHx8ZW58MHx8fHx8&ixlib=rb-4.0.3&q=60&w=3000",
  },
  
]);

// 7. Watches
const seededWatches = await db
  .insert(watches)
  .values([
    {
      productId: seededProducts[0].id, // Rolex Submariner
      brandId: rolex.id,
      model: "Submariner",
      reference: "124060",
      serialNumber: "SN123456",
      year: 2023,
      size: "41mm",
      movement: "Automatic",
      glassType: "Sapphire",
      limited: false,
      box: true,
      papers: true,
      condition: 9,
      braceletType: "Oystersteel",
      braceletColor: "Silver",
      dialColor: "Black",
      vat: 25,
    },
    {
      productId: seededProducts[1].id, // Omega Speedmaster
      brandId: omega.id,
      model: "Speedmaster Professional Moonwatch",
      reference: "310.30.42.50.01.001",
      serialNumber: "SN654321",
      year: 2022,
      size: "42mm",
      movement: "Manual winding",
      glassType: "Hesalite",
      limited: false,
      box: true,
      papers: true,
      condition: 8,
      braceletType: "Steel",
      braceletColor: "Silver",
      dialColor: "Black",
      vat: 25,
    },
    {
      productId: seededProducts[2].id, // Tag Heuer Monaco
      brandId: tagHeuer.id,
      model: "Monaco",
      reference: "CAW211P.FC6356",
      serialNumber: "SN789012",
      year: 2021,
      size: "39mm",
      movement: "Automatic",
      glassType: "Sapphire",
      limited: false,
      box: true,
      papers: false,
      condition: 7,
      braceletType: "Leather",
      braceletColor: "Black",
      dialColor: "Blue",
      vat: 25,
    },
    {
      productId: seededProducts[3].id, // Patek Philippe Nautilus
      brandId: patekPhilippe.id,
      model: "Nautilus",
      reference: "5711/1A-010",
      serialNumber: "SN345678",
      year: 2020,
      size: "40mm",
      movement: "Automatic",
      glassType: "Sapphire",
      limited: false,
      box: true,
      papers: true,
      condition: 9,
      braceletType: "Steel",
      braceletColor: "Silver",
      dialColor: "Blue",
      vat: 25,
    },
    {
      productId: seededProducts[4].id, // Audemars Piguet Royal Oak
      brandId: audemarsPiguet.id,
      model: "Royal Oak",
      reference: "15500ST.OO.1220ST.01",
      serialNumber: "SN987654",
      year: 2023,
      size: "41mm",
      movement: "Automatic",
      glassType: "Sapphire",
      limited: false,
      box: true,
      papers: true,
      condition: 10,
      braceletType: "Steel",
      braceletColor: "Silver",
      dialColor: "Blue",
      vat: 25,
    },
  ])
  .returning();



  // 8. Users
  await db.insert(users).values({
    username: "john_doe",
    email: "john@example.com",
    password: "hashed_password_here", // use bcrypt in production
    emailConfirmed: true,
    role: "customer",
    country: denmark.id,
    addressId: address.id,
    avatarUrl: "https://example.com/avatar.jpg",
  });

  console.log("✅ Seeding completed successfully.");
}


seedDatabase()
  .then(() => console.log("Database seeding completed."))
  .catch((error) => console.error("Error seeding database:", error));