"""Mint a Personal Access Token for a user (run inside the API container on production)."""

from __future__ import annotations

import argparse
import sys

from ai_todo_api.auth.context import DEFAULT_SCOPES
from ai_todo_api.db.models import UserModel
from ai_todo_api.db.session import SessionLocal
from ai_todo_api.modules.api_tokens.constants import CLIENT_KIND_CLI
from ai_todo_api.modules.api_tokens.service import create_pat_for_user


def main() -> None:
    parser = argparse.ArgumentParser(description="Mint a CLI PAT for the given user id.")
    parser.add_argument("user_id", help="Target user id, e.g. user_0c03a94996c2")
    parser.add_argument("--name", default="CLI Seed", help="Token label stored in api_tokens")
    args = parser.parse_args()

    with SessionLocal() as session:
        user = session.get(UserModel, args.user_id)
        if user is None:
            print(f"User not found: {args.user_id}", file=sys.stderr)
            sys.exit(1)

        result = create_pat_for_user(
            session,
            user_id=user.id,
            name=args.name,
            scopes=list(DEFAULT_SCOPES),
            timezone=user.timezone,
            client_kind=CLIENT_KIND_CLI,
        )
        print(result.token)


if __name__ == "__main__":
    main()
