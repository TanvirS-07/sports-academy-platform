from fastapi import APIRouter

from app.auth.dependencies import CurrentUser
from app.users.schemas import UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse, summary="The logged-in user")
def get_me(user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(user)
