from dataclasses import dataclass
from typing import Optional
from uuid import UUID


@dataclass(frozen=True)
class AuthenticatedUser:
    """Represents a verified authenticated user derived strictly from a verified JWT."""

    id: UUID
    email: Optional[str] = None
    role: str = "authenticated"
