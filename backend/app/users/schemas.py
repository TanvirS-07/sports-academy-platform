import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.users.models import Role


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    role: Role
    created_at: datetime
