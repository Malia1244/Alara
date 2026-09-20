"""
Turns the browser's Supabase access token into the signed-in user.

Most routes only need user_id so User A never reads User B's private rows.
The Lounge also uses email to make a public display name (never the full
address).
"""

import os
from dataclasses import dataclass
from typing import Annotated, Optional

import httpx
from dotenv import load_dotenv
from fastapi import Depends, Header, HTTPException

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: Optional[str]


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> AuthUser:
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
    email = data.get("email")
    return AuthUser(
        id=str(user_id),
        email=str(email).strip() if email else None,
    )


def get_current_user_id(user: Annotated[AuthUser, Depends(get_current_user)]) -> str:
    return user.id


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
CurrentUserId = Annotated[str, Depends(get_current_user_id)]
