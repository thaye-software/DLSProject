import { db } from '../../src/database/drizzle.ts';
import { users, countries } from '../../src/database/schema.ts';

await db.insert(countries).values([
  { name: 'Denmark', abbreviation: 'DK', currency: 'DKK' },
  { name: 'USA', abbreviation: 'US', currency: 'USD' }
]);

await db.insert(users).values([
  { username: 'alice', email: 'alice@test.com', password: 'hashed_pw', country: 1 },
  { username: 'bob', email: 'bob@test.com', password: 'hashed_pw', country: 1 }
]);
