import os
from functools import lru_cache
from typing import Any, Dict

from dotenv import load_dotenv
from typesafe_sdk import AsyncTypeSafeClient, Choice, RetryPolicy

load_dotenv()


@lru_cache(maxsize=1)
def get_moderation_client() -> AsyncTypeSafeClient:
    proxy = (os.getenv("INTEGRATION_PROXY_URL") or "https://integrations.emergentagent.com").rstrip("/")
    return AsyncTypeSafeClient(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        base_url=f"{proxy}/llm/typesafe",
        retry=RetryPolicy(max_retries=2, respect_retry_after=False),
    )


async def moderate_question(content: Dict[str, Any]) -> str:
    """Belirsiz veya servis hatalı içerik, admin incelemesi için REVIEW'e gider."""
    try:
        response = await get_moderation_client().system_one(
            model="jev-latest",
            state=content,
            questions={"safety": Choice(
                instructions="Classify this user-created educational question. BLOCKED only for explicit sexual/pornographic content, sexual content involving minors, credible threats or graphic severe violence, hate targeting protected people, or clearly abusive harassment. REVIEW for ambiguous harmful context. SAFE for ordinary educational, health, science, history, and daily-life content.",
                criteria={"safe": "Safe to publish", "review": "Needs admin review", "blocked": "Must not be published"},
            )},
        )
        decision = response.choices["safety"].choice
        return decision if decision in {"safe", "review", "blocked"} else "review"
    except Exception:
        return "review"