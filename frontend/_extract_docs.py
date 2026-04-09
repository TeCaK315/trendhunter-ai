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
                data = c['source']['data']
                if 'ТЗ' in title:
                    with open('_tz.md', 'w', encoding='utf-8') as out:
                        out.write(data)
                    print(f'ТЗ: {len(data)} chars')
                elif 'Документация' in title:
                    with open('_docs.md', 'w', encoding='utf-8') as out:
                        out.write(data)
                    print(f'Docs: {len(data)} chars')
            break
