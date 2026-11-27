"""Minimal Crypto Pay API client (https://help.crypt.bot/crypto-pay-api)."""
from __future__ import annotations

import aiohttp


class CryptoPayError(Exception):
    pass


class CryptoPay:
    def __init__(self, token: str, testnet: bool = False):
        self._token = token
        self._base = "https://testnet-pay.crypt.bot/api" if testnet else "https://pay.crypt.bot/api"
        self._session: aiohttp.ClientSession | None = None

    async def _call(self, method: str, **params) -> dict | list:
        if self._session is None:
            self._session = aiohttp.ClientSession(
                headers={"Crypto-Pay-API-Token": self._token},
                timeout=aiohttp.ClientTimeout(total=15),
            )
        async with self._session.post(f"{self._base}/{method}", json=params) as resp:
            data = await resp.json(content_type=None)
        if not data.get("ok"):
            raise CryptoPayError(f"{method}: {data.get('error')}")
        return data["result"]

    async def create_invoice(self, order_id: int, cents: int, description: str) -> dict:
        return await self._call(
            "createInvoice",
            currency_type="fiat",
            fiat="USD",
            amount=f"{cents / 100:.2f}",
            accepted_assets="USDT,TON,BTC,ETH,LTC",
            description=description[:1024],
            payload=str(order_id),
            allow_comments=False,
            allow_anonymous=True,
            expires_in=86400,
        )

    async def get_invoices(self, invoice_ids: list[int]) -> list[dict]:
        result = await self._call("getInvoices", invoice_ids=",".join(map(str, invoice_ids)))
        return result.get("items", []) if isinstance(result, dict) else result

    async def close(self) -> None:
        if self._session is not None:
            await self._session.close()
