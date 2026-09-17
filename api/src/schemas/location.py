from pydantic import BaseModel


class LocationOut(BaseModel):
    """Заклад для вкладки «Контакти»."""
    id: int
    name: str
    address: str
    phones: list[str]
    is_delivery_enabled: bool = True
    delivery_start_time: str = "10:30"
    delivery_end_time: str = "21:30"
