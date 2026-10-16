# Security policy

## What AAT does and does not do

- The tool runs only for admins. Visitors never download its code.
- It reads the page and never changes it.
- Notes are stored in the browser's localStorage only.
- The only network call is the screenshot upload to your own app's `/api/dev/aat-shot` route, and only on localhost.
- That route answers only on `localhost` or `127.0.0.1`, never on Netlify or Vercel, only for admins, only PNG files named `aat-[a-z0-9-]{4,60}.png`, at most 8 MB. It denies every request until you wire your own admin check.

## Things to check when you install it

- Wire `isAdmin()` in `route.ts` to your real admin check.
- If you host somewhere other than Netlify or Vercel, add that platform's environment variable to the first check in `route.ts`, so the route can never write files in production.
- Add `.data/` to your `.gitignore`.
- Prompts can contain page text. Do not paste prompts from pages with private customer data into tools you do not trust.

## Reporting a vulnerability

Please report it privately through GitHub's **Report a vulnerability** button on the [Security tab](https://github.com/adigold/AAT-Tool/security/advisories/new). Include the steps to reproduce and the affected file. You will get an answer as soon as possible, and credit in the fix if you want it.
