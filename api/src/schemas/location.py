from pydantic import BaseModel


class LocationOut(BaseModel):
    """Заклад для вкладки «Контакти»."""
    id: int
    name: str
    address: str
    phones: list[str]
