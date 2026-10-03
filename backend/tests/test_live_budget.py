import asyncio

from app import main


def test_slow_optional_live_lookup_does_not_block_planning(monkeypatch):
    async def slow_lookup(_):
        await asyncio.sleep(1)
        return [], []

    monkeypatch.setattr(main, "fetch_multi_source_stations", slow_lookup)
    assert asyncio.run(main.optional_live_stations([], timeout_seconds=0.01)) == ([], [])
