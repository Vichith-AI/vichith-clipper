import pytest
from downloader import is_valid_stream_url, identify_platform


def test_is_valid_stream_url():
    # YouTube variants
    assert is_valid_stream_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert is_valid_stream_url("https://youtu.be/dQw4w9WgXcQ")
    assert is_valid_stream_url("https://youtube.com/live/abcdef12345")
    assert is_valid_stream_url("https://www.youtube.com/shorts/abcdef12345")

    # Twitch variants
    assert is_valid_stream_url("https://www.twitch.tv/videos/1234567890")
    assert is_valid_stream_url("https://twitch.tv/shroud")

    # Kick variants
    assert is_valid_stream_url("https://kick.com/video/abcdef12-3456-7890")
    assert is_valid_stream_url("https://kick.com/xqc")

    # Invalid URLs
    assert not is_valid_stream_url("https://google.com")
    assert not is_valid_stream_url("not a url")
    assert not is_valid_stream_url("")


def test_identify_platform():
    assert identify_platform("https://www.youtube.com/watch?v=123") == "youtube"
    assert identify_platform("https://youtu.be/123") == "youtube"
    assert identify_platform("https://www.twitch.tv/videos/123") == "twitch"
    assert identify_platform("https://kick.com/video/123") == "kick"
    assert identify_platform("https://example.com/stream.mp4") == "generic"
