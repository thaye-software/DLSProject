import { db } from "@/database/drizzle";
// import { seed } from "drizzle-seed";
import { sql } from "drizzle-orm";
import { users, watches, products, productImages, addresses, brands, currencies, countries } from "./schema.ts";

/*
At the moment seed script wont work with this import type in envConfig.ts file:
import { loadEnvConfig } from "@next/env";


change to this as a workaround, then switch back when db has been seeded:

import pkg from '@next/env';
const { loadEnvConfig } = pkg;
*/

async function seedDatabase() {

    await db.execute(sql`
        TRUNCATE TABLE
            addresses,
            users,
            countries,
            brands,
            products,
            product_images,
            watches,
            currencies
        RESTART IDENTITY CASCADE
        `);

    await seed();
    // await seedCurrencies();
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

  const [danishCurrency] = await db.insert(currencies).values(
    {
      code: "DKK",
      exchangeRate: "1.000000",
      isActive: true,
      updatedAt: new Date(),
    }
  ).returning();

  const [euroCurrency] = await db.insert(currencies).values(
    {
      code: "EUR",
      exchangeRate: "0.134000", // Example rate: 1 DKK = 0.134 EUR
      isActive: true,
      updatedAt: new Date(),
    }   
  ).returning();

 

  // 1. Countries
  const [denmark] = await db
    .insert(countries)
    .values({
      name: "Denmark",
      abbreviation: "DK",
      currencyId: danishCurrency.id
    })
    .returning();
    
    const [germany] = await db
    .insert(countries)
    .values({
      name: "Germany",
      abbreviation: "DE",
      currencyId: euroCurrency.id
    })
    .returning();

  // 2. Addresses
  const [address] = await db
    .insert(addresses)
    .values({
      userId: crypto.randomUUID(), 
      address1: "Strandgade 12",
      city: "Copenhagen",
      zipCode: "1401",
      stateProvince: "Capital Region",
    })
    .returning();

  // 4. Brands
const [rolex] = await db
  .insert(brands)
  .values({
    name: "Rolex",
    slug: "rolex",
    country: "Switzerland",
    addressLine1: "Rue François-Dussaud 3-5-7",
    addressLine2: "",
    city: "Geneva",
    zipCode: "1211",
    phoneNumber: "+41 22 300 20 20",
    website: "https://www.rolex.com",
  })
  .returning();

const [omega] = await db
  .insert(brands)
  .values({
    name: "Omega",
    slug: "omega",
    country: "Switzerland",
    addressLine1: "11 Rue des Moulins",
    addressLine2: "",
    city: "Biel/Bienne",
    zipCode: "2502",
    phoneNumber: "+41 32 343 65 11",
    website: "https://www.omegawatches.com",
  })
  .returning();

const [tagHeuer] = await db
  .insert(brands)
  .values({
    name: "Tag Heuer",
    slug: "tag-heuer",
    country: "Switzerland",
    addressLine1: "Rue Jean-Pierre Vaucher 3",
    addressLine2: "",
    city: "La Chaux-de-Fonds",
    zipCode: "2300",
    phoneNumber: "+41 32 343 65 11",
    website: "https://www.tagheuer.com",
  })
  .returning();

const [patekPhilippe] = await db
  .insert(brands)
  .values({
    name: "Patek Philippe",
    slug: "patek-philippe",
    country: "Switzerland",
    addressLine1: "Rue du Rhône 41",
    addressLine2: "",
    city: "Geneva",
    zipCode: "1204",
    phoneNumber: "+41 22 311 95 11",
    website: "https://www.patek.com",
  })
  .returning();

const [audemarsPiguet] = await db
  .insert(brands)
  .values({
    name: "Audemars Piguet",
    slug: "audemars-piguet",
    country: "Switzerland",
    addressLine1: "Route de France 16",
    addressLine2: "",
    city: "Le Brassus",
    zipCode: "1348",
    phoneNumber: "+41 21 863 36 36",
    website: "https://www.audemarspiguet.com",
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
      stock: 15,
    },
    {
      productType: "watch",
      name: "Speedmaster",
      priceDkk: 6200000,
      description: "The legendary chronograph that went to the moon.",
      stock: 23,
    },
    {
      productType: "watch",
      name: "Monaco",
      priceDkk: 4900000,
      description: "Distinctive square case with racing heritage.",
      stock: 44,
    },
    {
      productType: "watch",
      name: "Nautilus",
      priceDkk: 28000000,
      description: "A luxury sports watch with timeless elegance.",
      stock: 23,
    },
    {
      productType: "watch",
      name: "Royal Oak",
      priceDkk: 31000000,
      description: "Iconic octagonal bezel and refined craftsmanship.",
      stock: 12,
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
      slug: rolex.slug + "-submariner-" + seededProducts[0].id,
      brandId: rolex.id,
      model: "Submariner",
      reference: "124060",
      serialNumber: "SN123456",
      year: 2023,
      size: 41,
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
      slug: omega.slug + "-speedmaster-professional-moonwatch-" + seededProducts[1].id,
      brandId: omega.id,
      model: "Speedmaster Professional Moonwatch",
      reference: "310.30.42.50.01.001",
      serialNumber: "SN654321",
      year: 2022,
      size: 42,
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
      slug: tagHeuer.slug + "-monaco-" + seededProducts[2].id,
      brandId: tagHeuer.id,
      model: "Monaco",
      reference: "CAW211P.FC6356",
      serialNumber: "SN789012",
      year: 2021,
      size: 39,
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
      slug: patekPhilippe.slug + "-nautilus-" + seededProducts[3].id,
      brandId: patekPhilippe.id,
      model: "Nautilus",
      reference: "5711/1A-010",
      serialNumber: "SN345678",
      year: 2020,
      size: 40,
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
      slug: audemarsPiguet.slug + "-royal-oak-" + seededProducts[4].id,
      brandId: audemarsPiguet.id,
      model: "Royal Oak",
      reference: "15500ST.OO.1220ST.01",
      serialNumber: "SN987654",
      year: 2023,
      size: 41,
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
    id: crypto.randomUUID(),
    username: "Chris",
    email: "chye0001@stud.ek.dk",
    role: "customer",
    countryId: denmark.id,
    addressId: address.id,
    avatarUrl: "https://example.com/avatar.jpg",
  });

  console.log("✅ Seeding completed successfully.");
}


seedDatabase()
  .then(() => console.log("Database seeding completed."))
  .catch((error) => console.error("Error seeding database:", error));