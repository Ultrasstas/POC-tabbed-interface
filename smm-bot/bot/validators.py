"""Input validation for Instagram usernames and post links."""
from __future__ import annotations

import re

MAX_INPUT_LEN = 300

_USERNAME_RE = re.compile(r"^(?!.*\.\.)(?!\.)[A-Za-z0-9._]{1,30}(?<!\.)$")
_PROFILE_URL_RE = re.compile(
    r"^(?:https?://)?(?:www\.|m\.)?instagram\.com/([A-Za-z0-9._]{1,30})/?(?:\?.*)?$", re.I
)
_POST_URL_RE = re.compile(
    r"^(?:https?://)?(?:www\.|m\.)?instagram\.com/"
    r"(?:[A-Za-z0-9._]{1,30}/)?"          # optional username segment
    r"(p|reel|reels|tv)/([A-Za-z0-9_-]{5,64})/?(?:\?.*)?$",
    re.I,
)
_RESERVED_PATHS = {"p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct"}


def normalize_username(text: str) -> str | None:
    """Return a clean username (without @) or None if it is not valid."""
    text = (text or "").strip()
    if not text or len(text) > MAX_INPUT_LEN:
        return None
    m = _PROFILE_URL_RE.match(text)
    if m:
        text = m.group(1)
    text = text.lstrip("@")
    if text.lower() in _RESERVED_PATHS:
        return None
    if not _USERNAME_RE.match(text):
        return None
    return text.lower()


def normalize_post_url(text: str) -> str | None:
    """Return a canonical https://www.instagram.com/<kind>/<code>/ link or None."""
    text = (text or "").strip()
    if not text or len(text) > MAX_INPUT_LEN:
        return None
    m = _POST_URL_RE.match(text)
    if not m:
        return None
    kind = m.group(1).lower()
    if kind == "reels":
        kind = "reel"
    return f"https://www.instagram.com/{kind}/{m.group(2)}/"


def clean_notes(text: str, limit: int = 500) -> str:
    return (text or "").strip()[:limit]
