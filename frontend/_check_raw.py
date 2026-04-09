import json

jsonl = 'C:/Users/belou/.claude/projects/C--Users-belou/deb5c25d-2a00-4278-a08e-34471338e5cf.jsonl'
with open(jsonl, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if i == 42805:
            obj = json.loads(line)
            for c in obj['message']['content']:
                if c.get('type') != 'document':
                    continue
                title = c.get('title', '')
                if 'Код' not in title:
                    continue
                data = c['source']['data']

                # Find block 2 code
                idx = data.find('Block 2')
                ts_start = data.find('```typescript', idx)
                ts_end = data.find('```', ts_start + 14)
                code = data[ts_start+14:ts_end].strip()

                print(f'Length: {len(code)}')
                print(f'Newlines: {code.count(chr(10))}')
                print(f'First 400 repr:')
                print(repr(code[:400]))
            break
