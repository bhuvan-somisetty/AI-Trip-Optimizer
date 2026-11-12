import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_serializer, field_validator, model_validator

from app.models import AuditEventType, DecisionOutcome, TripStatus, UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    # The ID token (JWT) that Google's sign-in button hands the browser.
    credential: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole


class TravelerCreate(BaseModel):
    name: str
    preferences: dict = {}


class TravelerResponse(BaseModel):
    id: uuid.UUID
    name: str
    preferences: dict
    created_by: uuid.UUID


class TripCreate(BaseModel):
    traveler_id: uuid.UUID
    # 3-letter IATA airport codes, the format the flight and hotel APIs take.
    origin: str = Field(pattern=r"^[A-Za-z]{3}$")
    destination: str = Field(pattern=r"^[A-Za-z]{3}$")
    dates: tuple[date, date]  # [start, end], matches 07_API_Specification.md
    budget: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    preferences: dict = {}

    @field_validator("origin", "destination")
    @classmethod
    def uppercase_code(cls, value: str) -> str:
        return value.upper()

    @model_validator(mode="after")
    def end_not_before_start(self):
        if self.dates[1] < self.dates[0]:
            raise ValueError("End date cannot be before start date")
        return self

    @model_validator(mode="after")
    def origin_differs_from_destination(self):
        if self.origin == self.destination:
            raise ValueError("Origin and destination must be different")
        return self


class TripResponse(BaseModel):
    id: uuid.UUID
    traveler_id: uuid.UUID
    origin: str
    destination: str
    dates: tuple[date, date]
    budget: Decimal
    preferences: dict
    status: TripStatus
    failure_reason: str | None = None
    created_by: uuid.UUID

    @field_serializer("budget")
    def budget_as_number(self, value: Decimal) -> float:
        # Pydantic would emit a Decimal as the string "60000.00"; the API spec (and
        # the frontend) expect a JSON number.
        return float(value)

    @model_validator(mode="before")
    @classmethod
    def build_dates(cls, data):
        # Trip rows store start_date/end_date; the API exposes them as one `dates` pair.
        if hasattr(data, "start_date"):
            return {
                "id": data.id,
                "traveler_id": data.traveler_id,
                "origin": data.origin,
                "destination": data.destination,
                "dates": (data.start_date, data.end_date),
                "budget": data.budget,
                "preferences": data.preferences,
                "status": data.status,
                "failure_reason": data.failure_reason,
                "created_by": data.created_by,
            }
        return data


class ItineraryResponse(BaseModel):
    flight: dict
    # None when no return fare was found on the end date (the flags say so), and on
    # itineraries saved before return flights were searched.
    return_flight: dict | None = None
    hotel: dict | None
    total_cost: float
    # PRD US-010: the median options that met every rule minus the chosen ones, summed.
    # None on itineraries saved before savings were worked out.
    savings: float | None = None
    within_budget: bool
    flags: list[str]
    rationale: str
    # "flight"/"return"/"stay" line items a reviewer swapped in by hand; empty when untouched.
    picked: list[str] = []
    # False for itineraries saved before edits existed: re-optimize to make them editable.
    editable: bool = True


class ItineraryEdit(BaseModel):
    """PATCH /trips/{id}/itinerary: swap one line item for another option from the same search."""

    kind: Literal["flight", "return", "stay"]
    option_id: str


class LedgerEntryResponse(BaseModel):
    # "flight", "return" or "stay"; None for itineraries saved before the pipeline recorded it.
    kind: str | None = None
    alternative: str
    price: float
    won: bool
    reason: str


class TripResultResponse(BaseModel):
    """What POST /trips/{id}/optimize and GET /trips/{id}/itinerary return.

    On success `itinerary` and `tradeoff_ledger` are filled and `reason` is null;
    on OPTIMIZATION_FAILED `itinerary` is null and `reason` says why.
    """

    status: TripStatus
    itinerary: ItineraryResponse | None
    tradeoff_ledger: list[LedgerEntryResponse]
    reason: str | None


class WhatIfRequest(BaseModel):
    """POST /trips/{id}/preview and /preview/apply (PRD US-011): the inputs to change.

    Only the fields sent are changed. Sending a preference as null removes it, so the
    optimizer stops screening on it; leaving it out keeps the trip's current value.
    """

    budget: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    cabin_class: Literal["economy", "premium_economy", "business"] | None = None
    max_stops: int | None = Field(default=None, ge=0, le=2)
    min_hotel_rating: float | None = Field(default=None, ge=0, le=5)

    @model_validator(mode="after")
    def something_changes(self):
        if not self.model_fields_set:
            raise ValueError("Change at least one input: budget, cabin_class, max_stops or min_hotel_rating")
        if "budget" in self.model_fields_set and self.budget is None:
            raise ValueError("budget can't be removed, only changed")
        return self


class Change(BaseModel):
    """One field that differs between the saved trip and the preview."""

    field: str
    before: str | float | int | bool | None
    after: str | float | int | bool | None


class WhatIfResponse(BaseModel):
    """The preview next to what is saved. Nothing is saved by POST /trips/{id}/preview."""

    inputs: list[Change]  # the inputs that were changed
    preview: TripResultResponse  # status is what the trip would become: OPTIMIZED or OPTIMIZATION_FAILED
    diff: list[Change]  # what that changes in the itinerary; empty if the result is the same


class DashboardResponse(BaseModel):
    """GET /dashboard (PRD US-010). Money is in INR."""

    period: str  # e.g. "2026-Q4", "2026-11", "2026", or "all"
    trips_created: int
    trips_decided: int
    approved: int
    rejected: int
    total_spend: float  # sum of approved itineraries' totals
    avg_savings: float | None  # over approved itineraries that have a savings figure
    avg_turnaround_hours: float | None  # trip created -> decided, over decided trips


class DecisionCreate(BaseModel):
    outcome: DecisionOutcome
    reason: str | None = None

    @field_validator("reason")
    @classmethod
    def blank_reason_is_none(cls, value: str | None) -> str | None:
        # "   " is not a reason; the endpoint then treats it as missing.
        return value.strip() or None if value is not None else None


class DecisionResponse(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    outcome: DecisionOutcome
    reason: str | None
    decided_by: uuid.UUID
    decided_at: datetime


class AuditEventResponse(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID | None
    event_type: AuditEventType
    actor: str  # email of the user who did it
    summary: str
    payload: dict
    created_at: datetime
