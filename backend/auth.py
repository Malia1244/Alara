"""
Turns the browser's Supabase access token into a user_id.

Every protected API route depends on this so User A never reads User B's rows.
"""

import os
from typing import Annotated

import httpx
from dotenv import load_dotenv
from fastapi import Depends, Header, HTTPException

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Sign in required. Missing Authorization bearer token.",
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sign in required.")

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    try:
        response = httpx.get(
            f"{SUPABASE_URL.rstrip('/')}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
            },
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503, detail=f"Could not reach Supabase Auth: {exc}"
        ) from exc

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    data = response.json()
    user_id = data.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session user.")
    return str(user_id)


CurrentUserId = Annotated[str, Depends(get_current_user_id)]
