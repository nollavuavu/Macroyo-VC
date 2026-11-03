#!/usr/bin/env python3
"""Apply Nacho's Vietnamese review (foods_v2_i18n_vi_review.csv) to assets/foods.json.

    python3 tools/foods/apply_vi_review.py /workspace/macro-app/foods_v2_i18n_vi_review.csv \
        --fallback /workspace/macro-app/foods_v2_i18n_english_fallback.csv

CSV columns: id, name_vi_old, name_vi_new, reason. Per row:
  noop      the asset already has name_vi_new (the generator already folded it in)
  applied   the asset has name_vi_old, or any other name that is not an intentional English fallback
  skipped   the vi name is an intentional English fallback (listed in the fallback CSV): the English name stays
  missing   no such id
Rows whose current value is not name_vi_old are reported as "differs". Only name_vi changes; nothing else is touched.
"""
import argparse, csv, json, pathlib, sys

ASSET = pathlib.Path(__file__).resolve().parents[2] / 'assets' / 'foods.json'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('review')
    ap.add_argument('--fallback')
    ap.add_argument('--asset', default=str(ASSET))
    args = ap.parse_args()
    rows = json.load(open(args.asset, encoding='utf-8'))
    by_id = {r['id']: r for r in rows}
    fallback = set()
    if args.fallback:
        fallback = {(int(r['id']), r['language']) for r in csv.DictReader(open(args.fallback, encoding='utf-8-sig'))}
    counts = {'noop': 0, 'applied': 0, 'skipped': 0, 'missing': 0}
    differs = []
    for r in csv.DictReader(open(args.review, encoding='utf-8-sig')):
        food = by_id.get(int(r['id']))
        if food is None:
            counts['missing'] += 1
            print('missing', r['id'])
            continue
        current, old, new = food['name_vi'], r['name_vi_old'], r['name_vi_new']
        if current == new:
            counts['noop'] += 1
            continue
        if current != old:
            differs.append((r['id'], current, old, new))
        if (food['id'], 'vi') in fallback and current == food['name']:
            counts['skipped'] += 1
            print(f"skipped {r['id']}: intentional English fallback {current!r} (CSV wanted {new!r})")
            continue
        food['name_vi'] = new
        counts['applied'] += 1
        print(f"applied {r['id']}: {current!r} -> {new!r}")
    for d in differs:
        print('differs from CSV "before":', d)
    with open(args.asset, 'w', encoding='utf-8') as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print(counts, 'differs-from-before:', len(differs))
    return 0


if __name__ == '__main__':
    sys.exit(main())
