import json, re, os

jsonl_path = 'C:/Users/belou/.claude/projects/C--Users-belou/deb5c25d-2a00-4278-a08e-34471338e5cf.jsonl'

with open(jsonl_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if i == 42805:
            obj = json.loads(line)
            content = obj.get('message', {}).get('content', [])
            for c in content:
                if isinstance(c, dict) and c.get('type') == 'document':
                    title = c.get('title', '')
                    if 'Код' not in title:
                        continue
                    data = c['source']['data']

                    # Split by ## headers
                    sections = re.split(r'\n## ', data)

                    for sec in sections:
                        if not sec.strip():
                            continue

                        # Find code block
                        m = re.search(r'```typescript\n(.*?)\n```', sec, re.DOTALL)
                        if not m:
                            m = re.search(r'```typescript\n(.*?)```', sec, re.DOTALL)
                        if not m:
                            continue

                        code = m.group(1).strip()

                        # Find filename
                        fm = re.search(r'`(src/[^`]+\.ts)`', sec)
                        if not fm:
                            continue

                        fname = fm.group(1)
                        newlines = code.count('\n')
                        print(f'{fname}: {len(code)} chars, {newlines} newlines')

                        # Write to file
                        fpath = os.path.join('.', fname)
                        os.makedirs(os.path.dirname(fpath), exist_ok=True)
                        with open(fpath, 'w', encoding='utf-8') as out:
                            out.write(code + '\n')
                        print(f'  -> Written to {fpath}')
            break
