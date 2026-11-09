# finite-watches

Exam project for Finite Watches by the project team

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Right after cloning the project run the following commands:

```bash
npm i
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Spin up local supabase databse

prerequisites:

- have docker desktop installed and running.

Only the very first time after cloning the project initilise the local supabase databse:

```bash
npm run supabase:init
```

To start/stop do:

```bash
npm run supabase:start
npm run supabse:stop
```

## Playwright tests commands

Inside that directory, you can run several commands:

npx playwright test
Runs the end-to-end tests.

npx playwright test --ui
Starts the interactive UI mode.

npx playwright test --project=chromium
Runs the tests only on Desktop Chrome.

npx playwright test example
Runs the tests in a specific file.

npx playwright test --debug
Runs the tests in debug mode.

npx playwright codegen
Auto generate tests with Codegen.

We suggest that you begin by typing:

    npx playwright test

And check out the following files:

- .\playwright_tests\example.spec.ts - Example end-to-end test
- .\playwright.config.ts - Playwright Test configuration

Visit https://playwright.dev/docs/intro for more information. ✨

Happy hacking! 🎭

## Jest tests commands

For running all jests test you can simply do:

```bash
npm run test
```

⚠️ Safety note: To avoid accidental deletion of your development database, tests must run against a dedicated test database. Set the `DATABASE_URL_TEST` environment variable before running tests. Example:

```bash
export DATABASE_URL_TEST="postgresql://postgres:postgres@127.0.0.1:54322/finite_watches_test"
npm run test
```

The test utilities will refuse to run if `DATABASE_URL_TEST` is not set, or if the DB name looks like a non-test DB (e.g., `postgres`). If you intentionally want to bypass the DB name check, you can set `DISABLE_REQUIRE_TEST_DB_NAME=true`, but use with caution.

To only run either unit or integration test do the following:

```bash
npm run test:unit
npm run test:integration
```

You can also watch jest in progress using this command:

```bash
npm run test:watch
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
