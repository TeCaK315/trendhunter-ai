"""
Extract code from _code_doc.md.
Combined strategy:
1. Strip // comments - end comment at ), ], }, or keyword
2. Add newlines at statement boundaries
3. Run prettier
"""
import re
import os
import subprocess

MD_FILE = '_code_doc.md'
SKIP_FILES = {'src/app/api/evidence/problem/route.ts'}

KW = [
    'import ', 'export ', 'export default ',
    'const ', 'let ', 'var ',
    'async function ', 'function ',
    'interface ', 'type ', 'class ', 'enum ',
    'return ', 'throw new ', 'throw ',
    'try ', 'catch ', 'catch(', 'finally ',
    'await ', 'if (', 'if(', 'for (', 'for(',
    'while (', 'while(', 'switch (',
    'else ', 'else{', 'else if',
]

# Characters that definitely mean "code, not comment text"
# Only } is safe - ) and ] can appear in comment text like "(public layer)"
COMMENT_END_CHARS = set('}')


def extract_blocks(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    blocks = {}
    sections = re.split(r'\n## ', content)
    for sec in sections:
        path_match = re.search(r'\*\*.*?\*\*.*?`(src/[^`]+\.ts)`', sec)
        if not path_match:
            continue
        filepath = path_match.group(1)
        code_match = re.search(r'```typescript\n(.*?)\n```', sec, re.DOTALL)
        if not code_match:
            continue
        blocks[filepath] = code_match.group(1)
    return blocks


def is_comment_end(code, pos):
    """Check if position marks end of comment (start of code)."""
    if pos >= len(code):
        return True
    remaining = code[pos:]
    ch = remaining[0]

    # Closing brackets/parens/semicolons are always code
    if ch in COMMENT_END_CHARS:
        return True

    # Opening { is always code
    if ch == '{':
        return True

    # Another // starts a new comment
    if remaining.startswith('//'):
        return True

    # Keyword at word boundary
    prev_c = code[pos-1] if pos > 0 else ' '
    if not (prev_c.isalnum() or prev_c == '_'):
        for kw in KW:
            if remaining.startswith(kw):
                if kw == 'const ':
                    # Check for "as const"
                    j = pos - 1
                    while j >= 0 and code[j] == ' ':
                        j -= 1
                    if j >= 1 and code[j-1:j+1] == 'as':
                        return False
                return True
    return False


def phase1_strip_comments(code):
    """Strip // comments, replace with space. End comment at code tokens."""
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

        # Regex literals
        if ch == '/' and i+1 < length and code[i+1] not in ('/', '*', ' ', '='):
            prev_text = ''.join(result).rstrip()
            prev_ch = prev_text[-1] if prev_text else ''
            if prev_ch in '(,=;:[!&|?{>+-%~^':
                s = ch
                i += 1
                in_cls = False
                while i < length:
                    if code[i] == '\\':
                        s += code[i:i+2]
                        i += 2
                    elif code[i] == '[' and not in_cls:
                        in_cls = True
                        s += code[i]
                        i += 1
                    elif code[i] == ']' and in_cls:
                        in_cls = False
                        s += code[i]
                        i += 1
                    elif code[i] == '/' and not in_cls:
                        s += code[i]
                        i += 1
                        break
                    else:
                        s += code[i]
                        i += 1
                while i < length and code[i].isalpha():
                    s += code[i]
                    i += 1
                result.append(s)
                continue

        # // comment -> strip, keep scanning until code token found
        if ch == '/' and i+1 < length and code[i+1] == '/':
            result.append(' ')
            i += 2
            while i < length and not is_comment_end(code, i):
                i += 1
            continue

        result.append(ch)
        i += 1

    return ''.join(result)


def phase2_add_newlines(code):
    """Add newlines at ; { } and before keywords."""
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

        # Regex
        if ch == '/' and i+1 < length and code[i+1] not in ('/', '*', ' ', '='):
            prev_text = ''.join(result).rstrip()
            prev_ch = prev_text[-1] if prev_text else ''
            if prev_ch in '(,=;:[!&|?{>+-%~^':
                s = ch
                i += 1
                in_cls = False
                while i < length:
                    if code[i] == '\\':
                        s += code[i:i+2]
                        i += 2
                    elif code[i] == '[' and not in_cls:
                        in_cls = True
                        s += code[i]
                        i += 1
                    elif code[i] == ']' and in_cls:
                        in_cls = False
                        s += code[i]
                        i += 1
                    elif code[i] == '/' and not in_cls:
                        s += code[i]
                        i += 1
                        break
                    else:
                        s += code[i]
                        i += 1
                while i < length and code[i].isalpha():
                    s += code[i]
                    i += 1
                result.append(s)
                continue

        # Semicolons
        if ch == ';':
            result.append(';\n')
            i += 1
            continue

        # Opening brace
        if ch == '{':
            result.append(' {\n')
            i += 1
            continue

        # Closing brace
        if ch == '}':
            remaining = code[i:]
            if remaining.startswith('} as const'):
                result.append('\n} as const')
                i += len('} as const')
                continue
            result.append('\n}\n')
            i += 1
            continue

        # Statement keywords
        remaining = code[i:]
        prev_char = code[i-1] if i > 0 else '\n'
        if not (prev_char.isalnum() or prev_char == '_'):
            for kw in KW:
                if remaining.startswith(kw):
                    if kw == 'const ':
                        prev_text = ''.join(result).rstrip()
                        if prev_text.endswith('as'):
                            break
                    result.append('\n')
                    break

        result.append(ch)
        i += 1

    return ''.join(result)


def phase3_fix_interface_fields(code):
    """Add newlines between interface fields on same line.
    Pattern: `type   identifier:` -> `type;\n  identifier:`
    Also fixes: `string   identifier:`, `number   identifier:`, `boolean   ...`
    """
    # Inside interface/type blocks, split fields
    # Pattern: type-ending-char followed by 2+ spaces then identifier with :
    # Type endings: word char, ', ", >, ], )
    code = re.sub(
        r"(['\"\w\]>)])\s{2,}(\w+\??\s*:)",
        r'\1;\n  \2',
        code
    )
    return code


def phase4_fix_missing_parens(code):
    """Fix cases where comment stripping ate closing parens.
    Pattern: `.catch(() => '') const` -> add back missing )
    This is a targeted fix for known patterns.
    """
    # Fix: `.catch(() => '') const` should have `)     )` before const
    # Look for .catch followed directly by const/return without proper closing
    # This is too specific to automate reliably - skip for now
    return code


def format_with_prettier(code, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    p1 = phase1_strip_comments(code)
    p2 = phase2_add_newlines(p1)
    p3 = phase3_fix_interface_fields(p2)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(p3)

    result = subprocess.run(
        'npx prettier --write --parser typescript "' + filepath + '"',
        capture_output=True, timeout=60, shell=True
    )

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.count('\n')

    status = 'OK' if result.returncode == 0 else 'FAIL'
    return lines, status


if __name__ == '__main__':
    blocks = extract_blocks(MD_FILE)
    print(f'{len(blocks)} blocks\n')
    for filepath in sorted(blocks.keys()):
        if filepath in SKIP_FILES:
            print(f'SKIP: {filepath}')
            continue
        code = blocks[filepath]
        lines, status = format_with_prettier(code, filepath)
        print(f'{filepath}: {lines} lines [{status}]')
    print('\nDone!')
