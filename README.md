# Macroyo

Macroyo is a local meal and macro tracker. You log food, compare the day with your calorie and macro targets, and check BMI, FFMI, and a calorie-offset weight projection. Nothing leaves the device: there is no account and no server.

Expo SDK **58** (`expo@58.0.21`), Expo Router, TypeScript.

## Run it

```bash
npm install
npm test
npx tsc --noEmit
npx expo start --web
```

The web app opens in the browser. On a phone, install Expo Go, join the same Wi-Fi as the computer running `npx expo start`, and scan the QR code. If the phone cannot see the computer, use `npx expo start --tunnel`.

The first launch is onboarding. After that, data stays in SQLite on iOS and Android, and in AsyncStorage (localStorage) on web. `expo-sqlite` on web needs a WASM build that is awkward to ship, so the web target uses AsyncStorage on purpose.

## Food file

`assets/foods.json` is the catalog (622 USDA foods). Swap the file and keep the loader at `src/lib/foods/foods.ts`. The loader accepts this shape and a few aliases (`kcal` / `calories`, `protein` / `protein_g`, and the same idea for carbs, fat, and fiber). Invalid rows are skipped. Fiber may be `null`; that is unknown, not zero.

```json
[
  {
    "id": 1,
    "name": "Bacon, baked",
    "brand": "optional",
    "category": "meat",
    "serving_label": "1 slice cooked",
    "serving_size_g": 8.1,
    "kcal_per_100g": 548,
    "protein_per_100g": 35.73,
    "carbs_per_100g": 1.35,
    "fat_per_100g": 43.27,
    "fiber_per_100g": 0,
    "source": "USDA FDC SR Legacy",
    "fdc_id": 167914
  }
]
```

Search ignores case and punctuation. Every word you type has to match the start of a word in the name, in any order, so “baked bacon” finds “Bacon, baked”. Exact and starts-with matches come first, then shorter names.

## Theme

Design tokens live in `src/theme/theme.ts`. Screens call `getTheme(scheme)`.

- `getTheme(scheme)` returns colors, `macroColors`, `macroTextColors`, typography, `fontFamilies`, spacing, radii, sizes, shadows, and motion.
- Fills (`protein`, `success`, `warning`, `accent`) are for bars, rings, and chips.
- Text uses `proteinText`, `carbsText`, `fatText`, `successText`, `warningText`, and `accentText`. Do not put the lime `accent` on a light background as text.
- `motion.toast` is the undo duration in milliseconds. `motion.springDamping` is the sheet spring.
- Fonts are Inter, Inter Tight, and DM Mono from `@expo-google-fonts`, loaded before the splash screen hides.

## Formulas

Pure functions and tests are in `src/lib/domain`. `npm test` loads `proj_test_vectors.json` (15 cases) plus the boundary checks from `proj.py --selftest`.

- BMI, WHO classes, FFMI, and normalized FFMI. FFMI bands are shown for men only.
- BMR is Mifflin–St Jeor, or Katch–McArdle when body fat is entered. Unspecified sex uses the average Mifflin constant (−78) and the 1,500 kcal floor.
- TDEE is BMR times an activity factor (1.2, 1.375, 1.55, 1.725, 1.9).
- A cut is maintenance −20%, maintain is maintenance, a bulk is maintenance +10%.
- Protein is 2.2 g/kg on a cut and 1.8 g/kg otherwise. Fat starts at 25% of calories, at least 0.8 g/kg on a cut, and never under the larger of 20% of calories and 0.6 g/kg. Carbs fill the rest.
- Calorie floors are 1,500 kcal for men and 1,200 for women, and never under BMR. A cut is not offered when BMI is under 18.5, or when the safe deficit is under 100 kcal.
- Weight projections: 7,700 kcal per kg, pounds = kilograms × 2.20462. One week and one month are static. Three months, six months, and one year recompute Mifflin–St Jeor every 7 days. Losses stop at BMI 18.5.

## Not in v1

Barcode scanning, accounts, cloud sync, notifications, Health, recipes, and the Hall/NIH body-weight model. A goal weight does not stop the projection; the reference model does not take one.

Notifications are a v2 item. The icon is already at `assets/notification-icon.png`. Do not add `expo-notifications` for v1 (it warns in Expo Go). When you do:

```json
["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#0E6B5C" }]
```

This is general information, not medical advice.
