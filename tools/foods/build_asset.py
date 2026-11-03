#!/usr/bin/env python3
"""Build assets/foods.json from Heisenberg's foods_v2_i18n.json.

    python3 tools/foods/build_asset.py /workspace/macro-app/foods_v2_i18n.json \
        --v2 /workspace/macro-app/foods_v2.json

- Checks that ids, order, English names and all v2 columns are identical to foods_v2.json (exit 1 if not).
- Drops needs_review and review_note (review metadata, not shipped in the app bundle).
- Writes the same pretty-printed layout as the source (indent 1, UTF-8), so `git diff` shows one line per changed name.
"""
import argparse, json, pathlib, sys

DROP = ('needs_review', 'review_note')
ASSET = pathlib.Path(__file__).resolve().parents[2] / 'assets' / 'foods.json'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('--v2', help='foods_v2.json to compare ids, English names and macros against')
    ap.add_argument('--out', default=str(ASSET))
    args = ap.parse_args()
    rows = json.load(open(args.source, encoding='utf-8'))
    if args.v2:
        v2 = json.load(open(args.v2, encoding='utf-8'))
        if [r['id'] for r in rows] != [r['id'] for r in v2]:
            print('ids or order differ from foods_v2', file=sys.stderr)
            return 1
        bad = [(a['id'], k) for a, b in zip(v2, rows) for k in a if a[k] != b.get(k) or type(a[k]) is not type(b.get(k))]
        if bad:
            print('columns differ from foods_v2:', bad[:10], file=sys.stderr)
            return 1
    flagged = sum(1 for r in rows if r.get('needs_review'))
    out = [{k: v for k, v in r.items() if k not in DROP} for r in rows]
    with open(args.out, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print(f'{len(out)} rows written to {args.out}; dropped {DROP}; needs_review was true on {flagged} rows')
    return 0


if __name__ == '__main__':
    sys.exit(main())
