from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

# Passwords are never stripped or changed. Length limits follow NIST guidance:
# a reasonable minimum, and a maximum high enough for passphrases.
Password = Annotated[str, Field(min_length=8, max_length=128)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class RegisterRequest(BaseModel):
    # extra="forbid" means a request can't sneak in fields like "role".
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: Password
    first_name: Name
    last_name: Name

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value: str) -> str:
        return value.lower()


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: Annotated[str, Field(min_length=1, max_length=128)]

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value: str) -> str:
        return value.lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
