import re

try:
    from pypinyin import lazy_pinyin
except ImportError:  # pragma: no cover - fallback keeps local tooling usable before install.
    lazy_pinyin = None  # type: ignore[assignment]


HANDLE_MAX_LENGTH = 64

_FALLBACK_PINYIN = {
    "邢": "xing",
    "小": "xiao",
    "林": "lin",
    "王": "wang",
    "总": "zong",
    "张": "zhang",
    "三": "san",
    "客": "ke",
    "户": "hu",
}


def normalize_handle(value: str | None) -> str:
    if value is None:
        return ""

    raw = value.strip()
    if not raw:
        return ""

    transliterated = _to_pinyin(raw)
    normalized = re.sub(r"[^a-z0-9]+", "", transliterated.lower())
    return normalized[:HANDLE_MAX_LENGTH]


def build_handle_seed(value: str | None) -> str:
    return normalize_handle(value) or "contact"


def _to_pinyin(value: str) -> str:
    if lazy_pinyin is not None:
        return "".join(lazy_pinyin(value, errors="default"))

    return "".join(_FALLBACK_PINYIN.get(char, char) for char in value)
