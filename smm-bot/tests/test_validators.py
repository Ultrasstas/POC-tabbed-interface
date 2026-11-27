import pytest

from bot.money import fmt_usd, parse_rate, usd_to_uah
from bot.validators import normalize_post_url, normalize_username


@pytest.mark.parametrize("raw,expected", [
    ("@My_Brand", "my_brand"),
    ("my.brand", "my.brand"),
    ("https://www.instagram.com/my_brand/", "my_brand"),
    ("instagram.com/my_brand?igsh=abc", "my_brand"),
    ("  @shop123  ", "shop123"),
])
def test_username_ok(raw, expected):
    assert normalize_username(raw) == expected


@pytest.mark.parametrize("raw", [
    "", "@", "my brand", "a" * 31, ".start", "end.", "two..dots", "кириллица",
    "https://www.instagram.com/p/ABC123/", "p", "<script>", "x" * 400,
])
def test_username_bad(raw):
    assert normalize_username(raw) is None


@pytest.mark.parametrize("raw,expected", [
    ("https://www.instagram.com/p/C1a2B3c4D5e/", "https://www.instagram.com/p/C1a2B3c4D5e/"),
    ("https://instagram.com/reel/C1a2B3c4D5e/?igsh=MTc4", "https://www.instagram.com/reel/C1a2B3c4D5e/"),
    ("instagram.com/reels/C1a2B3c4D5e", "https://www.instagram.com/reel/C1a2B3c4D5e/"),
    ("https://www.instagram.com/my_brand/p/C1a2B3c4D5e/", "https://www.instagram.com/p/C1a2B3c4D5e/"),
    ("https://m.instagram.com/tv/C1a2B3c4D5e", "https://www.instagram.com/tv/C1a2B3c4D5e/"),
])
def test_post_url_ok(raw, expected):
    assert normalize_post_url(raw) == expected


@pytest.mark.parametrize("raw", [
    "", "https://www.instagram.com/my_brand/", "https://evil.com/p/C1a2B3c4D5e/",
    "https://www.instagram.com.evil.com/p/C1a2B3c4D5e/", "javascript:alert(1)",
    "https://www.instagram.com/stories/x/123/",
])
def test_post_url_bad(raw):
    assert normalize_post_url(raw) is None


def test_money():
    assert fmt_usd(4500) == "$45.00"
    assert fmt_usd(210000) == "$2,100.00"
    assert parse_rate("41,5") is not None and str(parse_rate("41,5")) == "41.5"
    assert parse_rate("abc") is None and parse_rate("-1") is None and parse_rate("") is None
    assert usd_to_uah(1000, parse_rate("41.5")) == 415
    assert usd_to_uah(171, parse_rate("41.5")) == 71  # 70.965 rounded up
