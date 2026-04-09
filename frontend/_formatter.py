"""
Formatter for single-line TypeScript code.
Strategy: Insert newlines at syntactically safe positions.
"""
import re
import sys
import os

def format_ts(code: str) -> str:
    """
    Insert newlines into single-line TS code to make it multi-line.
    The key insight: // comments consume everything to end-of-line,
    so we MUST put newlines before // and after the comment ends.
    """
    result = []
    i = 0
    length = len(code)
    indent = 0

    def add_line(text: str):
        stripped = text.strip()
        if stripped:
            # Adjust indent for closing braces
            temp_indent = indent
            if stripped.startswith('}') or stripped.startswith(')') or stripped.startswith(']'):
                temp_indent = max(0, indent - 1)
            result.append('  ' * temp_indent + stripped)
        else:
            result.append('')

    # First, we need to properly tokenize the code to handle // comments
    # Split into tokens: strings, template literals, comments, and code
    tokens = []
    pos = 0
    while pos < length:
        ch = code[pos]

        # Single-line comment
        if ch == '/' and pos + 1 < length and code[pos + 1] == '/':
            # Find where this comment should end
            # In single-line code, // eats everything, so we need heuristics
            # Look for patterns that indicate "new statement" after comment text
            comment_start = pos
            pos += 2
            # Collect comment text until we hit something that looks like code
            comment_text = '//'
            while pos < length:
                # Heuristic: if we see a pattern like:
                # "some comment text import " or "some comment text const " etc.
                # that likely means the comment ended and code resumed
                remaining = code[pos:]

                # Check if current position starts a new statement
                # This is tricky - we look for keywords preceded by what looks like comment end
                if len(comment_text) > 4:  # At least some comment content
                    # Check for common statement starters
                    for kw in ['import ', 'export ', 'const ', 'let ', 'var ', 'function ',
                               'async ', 'interface ', 'type ', 'class ', 'enum ',
                               'if (', 'if(', 'for (', 'for(', 'while ', 'switch ',
                               'return ', 'throw ', 'try ', 'catch ', 'finally ',
                               'await ', 'yield ', 'break', 'continue',
                               '// ', 'readonly ', 'private ', 'public ', 'protected ']:
                        if remaining.startswith(kw):
                            # Likely start of new code
                            tokens.append(('comment', comment_text))
                            comment_text = ''
                            break
                    if not comment_text:
                        break

                    # Also check for lines that start with specific patterns
                    # like "}" or "]" or ")" which indicate block ends
                    if remaining[0] in '})' and len(comment_text) > 5:
                        tokens.append(('comment', comment_text))
                        comment_text = ''
                        break

                comment_text += code[pos]
                pos += 1

            if comment_text:
                tokens.append(('comment', comment_text))
            continue

        # Block comment
        if ch == '/' and pos + 1 < length and code[pos + 1] == '*':
            end = code.find('*/', pos + 2)
            if end == -1:
                tokens.append(('block_comment', code[pos:]))
                break
            tokens.append(('block_comment', code[pos:end + 2]))
            pos = end + 2
            continue

        # String literals
        if ch in ('"', "'"):
            quote = ch
            s = ch
            pos += 1
            while pos < length and code[pos] != quote:
                if code[pos] == '\\':
                    s += code[pos:pos + 2]
                    pos += 2
                else:
                    s += code[pos]
                    pos += 1
            if pos < length:
                s += code[pos]
                pos += 1
            tokens.append(('string', s))
            continue

        # Template literal
        if ch == '`':
            s = ch
            pos += 1
            depth = 0
            while pos < length:
                if code[pos] == '\\':
                    s += code[pos:pos + 2]
                    pos += 2
                elif code[pos] == '$' and pos + 1 < length and code[pos + 1] == '{':
                    s += '${'
                    pos += 2
                    depth += 1
                elif code[pos] == '{' and depth > 0:
                    s += '{'
                    pos += 1
                    depth += 1
                elif code[pos] == '}' and depth > 0:
                    s += '}'
                    pos += 1
                    depth -= 1
                elif code[pos] == '`' and depth == 0:
                    s += '`'
                    pos += 1
                    break
                else:
                    s += code[pos]
                    pos += 1
            tokens.append(('template', s))
            continue

        # Regular code character
        tokens.append(('code', ch))
        pos += 1

    # Now reconstruct with newlines
    output = []
    current_line = ''

    for ttype, tval in tokens:
        if ttype == 'comment':
            # Add newline before comment, then the comment, then newline after
            if current_line.strip():
                output.append(current_line)
                current_line = ''
            output.append(tval)
            continue

        if ttype == 'block_comment':
            if current_line.strip():
                output.append(current_line)
                current_line = ''
            output.append(tval)
            continue

        if ttype in ('string', 'template'):
            current_line += tval
            continue

        # Code character
        ch = tval
        current_line += ch

        # Add newlines after certain characters/patterns
        if ch == '{':
            output.append(current_line)
            current_line = ''
        elif ch == '}':
            output.append(current_line)
            current_line = ''
        elif ch == ';':
            output.append(current_line)
            current_line = ''
        elif ch == ',':
            # Check if we're likely in a multi-element context
            stripped = current_line.strip()
            # Only break on commas in specific contexts (object/array literals, params)
            # Don't break inside function call arguments that are short
            if len(stripped) > 80:
                output.append(current_line)
                current_line = ''

    if current_line.strip():
        output.append(current_line)

    # Now apply indentation
    indented = []
    indent_level = 0
    for line in output:
        stripped = line.strip()
        if not stripped:
            indented.append('')
            continue

        # Decrease indent for closing braces
        close_count = 0
        for ch in stripped:
            if ch in '})':
                close_count += 1
            else:
                break

        if close_count > 0:
            indent_level = max(0, indent_level - close_count)

        indented.append('  ' * indent_level + stripped)

        # Count net brace change for next line
        in_string = False
        string_char = None
        net = 0
        j = 0
        while j < len(stripped):
            c = stripped[j]
            if in_string:
                if c == '\\':
                    j += 2
                    continue
                if c == string_char:
                    in_string = False
            else:
                if c in ('"', "'", '`'):
                    in_string = True
                    string_char = c
                elif c in ('{', '('):
                    net += 1
                elif c in ('}', ')'):
                    net -= 1
            j += 1

        # Adjust: we already decreased for leading closes
        indent_level = max(0, indent_level + net + close_count)

    return '\n'.join(indented) + '\n'


if __name__ == '__main__':
    files = [
        'src/app/api/evidence/demand/route.ts',
        'src/app/api/evidence/sellability/route.ts',
        'src/app/api/evidence/competition/route.ts',
        'src/app/api/evidence/revenue-sizing/route.ts',
        'src/app/api/evidence/blind-spots/route.ts',
        'src/app/api/synthesis/route.ts',
        'src/lib/synthesis/prompts/skeptic.ts',
        'src/lib/synthesis/prompts/optimist.ts',
        'src/lib/synthesis/conflict-detection.ts',
        'src/lib/synthesis/prompts/arbitrator.ts',
    ]

    for fpath in files:
        if not os.path.exists(fpath):
            print(f'SKIP: {fpath} not found')
            continue

        with open(fpath, 'r', encoding='utf-8') as f:
            code = f.read()

        if code.count('\n') > 5:
            print(f'SKIP: {fpath} already formatted ({code.count(chr(10))} lines)')
            continue

        formatted = format_ts(code)

        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(formatted)

        print(f'OK: {fpath} -> {formatted.count(chr(10))} lines')
