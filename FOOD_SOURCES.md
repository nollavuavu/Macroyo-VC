# Macroyo food sources (v3)

This file documents where `foods_v3_i18n.{json,csv}` nutrient values come from, the licences that allow reuse in a commercial app, and the new `source_ref` column. It does not change how the v2 rows (ids 1–1555) were built.

## Column additions in v3

`foods_v3_i18n` is `foods_v2_i18n` plus new foods. The original twelve nutrient columns, plus `name_vi`, `name_fi`, `needs_review`, and `review_note`, are unchanged for ids 1–1555.

A new column, `source_ref`, was added:

- For **existing** rows (ids 1–1555) it is empty. Those rows already carry a numeric USDA `fdc_id`.
- For **new** rows it is a stable public URL that identifies the exact source food:
  - USDA: `https://fdc.nal.usda.gov/food-details/{fdc_id}/nutrients`
  - Fineli: `https://fineli.fi/fineli/en/elintarvikkeet/{FOODID}`
- New Fineli rows use `source = "Fineli (THL)"` and `fdc_id = "fineli:{FOODID}"` (a string). USDA rows keep an integer `fdc_id` and the usual FDC source labels (`USDA FDC Foundation`, `USDA FDC SR Legacy`, `USDA FDC FNDDS`).

CSV is UTF-8 with BOM, Excel dialect, CRLF line endings, same as v2.

## USDA FoodData Central (ids 1–1555 and new USDA rows)

