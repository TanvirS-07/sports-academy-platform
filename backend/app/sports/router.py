from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser
from app.db.session import get_db
from app.sports.models import Sport
from app.sports.schemas import SportResponse

router = APIRouter(prefix="/sports", tags=["sports"])


@router.get("", response_model=list[SportResponse], summary="Sports offered by the academy")
def list_sports(_: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> list[SportResponse]:
    sports = db.scalars(select(Sport).order_by(Sport.name))
    return [SportResponse.model_validate(sport) for sport in sports]
