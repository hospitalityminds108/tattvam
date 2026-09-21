#!/usr/bin/env python3
"""Fix text encoding across the Tat:vm site.

Two problems found:
  1. Most HTML files are UTF-8 files whose non-ASCII characters were
     double-encoded (UTF-8 bytes reinterpreted as cp1252, then re-saved as
     UTF-8). Fix = encode('cp1252').decode('utf-8').
  2. projects/ghatkopar-*.html are single-encoded cp1252 files. Fix = read
     cp1252, write utf-8.
A UTF-8 BOM (\ufeff) is present at the start of most files; it is preserved.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BOM = "\ufeff"


def fix_double_encoded(text: str) -> str:
    """Round-trip cp1252 -> utf-8 for double-encoded text.

    Some source bytes (0x81, 0x8D, 0x8F, 0x90, 0x9D) are undefined in cp1252
    and were passed through as C1 control characters; map those directly.
    """
    out = bytearray()
    for ch in text:
        try:
            out += ch.encode("cp1252")
        except UnicodeEncodeError:
            o = ord(ch)
            if o < 256:
                out.append(o)
            else:
                raise
    return bytes(out).decode("utf-8")


def process(path: Path) -> str:
    raw = path.read_bytes()
    had_bom = raw.startswith(b"\xef\xbb\xbf")
    try:
        text = raw.decode("utf-8")
        if text.startswith(BOM):
            text = text[1:]
        try:
            repaired = fix_double_encoded(text)
            if repaired != text:
                text = repaired
                status = "mojibake-fixed"
            else:
                status = "clean"
        except (UnicodeEncodeError, UnicodeDecodeError):
            status = "clean"
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
        status = "cp1252->utf8"

    out = text
    if had_bom and not out.startswith(BOM):
        out = BOM + out
    path.write_text(out, encoding="utf-8", newline="")
    return status


def main() -> None:
    counts = {}
    for path in sorted(ROOT.rglob("*.html")):
        if "summarized_conversations" in path.parts:
            continue
        status = process(path)
        counts[status] = counts.get(status, 0) + 1
        if status != "clean":
            print(f"{status:16s} {path.relative_to(ROOT)}")
    print("\nSummary:", counts)


if __name__ == "__main__":
    main()