- **Licence:** United States government work / public domain (CC0-equivalent). There are no restrictions on reuse, including in a commercial app.
- **Statement and data:** [FoodData Central](https://fdc.nal.usda.gov/), [download datasets](https://fdc.nal.usda.gov/download-datasets)
- **Public-domain policy:** [U.S. government works](https://www.usa.gov/government-works)
- **CC0 (explicit for some USDA nutrition datasets):** [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- **Local raw files used here:**
  - Foundation Foods 2026-10-29 JSON
  - SR Legacy 2018-04 CSV
  - FNDDS / Survey Foods 2021–2023, JSON extracted from `FoodData_Central_survey_food_json_2024-10-31.zip`

Macros are copied from the USDA files (nutrient ids 1008 energy kcal, 1003 protein, 1005 total carbohydrate, 1004 fat, 1079 fiber). Nothing is estimated or derived from a recipe. Carbohydrate is USDA *total* carbohydrate (includes fibre). Servings are official household portions from the same files; if none is usable the label is `100 g`.

## Fineli (Finnish Institute for Health and Welfare / THL)

- **Licence:** Creative Commons Attribution 4.0 ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). Commercial reuse is allowed with attribution.
- **Official open-data pages:**
  - English: [https://fineli.fi/fineli/en/avoin-data](https://fineli.fi/fineli/en/avoin-data)
  - Finnish: [https://fineli.fi/fineli/fi/avoin-data](https://fineli.fi/fineli/fi/avoin-data)
  - Method note (ohje 19, updated 2026-04-09): [https://fineli.fi/fineli/en/ohje/19](https://fineli.fi/fineli/en/ohje/19)
- **Official zip endpoints** (Basic package 1, 55 components; Basic package 2, 74 components):
  - [https://fineli.fi/fineli/content/file/47](https://fineli.fi/fineli/content/file/47)
  - [https://fineli.fi/fineli/content/file/49](https://fineli.fi/fineli/content/file/49)
- **Required attribution:** “Finnish Institute of Health and Welfare, Fineli” / “Terveyden ja hyvinvoinnin laitos, Fineli”.

### Carbohydrate rule (stated here, not in `review_note`)

Fineli publishes *available carbohydrate* (`CHOAVL`) and *fibre* (`FIBC`) separately. To match USDA total-carbohydrate semantics used in the rest of the catalog:

```
carbs_per_100g = CHOAVL + FIBC
```

Energy is Fineli `ENERC` (kJ) divided by 4.184 and rounded to two decimals. Protein, fat, and fibre are `PROT`, `FAT`, and `FIBC`.

Fineli calculates `ENERC` with EU Regulation 1169/2011 factors (kJ/g): protein 17, available carbohydrate 17, fat 37, fibre 8, alcohol 29, organic acids 13, polyols 10. That is why some Fineli rows deviate from classic Atwater 4/4/9; those rows are not flagged when the EU (or fibre/alcohol-adjusted) reconstruction explains the stored kcal. A row is flagged only when the source energy is still outside tolerance after that check.

### Energy check (Fineli rows in the frozen 1800-row catalog)

Stored Fineli kcal is always `ENERC` (kJ) / 4.184. A row is classified as:

- *(a)* matches classic Atwater 4P+4C+9F within 15% or 10 kcal;
- *(b)* explained by fibre/alcohol-adjusted Atwater (2 kcal/g fibre, 7 kcal/g alcohol);
- *(c)* explained by EU 1169/2011 reconstruction (the factors Fineli uses);
- *(d)* unexplained, or the source `ENERC` is inconsistent with the EU sum of listed components — these are flagged.

The check for the 208 Fineli rows already in `foods_v3_i18n` (ids 1556–1763 range of the first pass) is in `foods_v3_energy_check.csv`:

- 198 match 4P+4C+9F;
- 6 are explained by fibre/alcohol-adjusted 4/4/9;
- 3 are explained by EU 1169/2011 factors;
- 1 is unexplained: id 1658, Fineli FOODID 945, Mulled wine (glögi). Stored kcal is 84.89; EU reconstruction is 58.7 (difference 26.2). `ENERC` does not match the EU sum of the listed components (a source-internal inconsistency, also seen in Rel18). The stored kcal was not altered. The existing `review_note` on id 1658 was left unchanged because ids 1–1800 are frozen.

A scan of all 4,238 foods in the 2025 Fineli snapshot found only three large `ENERC`-vs-EU gaps (>10 kcal): FOODID 945 (glögi, already in the catalog), 34797 (salty liquorice pastille, unsweetened), and 177 (mixed/wild rice, boiled). Those last two are not in the 1800-row catalog.


### Provenance of the files used in this build (off-plan vs a live official zip)

Live `fineli.fi` returned HTTP 403 (Cloudflare) from this environment, so the official Rel20/current zip was not downloaded here. Macros were **not** scraped from HTML and were **not** taken from processed third-party dumps.

- **Macros:** official-format semicolon CSVs (55-component / package-1 shape) dated 2025-03-31, committed in [rho-group/vegetable-tracker](https://github.com/rho-group/vegetable-tracker) (`raw data/`), which cites Fineli open data as the basis. 4,238 foods (the official site advertised 4,232 as of 2026-04-09). Stored locally as `raw/fineli/open_2025/`.
- **Finnish names and household measures:** the complete official-format Rel18 package redistributed by [mafredri/fineli-sql](https://github.com/mafredri/fineli-sql) (CC BY), used only when the `FOODID` also exists in the 2025 snapshot. Stored as `raw/fineli/Fineli_Rel18_open/`. 2025-only foods fall back to a sentence-cased Finnish `FOODNAME` and a `100 g` serving if no Rel18 portion exists.

Licence text on the official open-data pages was confirmed from the 2026-10-30 Wayback copies of the EN/FI pages. See `raw/fineli/PROVENANCE.txt`.

Named brand SKUs (Valio, Fazer, Pirkka, Rainbow, Atria, Saarioinen, and similar) were not added. Generic “industrial average” / homemade formulations without a brand name were allowed. `(ARC)` archived foods, infant foods, and supplements were skipped.

## Open Food Facts (Vietnamese dishes, ids 1801+)

Việt chose [Open Food Facts](https://world.openfoodfacts.org) as the licensed source for Vietnamese dishes that were not already in the catalog and are not in USDA or Fineli.

- **Licence:** Open Database License (ODbL) 1.0. See [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) and [Open Food Facts terms of use](https://world.openfoodfacts.org/terms-of-use).
- **Required attribution:** © Open Food Facts contributors, ODbL 1.0, [https://world.openfoodfacts.org](https://world.openfoodfacts.org).
- **Share-alike note:** ODbL includes a share-alike condition. That condition may extend to a database derived by mixing Open Food Facts rows into this catalog. The OFF-derived rows are also kept on their own in `foods_v3_off.{json,csv}`. This paragraph records the licence terms as published; it is not a legal conclusion about how share-alike applies to a mixed catalog.

### What was used

Macros come from the official English CSV dump hosted by Open Food Facts (`en.openfoodfacts.org.products.csv.gz`, last-modified 2026-11-07 on the project’s data export). The dump was downloaded once with User-Agent `MacroyoCatalog/1.0 (local nutrition catalog build; ODbL reuse; contact via open food facts data-reuse context)` and filtered locally. Live search was used only for a light API check; the catalog values were not taken from ad-hoc HTML scraping.

A product was used only when it had complete per-100 g energy, protein, carbohydrate and fat. Fibre was stored when present. Values were not invented or estimated from recipes. Spice cubes, flours, plain noodles, broths, sauces, and obvious meaning-duplicates of catalog rows (prepared beef pho ≈ id 1335; gỏi cuốn / summer rolls ≈ id 1288; rice paper ≈ id 1764) were not added as the dish.

Each added row is a **median** of the matching complete products (method and `n` are in `source_ref`, with every barcode and product URL used). If `n < 3`, or the values vary widely, `needs_review` is set. Instant dry packs and as-served soups were never averaged together.

### Carbohydrate conversion (stated here, not used as a legal opinion)

In EU nutrition labelling, the carbohydrate figure typically excludes fibre. This catalog uses USDA-style *total* carbohydrate (includes fibre). Where an OFF product has fibre, carbohydrates were converted as:

```
carbs_per_100g = carbohydrates_100g + fiber_100g
```

except when `carbohydrates-total_100g` already equals `carbohydrates_100g` (fibre not added again), or when the product is labelled in the US/Canada/Australia/New Zealand style, where `carbohydrates_100g` already includes fibre. Rows that are missing fibre are flagged; their carbohydrate figure is the published `carbohydrates_100g` and may be available carbohydrate only.

### Sources checked for Vietnamese dishes and not used

| Source | Result |
| --- | --- |
| Vietnam Food Composition Table (NIN / Medical Publishing House, 2007 and 2017) | Copyrighted; no clear commercial-reuse licence. **Not used.** |
| Fineli | No additional Vietnamese dishes beyond what was already considered in the first v3 pass. |
| USDA FNDDS, SR Legacy, Foundation (CC0 / public domain) | Already used in the first v3 pass for rice paper / bánh tráng (FNDDS 2708166) and cooked mung-bean / long rice noodles (FNDDS 2708355). Prepared “Pho with meat”, vegetarian phở, gỏi cuốn, and fried spring rolls were already in v2 and were not duplicated. |

**Vietnamese dishes still not found** as complete, clearly matching OFF products (nothing was invented): cơm tấm, cơm gà, bún riêu, bún thịt nướng, bánh bèo, bánh bột lọc, thịt kho, canh chua (as the soup, not a powder), bò kho (as the stew, not a cube), mì Quảng, cao lầu, nem nướng, and most other street-food plates. A generic restaurant-style bún chả (Hanoi grilled pork) was not added: the only trusted complete entry was a chicken bun cha, which is listed separately.


## Everyday international foods still not in USDA Foundation / SR Legacy / FNDDS

These were looked up and are **not** in those datasets (so they were not invented): halloumi, labneh, gochujang, mirin, udon, seitan, harissa, kalamata olives as a named food, tonkatsu, Arctic char / nieriä / rautu (also absent from Fineli), sahti, and mesimarja (arctic bramble).

## Rebuild and validation

- First 1800-row v3 catalog (USDA + first Fineli pass): `build_foods_v3.py` (helpers under `v3_build/`). Frozen snapshot: `foods_v3_i18n_1800_frozen.{json,csv}`. Ids 1–1800 must stay identical to that snapshot.
- Open Food Facts Vietnamese append (ids 1801+): `build_foods_v3_off.py` (classifier `v3_build/off_dishes.py`, dump scan `v3_build/off_scan.py`). Isolated OFF files: `foods_v3_off.{json,csv}`. Source products used in the medians: `raw/off/used_products.json`.
- Validator: `validate_foods_v3.py` (independent re-read of the raw USDA and Fineli files, plus rematch of OFF medians from `used_products.json`; it also checks ids 1–1800 against the frozen snapshot).
- Added-row index for the first 1800-row pass: `foods_v3_added.csv`
- Meaning-duplicates skipped against the v2 catalog (first pass): `foods_v3_skipped_duplicates.csv`
- English-fallback log (v2 rows plus new ones): `foods_v3_i18n_english_fallback.csv`
- Fineli energy-check table: `foods_v3_energy_check.csv`

Ids 1–1555 must remain field-identical to `foods_v2_i18n`. Ids 1–1800 must remain field-identical to `foods_v3_i18n_1800_frozen`. A broader Fineli expansion (branded SKUs and further variants after id 1800) was prepared but not written into the catalog in this deadline pass. This build does not replace app assets, does not produce an APK, and is local only.
