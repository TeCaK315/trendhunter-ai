"""
Strategy: Remove all // comments from single-line TS code, then format.
// comments are the ONLY thing breaking parsing.
"""
import os
import re
import json
import subprocess

def extract_code_blocks(jsonl_path, line_num):
    blocks = {}
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i == line_num:
                obj = json.loads(line)
                for c in obj['message']['content']:
                    if c.get('type') != 'document':
                        continue
                    if 'Код' not in c.get('title', ''):
                        continue
                    data = c['source']['data']
                    sections = re.split(r'\n## ', data)
                    for sec in sections:
                        fm = re.search(r'`(src/[^`]+\.ts)`', sec)
                        cm = re.search(r'```typescript\n(.*?)```', sec, re.DOTALL)
                        if fm and cm:
                            blocks[fm.group(1)] = cm.group(1).strip()
                break
    return blocks


def strip_comments(code):
    """Remove all // comments from single-line code, preserving strings."""
    result = []
    i = 0
    length = len(code)

    while i < length:
        ch = code[i]

        # String literals - keep as-is
        if ch in ("'", '"'):
            quote = ch
            s = ch
            i += 1
            while i < length and code[i] != quote:
                if code[i] == '\\':
                    s += code[i:i+2]
                    i += 2
                else:
                    s += code[i]
                    i += 1
            if i < length:
                s += code[i]
                i += 1
            result.append(s)
            continue

        # Template literals - keep as-is
        if ch == '`':
            s = ch
            i += 1
            depth = 0
            while i < length:
                if code[i] == '\\':
                    s += code[i:i+2]
                    i += 2
                elif code[i] == '$' and i+1 < length and code[i+1] == '{':
                    s += '${'
                    i += 2
                    depth += 1
                elif code[i] == '{' and depth > 0:
                    s += '{'
                    i += 1
                    depth += 1
                elif code[i] == '}' and depth > 0:
                    s += '}'
                    i += 1
                    depth -= 1
                elif code[i] == '`' and depth == 0:
                    s += '`'
                    i += 1
                    break
                else:
                    s += code[i]
                    i += 1
            result.append(s)
            continue

        # // comment - SKIP until next code keyword
        if ch == '/' and i+1 < length and code[i+1] == '/':
            i += 2
            # Skip comment content until we find a code keyword
            while i < length:
                remaining = code[i:]
                # Check for another // (new comment)
                if remaining.startswith('//'):
                    break

                # Check for code keywords that start a new statement
                found = False
                for kw in ['import ', 'export ', 'const ', 'let ', 'var ',
                           'function ', 'async function', 'interface ', 'type ',
                           'class ', 'enum ', 'return ', 'throw new', 'throw ',
                           'try {', 'catch ', 'catch(', 'finally {',
                           'await ', 'if (', 'if(', 'for (', 'for(',
                           'while (', 'switch (', 'else {', 'else if',
                           'new ', 'readonly ', 'private ', 'public ',
                           'protected ', 'abstract ', 'static ']:
                    if remaining.startswith(kw):
                        found = True
                        break

                # Also detect:
                # } at statement level
                if remaining[0] == '}':
                    found = True
                # ] at statement level
                if remaining[0] == ']' and len(remaining) > 1 and remaining[1] in ' ,;)\n':
                    found = True

                if found:
                    # Add a space before the code to separate from previous code
                    result.append(' ')
                    break

                i += 1
            continue

        # Regular character
        result.append(ch)
        i += 1

    return ''.join(result)


def format_code(code):
    """Add newlines at ; { } boundaries and indent."""
    result = []
    i = 0
    length = len(code)

    while i < length:
        ch = code[i]

        # String literals
        if ch in ("'", '"'):
            quote = ch
            s = ch
            i += 1
            while i < length and code[i] != quote:
                if code[i] == '\\':
                    s += code[i:i+2]
                    i += 2
                else:
                    s += code[i]
                    i += 1
            if i < length:
                s += code[i]
                i += 1
            result.append(s)
            continue

        # Template literals
        if ch == '`':
            s = ch
            i += 1
            depth = 0
            while i < length:
                if code[i] == '\\':
                    s += code[i:i+2]
                    i += 2
                elif code[i] == '$' and i+1 < length and code[i+1] == '{':
                    s += '${'
                    i += 2
                    depth += 1
                elif code[i] == '{' and depth > 0:
                    s += '{'
                    i += 1
                    depth += 1
                elif code[i] == '}' and depth > 0:
                    s += '}'
                    i += 1
                    depth -= 1
                elif code[i] == '`' and depth == 0:
                    s += '`'
                    i += 1
                    break
                else:
                    s += code[i]
                    i += 1
            result.append(s)
            continue

        if ch == ';':
            result.append(';\n')
            i += 1
            continue

        if ch == '{':
            result.append(' {\n')
            i += 1
            continue

        if ch == '}':
            result.append('\n}\n')
            i += 1
            continue

        result.append(ch)
        i += 1

    return ''.join(result)


def indent_code(code):
    """Apply indentation."""
    lines = code.split('\n')
    result = []
    indent = 0

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Count leading closes
        leading_closes = 0
        for ch in stripped:
            if ch in '}])':
                leading_closes += 1
            else:
                break

        temp_indent = max(0, indent - leading_closes)
        result.append('  ' * temp_indent + stripped)

        # Count braces (outside strings)
        in_str = False
        str_char = None
        net = 0
        j = 0
        while j < len(stripped):
            c = stripped[j]
            if in_str:
                if c == '\\':
                    j += 2
                    continue
                if c == str_char:
                    in_str = False
            elif c in ('"', "'", '`'):
                in_str = True
                str_char = c
            elif c in ('{', '(', '['):
                net += 1
            elif c in ('}', ')', ']'):
                net -= 1
            j += 1

        indent = max(0, temp_indent + net + leading_closes)

    return '\n'.join(result) + '\n'


if __name__ == '__main__':
    jsonl = 'C:/Users/belou/.claude/projects/C--Users-belou/deb5c25d-2a00-4278-a08e-34471338e5cf.jsonl'

    print('Extracting code blocks...')
    blocks = extract_code_blocks(jsonl, 42805)

    skip = 'src/app/api/evidence/problem/route.ts'

    for filepath, code in sorted(blocks.items()):
        if filepath == skip:
            print(f'SKIP: {filepath}')
            continue

        # Step 1: Strip // comments
        stripped = strip_comments(code)
        # Step 2: Format
        formatted = format_code(stripped)
        # Step 3: Indent
        indented = indent_code(formatted)

        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(indented)

        line_count = indented.count('\n')
        print(f'OK: {filepath} -> {line_count} lines')

    # Try TypeScript check
    print('\nRunning tsc check...')
    for filepath in sorted(blocks.keys()):
        r = subprocess.run(
            ['npx', 'tsc', '--noEmit', '--skipLibCheck', filepath],
            capture_output=True, text=True, timeout=60
        )
        errors = r.stdout.count('error TS') + r.stderr.count('error TS')
        if errors > 0:
            print(f'  {filepath}: {errors} TS errors')
            # Show first 3 errors
            output = r.stdout + r.stderr
            for line in output.split('\n'):
                if 'error TS' in line:
                    print(f'    {line[:120]}')
        else:
            print(f'  {filepath}: OK')
