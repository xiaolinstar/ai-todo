def normalize_tag_name(value: str) -> str:
    return value.strip().lower()


def clean_tag_display_name(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Tag name cannot be empty.")
    if len(cleaned) > 32:
        raise ValueError("Tag name must be 32 characters or fewer.")
    return cleaned
