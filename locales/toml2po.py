import sys
import toml
from pathlib import Path

def convert_toml_to_po(toml_path, po_path):
    data = toml.load(toml_path)

    lines = [
        '# Automatically converted from go-i18n TOML to gettext .po',
        'msgid ""',
        'msgstr ""',
        '"Content-Type: text/plain; charset=UTF-8\\n"',
        ''
    ]

    for key, entry in data.items():
        comment = entry.get("#", None)
        value = entry.get("other", "").replace('"', '\\"')

        if not value:
            continue

        if comment:
            lines.append(f'#. {comment.strip()}')

        lines.append(f'msgid "{key}"')
        lines.append(f'msgstr "{value}"')
        lines.append("")  # Blank line between entries

    with open(po_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines))

    print(f"✅ Converted {toml_path} -> {po_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python toml2po.py input.toml output.po")
        sys.exit(1)

    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2])

    if not input_file.exists():
        print(f"❌ File not found: {input_file}")
        sys.exit(1)

    convert_toml_to_po(input_file, output_file)
