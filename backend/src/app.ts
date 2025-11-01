import express from "express";
import { db } from "../drizzle/drizzle.ts";
import { users } from "../drizzle/schema.ts";

const PORT = process.env.PORT || 3000;

const app = express();

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    // Test the database connection
    const allUsers = await db.select().from(users);
    console.log("All Users:", allUsers);
    console.log("Database connected successfully!");
  } catch (error) {
    console.error("Database connection failed:", error);
  }
});
