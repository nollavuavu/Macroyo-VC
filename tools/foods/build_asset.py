#!/usr/bin/env python3
"""Build assets/foods.json from Heisenberg's foods_v3_i18n.json (also accepts v2).

Swap in an updated catalog (one step, then re-run tests):

    python3 tools/foods/build_asset.py /workspace/macro-app/foods_v3_i18n.json \
        --v2 /workspace/macro-app/foods_v2.json
    npm test && npx tsc --noEmit

- Accepts a v2 or v3 (or later) i18n catalog. Rows after the v2 prefix are kept.
- If --v2 is given, the first N rows must have the same ids, order, English names
  and v2 columns as foods_v2.json (exit 1 if not). Additional rows are allowed
  and must not reuse a v2 id.
- Drops needs_review, review_note and source_ref (review/provenance metadata,
  not shipped in the app bundle).
- Writes the same pretty-printed layout as earlier assets (indent 1, UTF-8).
- Prints the source path, sha256, mtime, row counts and the output path.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import sys
import time

DROP = ('needs_review', 'review_note', 'source_ref')
ASSET = pathlib.Path(__file__).resolve().parents[2] / 'assets' / 'foods.json'
STAMP = pathlib.Path(__file__).resolve().parent / 'LAST_IMPORT.txt'


def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('source', help='Heisenberg catalog JSON (foods_v3_i18n.json or later)')
    ap.add_argument('--v2', help='foods_v2.json: the first len(v2) rows must match ids, English names and macros')
    ap.add_argument('--out', default=str(ASSET))
    ap.add_argument('--stamp', default=str(STAMP), help='write a short import record (sha256, rows, mtime)')
    args = ap.parse_args()

    source_path = pathlib.Path(args.source).resolve()
    if not source_path.is_file():
        print(f'source not found: {source_path}', file=sys.stderr)
        return 1

    rows = json.loads(source_path.read_text(encoding='utf-8'))
    if not isinstance(rows, list) or not rows:
        print('source must be a non-empty JSON array', file=sys.stderr)
        return 1

    if args.v2:
        v2 = json.loads(pathlib.Path(args.v2).read_text(encoding='utf-8'))
        if len(rows) < len(v2):
            print(f'source has {len(rows)} rows, fewer than foods_v2 ({len(v2)})', file=sys.stderr)
            return 1
        if [r['id'] for r in rows[:len(v2)]] != [r['id'] for r in v2]:
            print('ids or order of the v2 prefix differ from foods_v2', file=sys.stderr)
            return 1
        bad = [
            (a['id'], k)
            for a, b in zip(v2, rows)
            for k in a
            if a[k] != b.get(k) or type(a[k]) is not type(b.get(k))
        ]
        if bad:
            print('v2-prefix columns differ from foods_v2:', bad[:10], file=sys.stderr)
            return 1
        v2_ids = {r['id'] for r in v2}
        reused = [r['id'] for r in rows[len(v2):] if r['id'] in v2_ids]
        if reused:
            print('new rows reuse v2 ids:', reused[:10], file=sys.stderr)
            return 1

    ids = [r.get('id') for r in rows]
    if len(set(ids)) != len(ids):
        print('duplicate ids in source', file=sys.stderr)
        return 1
    missing_en = [r.get('id') for r in rows if not str(r.get('name') or '').strip()]
    if missing_en:
        print('rows missing an English name:', missing_en[:10], file=sys.stderr)
        return 1

    flagged = sum(1 for r in rows if r.get('needs_review'))
    out = [{k: v for k, v in r.items() if k not in DROP} for r in rows]
    out_path = pathlib.Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open('w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write('\n')

    digest = sha256_file(source_path)
    mtime = time.strftime('%Y-%m-%d %H:%M:%S %z', time.localtime(source_path.stat().st_mtime))
    extra = f'; +{len(rows) - len(v2)} after the v2 prefix' if args.v2 else ''
    summary = (
        f'{len(out)} rows written to {out_path}\n'
        f'source: {source_path}\n'
        f'source sha256: {digest}\n'
        f'source mtime: {mtime} (Europe/Helsinki)\n'
        f'source size: {source_path.stat().st_size} bytes\n'
        f'dropped fields: {DROP}; needs_review was true on {flagged} rows{extra}\n'
    )
    print(summary, end='')
    if args.stamp:
        stamp_path = pathlib.Path(args.stamp)
        stamp_path.write_text(summary, encoding='utf-8')
    return 0


if __name__ == '__main__':
    sys.exit(main())
