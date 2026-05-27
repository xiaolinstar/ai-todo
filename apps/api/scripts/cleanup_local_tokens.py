"""One-shot cleanup for local dev: fix misclassified tokens and revoke stale PATs."""

from __future__ import annotations

from sqlalchemy import select

from ai_todo_api.config import settings
from ai_todo_api.common.time import now_utc
from ai_todo_api.db.models import ApiTokenModel
from ai_todo_api.db.session import SessionLocal
from ai_todo_api.modules.api_tokens.constants import TOKEN_TYPE_PAT, TOKEN_TYPE_SESSION


def main() -> None:
    now = now_utc()
    with SessionLocal() as session:
        rows = session.scalars(select(ApiTokenModel)).all()
        reclassified = 0
        revoked_pats = 0
        revoked_sessions = 0

        for row in rows:
            name = row.name or ""
            if row.token_type == TOKEN_TYPE_PAT and name.startswith("WeChat"):
                row.token_type = TOKEN_TYPE_SESSION
                row.client_kind = "miniapp"
                row.revoked_at = now
                reclassified += 1
                revoked_sessions += 1
                continue

            if row.user_id == settings.dev_user_id and row.token_type == TOKEN_TYPE_PAT:
                if row.revoked_at is None:
                    row.revoked_at = now
                    revoked_pats += 1

            if row.token_type == TOKEN_TYPE_SESSION and row.revoked_at is None:
                row.revoked_at = now
                revoked_sessions += 1

        session.commit()

    print(f"Reclassified WeChat PAT -> session (revoked): {reclassified}")
    print(f"Revoked active PATs on {settings.dev_user_id}: {revoked_pats}")
    print(f"Revoked active sessions (all users): {revoked_sessions}")
    print("Done. Re-login in the miniapp to get a fresh session.")


if __name__ == "__main__":
    main()
