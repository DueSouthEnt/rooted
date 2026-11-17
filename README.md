# Rooted

Rooted is a cut-flower planning app for small plots, allotments, and little farms. You give it a place. It estimates frost dates and hardiness, ranks flowers for that season, lays beds out from plant spacing, and writes a week-by-week job list.

Most of the defaults assume the UK and Europe: metric units, Monday weeks, British English, RHS hardiness next to USDA zones, and the habit of sowing hardy annuals in autumn. It still works for a garden in Oregon or Tasmania.

Frost dates and sowing dates are averages and estimates. The app says so on the screens that use them. A wall, a frost pocket, or a rotten May can all make a nonsense of a median.

## Stack

- Next.js, React, and TypeScript
- Tailwind CSS and shadcn/ui
- Supabase Postgres, with Row Level Security so each account only sees its own farms
- Supabase Auth (email and password)
- SQL migrations and a seed file for the [Supabase CLI](https://supabase.com/docs/guides/cli)
- Vitest for frost-date and task-scheduling logic

The flower catalogue and the scheduling rules live in TypeScript (`data/flowers.ts`, `lib/tasks.ts`) so they can be tested without a database. `npm run db:seed-sql` writes `supabase/seed.sql` from those files. The running app reads the catalogue from Postgres when it has been seeded, and falls back to the built-in list if the table is empty.

## Run it on a Mac, in VS Code

You need three things installed:

1. **Node.js 20.9 or newer** (Node 22 is a safe choice). Install it from [nodejs.org](https://nodejs.org/) or with `nvm`. In VS Code’s terminal, `node -v` should print a version.
2. **Docker Desktop**, running. The Supabase CLI starts Postgres, Auth, and the API in containers. [Install Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/) and wait until it says it is running.
3. **VS Code**, with this folder opened.

Then, in the VS Code terminal, from the project folder:

```bash
npm install
npx supabase start
```

The first `supabase start` downloads images and can take a few minutes. When it finishes it prints an API URL and an `anon` key. Copy them:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=the-anon-key-from-supabase-start
```

Load the schema and the flower/climate seed (this also resets the local database):

```bash
npx supabase db reset
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). Create an account. Local auth does not ask you to confirm the email (`enable_confirmations` is off in `supabase/config.toml`).

`npx supabase stop` shuts the local stack down. Your data is kept until you reset it.

### Tests

```bash
npm test
```

That runs the frost-date, hardiness, place-lookup, recommendation, bed-block layout, and task-scheduling tests. They do not need Docker.

## Use a hosted Supabase project

Do this when you want the app off your laptop. The same migrations and seed run against the hosted database.

1. Create a project at [supabase.com](https://supabase.com).
2. In a terminal, from this folder:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

`db push` applies `supabase/migrations`. It does not run `seed.sql`. Load the catalogue once with either the SQL editor (paste `supabase/seed.sql`) or:

```bash
npx supabase db query --linked -f supabase/seed.sql
```

3. In the hosted project, set **Authentication → URL configuration**:

- Site URL: your real app URL, or `http://127.0.0.1:43123` while you are still on the laptop
- Redirect URLs: include `http://127.0.0.1:43123/auth/callback` and the production `/auth/callback`

4. Put the hosted URL and anon key in `.env.local` (or in the host’s environment when you deploy the Next.js app). Do not put the service role key in `NEXT_PUBLIC_` variables. The app never needs the service role key for normal use.

5. Hosted projects often require email confirmation. Either configure SMTP, or turn off “Confirm email” while you are testing. If confirmation is on, sign-up will ask the person to check their inbox instead of logging them straight in.

### Satellite map

After this update, apply the new migration on the hosted project:

```bash
npx supabase db push --remote
```

That adds `farms.boundary` and `beds.geometry`. Existing row-level security on those tables already covers the new columns. No new secret is required.

### Bed blocks and the home forecast

If you already applied the map migration, run the same command again:

```bash
npx supabase db push --remote
```

The new file is `supabase/migrations/20261115220000_bed_blocks.sql`. It adds a `bed_blocks` table and `beds.block_id` / `beds.block_index`. A block is a set of ordinary beds, so plantings and plant counts stay on each bed. Existing single beds are untouched. No new environment variable.

The signed-in home page reads the Open-Meteo forecast for the farm’s latitude and longitude (free, no key). If the farm has no pin, the weather card asks you to set a place instead of inventing a temperature.

### Year plan

Run the push once more if you already have the earlier migrations:

```bash
npx supabase db push --remote
```

`supabase/migrations/20261115230000_plantings.sql` adds a `plantings` table: sow date, plant-out, bloom window, an optional lift date, and the bed it sits on. Existing crops, beds and tasks stay. No new environment variable. The home page and the year plan both offer “what to sow or plant now” from the farm’s frost dates.

`supabase/migrations/20261115240000_planting_beds.sql` lets one planting occupy several neighbouring beds, and stores days to maturity, nursery weeks, spacing, bed length and notes from the planting dialog. Run the push again. No new secret.

`supabase/migrations/20261116160000_successions.sql` adds `succession_group` and `succession_index` so successive sowings of an annual stay linked. Run `npx supabase db push --remote` again. No new secret.

`supabase/migrations/20261117120000_task_planting.sql` adds `tasks.planting_id`, with a cascade so deleting a planting removes its jobs. Bed links already cascade from `planting_beds`. Existing delete policies on plantings, planting beds and tasks already allow the owner to remove their own rows. Run the push again. No new secret.

Satellite pictures come from Esri World Imagery, which does not need a key. Attribution is on the map. If you later want a different tile service, set an optional public variable and restart the app:

```bash
NEXT_PUBLIC_SATELLITE_TILE_URL=https://example.com/tiles/{z}/{y}/{x}
```

The `{z}`, `{y}` and `{x}` placeholders are required. Leave it unset to keep Esri.

Deploy the Next.js app anywhere that runs Node (a small VPS, or a host that supports `next start`). Set the same two `NEXT_PUBLIC_SUPABASE_*` variables there. `npm run build` then `npm start` listens on port 43123.

## What the app does

- **Accounts.** Email and password. Each person can keep more than one farm.
- **Place and frost.** UK postcode, European town, or a pin on the map. The primary estimate is ten years of Open-Meteo daily minimum temperatures, with frost counted at 0°C. A bundled set of reference places (densest in the UK and Europe) is the fallback if that request fails. Dates, RHS rating, USDA zone, and the summer character can all be overridden.
- **Flowers.** More than 70 cut-flower crops: annuals, biennials, perennials, bulbs, tubers, corms, and a few shrubs. Each record has hardiness, sowing method, weeks relative to frost, germination, days to flower, spacing, pinch and support, harvest stage, vase life, pests, and what to do with tender plants in winter.
- **Recommendations.** Crops are scored against season length, summer heat, and hardiness. A starter mix prefers easy plants and, in a mild climate, an autumn-sown hardy annual plus a filler.
- **Beds.** You set the size in metres (or feet, if you switch units). The app counts plants from in-row and between-row spacing, suggests tall plants on the north side (south side in the southern hemisphere), and keeps perennials out of beds you plan to clear.
- **Farm map.** Outline the land on satellite pictures, draw one bed, or drag a bed block: parallel beds with a path between them, numbered along the edge. Each stripe is a real bed, so a planting still belongs to one of them.
- **Home.** The signed-in page leads with today’s weather from the Open-Meteo forecast (temperature, conditions, high and low, rain, wind, the next seven days, and a frost badge if any night is at or below 0°C), then the jobs and the season.
- **Calendar.** Indoor sowings, hardening off, planting out, autumn sowings of hardy annuals, successions, pinching, support, feeding, cutting, deadheading, lifting dahlias, and dividing perennials. Tick jobs off. “This week” starts on Monday.

Units default to metric. The header switches to inches and Fahrenheit; the choice is stored on your profile.

## Where the numbers come from

These are planning figures, not a promise about your bed.

- **Frost dates and a rough USDA zone** are calculated from [Open-Meteo](https://open-meteo.com/) historical weather (2015–2024 daily minimum and maximum). A frost day is a day with a minimum at or below 0°C. The zone uses the average of each year’s coldest minimum, mapped with the USDA zone temperature bands. Open-Meteo’s archive is model data (ERA5 / ERA5-Land). It will miss a frost pocket and a warm wall. Weather data by Open-Meteo.com.
- **RHS ratings** (H1a–H7) use the temperature bands published by the [Royal Horticultural Society](https://www.rhs.org.uk/advice/rhs-hardiness-rating): H2 is about 1 to 5°C, H3 down to about −5°C, H4 to −10°C, H5 to −15°C, H6 to −20°C, H7 colder than that. A plant rated H5 is treated as able to take a site whose winter sits in H5 or milder.
- **Place search** uses a built-in list of towns and outward postcodes, then [Nominatim](https://nominatim.org/) / OpenStreetMap. Map tiles are © OpenStreetMap contributors.
- **How to grow the flowers** is compiled from RHS plant profiles, Johnny’s Selected Seeds grower notes, Floret Flowers’ cultural notes, and ordinary UK cut-flower practice: sweet peas and other hardy annuals sown in autumn under cover, dahlias planted after the last frost and lifted where winters are colder than H3, tulips planted late autumn and pre-chilled where winters are too mild. Spacing and days-to-flower are typical ranges for cut-flower varieties, not a guarantee for every cultivar. Variety names (Benary’s Giant, Café au Lait, La Belle Époque, and so on) are examples of the sort of thing people grow for cutting.

Poisonous plants that are still standard cuts (sweet peas, larkspur, foxgloves, delphiniums) are marked as such. Opium poppy is not in the catalogue.

## Project layout

| Path | What it is |
| --- | --- |
| `app/` | Pages: account, farm, flowers, beds, week |
| `lib/climate.ts`, `lib/tasks.ts`, `lib/recommend.ts`, `lib/beds.ts` | The rules, covered by tests |
| `data/flowers.ts` | The catalogue |
| `data/stations.ts` | Reference places, mostly UK and Europe |
| `data/climate-cache.json` | Open-Meteo summaries for those places |
| `supabase/migrations` | Schema, auth trigger, row-level security |
| `supabase/seed.sql` | Flowers and reference climates |
| `lib/brand.ts` | The product name. Change `APP_NAME` to rename the interface. Also update `package.json` `"name"` and this title if you want those to match. |

Refresh the climate cache (needs the network):

```bash
npm run climate:refresh
npm run db:seed-sql
```

## Limits, and what to do next

- The frost figure is a median of recent years, not this year’s forecast, and not a soil temperature.
- RHS and USDA describe cold hardiness. They don’t describe summer heat, wet clay, or wind. The summer tag is only a rough split from the warmest month.
- Timings are for outdoor and cold-frame growing, not a heated glasshouse programme.
- One login is one person. There is no shared farm, no photo record, and no cost-per-stem.
- Email delivery on a hosted project needs your own SMTP if you want confirmation mail.

Sensible next steps: export the week to a calendar file, remember soil and rainfall, split varieties into their own records, and let two people edit one farm.
