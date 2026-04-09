"""
Format single-line TypeScript by adding newlines at syntactic boundaries.
Key insight: Every // in original code starts a new line.
"""
import os
import re
import json

def extract_code_blocks(jsonl_path, line_num):
    """Extract raw single-line code from the JSONL code document."""
    blocks = {}
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i == line_num:
                obj = json.loads(line)
                for c in obj['message']['content']:
                    if c.get('type') != 'document':
                        continue
                    title = c.get('title', '')
                    if 'Код' not in title:
                        continue
                    data = c['source']['data']

                    # Parse markdown code fences
                    import re
                    pattern = r'`(src/[^`]+\.ts)`\s*```typescript\s*\n(.*?)\n?```'
                    # Actually, let's split by ## headers
                    sections = re.split(r'\n## ', data)
                    for sec in sections:
                        fm = re.search(r'`(src/[^`]+\.ts)`', sec)
                        cm = re.search(r'```typescript\n(.*?)```', sec, re.DOTALL)
                        if fm and cm:
                            blocks[fm.group(1)] = cm.group(1).strip()
                break
    return blocks


def add_newlines(code):
    """Add newlines to single-line TypeScript code."""
    result = []
    i = 0
    length = len(code)

    while i < length:
        ch = code[i]

        # Skip string literals
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

        # Skip template literals
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

        # Handle // comments - add newline BEFORE
        if ch == '/' and i+1 < length and code[i+1] == '/':
            # Add newline before comment
            result.append('\n')
            # Collect the comment
            comment = '//'
            i += 2
            # The comment runs until the next code keyword or another //
            while i < length:
                # Check if we hit another //
                if code[i] == '/' and i+1 < length and code[i+1] == '/':
                    break
                # Check if we hit a code keyword
                remaining = code[i:]
                found_keyword = False
                for kw in ['import ', 'export ', 'const ', 'let ', 'var ',
                           'function ', 'async ', 'interface ', 'type ',
                           'class ', 'enum ', 'return ', 'throw ', 'try {',
                           'catch ', 'finally {', 'await ', 'if (',
                           'for (', 'while (', 'switch (', 'else {',
                           'else if', 'break;', 'continue;',
                           'readonly ', 'private ', 'public ', 'protected ',
                           'abstract ', 'static ', 'new ']:
                    if remaining.startswith(kw):
                        found_keyword = True
                        break

                # Also check for patterns that start code:
                # - Opening/closing braces at statement level
                # - Type declarations like: SomeType = ...
                if not found_keyword and len(comment) > 5:
                    # Check for standalone } or ]
                    if remaining[0] == '}' and (len(remaining) < 2 or remaining[1] in ' \n,;)'):
                        found_keyword = True
                    # Arrow functions: (params) => {
                    # Variable declarations that don't start with keywords

                if found_keyword:
                    break

                comment += code[i]
                i += 1

            result.append(comment)
            result.append('\n')
            continue

        # Handle block comments
        if ch == '/' and i+1 < length and code[i+1] == '*':
            end = code.find('*/', i+2)
            if end == -1:
                result.append(code[i:])
                break
            result.append('\n')
            result.append(code[i:end+2])
            result.append('\n')
            i = end + 2
            continue

        # Add newline after ; { }
        if ch == ';':
            result.append(ch)
            result.append('\n')
            i += 1
            continue

        if ch == '{':
            result.append(ch)
            result.append('\n')
            i += 1
            continue

        if ch == '}':
            result.append('\n')
            result.append(ch)
            result.append('\n')
            i += 1
            continue

        result.append(ch)
        i += 1

    return ''.join(result)


def indent_code(code):
    """Apply indentation based on brace nesting."""
    lines = code.split('\n')
    result = []
    indent = 0

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Decrease indent for closing braces
        leading_closes = 0
        for ch in stripped:
            if ch in '})':
                leading_closes += 1
            elif ch == ']':
                leading_closes += 1
            else:
                break

        temp_indent = max(0, indent - leading_closes)
        result.append('  ' * temp_indent + stripped)

        # Count net brace change
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
            elif c == '/' and j+1 < len(stripped) and stripped[j+1] == '/':
                break  # rest is comment
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


def process_file(filepath, code):
    """Format and write a single file."""
    formatted = add_newlines(code)
    indented = indent_code(formatted)

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(indented)

    line_count = indented.count('\n')
    return line_count


if __name__ == '__main__':
    jsonl = 'C:/Users/belou/.claude/projects/C--Users-belou/deb5c25d-2a00-4278-a08e-34471338e5cf.jsonl'

    print('Extracting code blocks...')
    blocks = extract_code_blocks(jsonl, 42805)

    # Skip Block 1 - it's already properly formatted from separate upload
    skip = 'src/app/api/evidence/problem/route.ts'

    for filepath, code in sorted(blocks.items()):
        if filepath == skip:
            print(f'SKIP: {filepath} (already formatted)')
            continue

        lines = process_file(filepath, code)
        print(f'OK: {filepath} -> {lines} lines')
