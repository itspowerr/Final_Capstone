from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class IPFSUploadResponse(BaseModel):
    cid: str
    size: int
    mime_type: str


class ErrorResponse(BaseModel):
    code: str
    message: str


class UserResponse(BaseModel):
    id: str
    username: Optional[str] = None
    email: Optional[str] = None
    role: str
    auth_method: str = "email"
    wallet_address: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[list[str]] = None
    hourly_rate: Optional[float] = None
    rating: Optional[float] = None
    avatar_cid: Optional[str] = None
    headline: Optional[str] = None
    experience_level: Optional[str] = None
    industries: Optional[list[str]] = None
    is_available: Optional[bool] = None
    location: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    portfolio_cids: Optional[list[str]] = None
    is_active: Optional[bool] = None
    created_at: datetime
    totp_enabled: Optional[bool] = None
    email_notifications: Optional[bool] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[list[str]] = None
    hourly_rate: Optional[float] = None
    headline: Optional[str] = None
    experience_level: Optional[str] = None
    is_available: Optional[bool] = None
    industries: Optional[list[str]] = None
    location: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    wallet_address: Optional[str] = None
    portfolio_cids: Optional[list[str]] = None
    avatar_cid: Optional[str] = None
    email_notifications: Optional[bool] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    requires_totp: bool = False
    totp_token: Optional[str] = None
    backup_login: bool = False


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    username: Optional[str] = None
    role: str = "freelancer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    loginRole: str = "client"


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TOTPVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=8)


class TOTPValidateRequest(BaseModel):
    totp_token: str
    code: str = Field(..., min_length=6, max_length=9)


class TOTPSetupResponse(BaseModel):
    secret: str
    qr_code: str
    backup_codes: list[str]
    uri: str


class TOTPStatusResponse(BaseModel):
    enabled: bool
    has_secret: bool


class JobCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    budget: float = Field(..., gt=0)
    category: Optional[str] = None
    skills: list[str] = []
    duration_days: Optional[int] = Field(None, gt=0)
    milestones: list[dict] = Field(default_factory=list, description="Milestones for on-chain contract")


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    budget: Optional[float] = None
    category: Optional[str] = None
    skills: Optional[list[str]] = None
    duration_days: Optional[int] = None
    status: Optional[str] = None
    on_chain_job_id: Optional[int] = None


class JobResponse(BaseModel):
    id: str
    client_id: str
    title: str
    description: Optional[str] = None
    budget: float
    category: Optional[str] = None
    skills: list[str] = []
    duration_days: Optional[int] = None
    status: str
    on_chain_job_id: Optional[int] = None
    created_at: datetime
    applicants_count: int = 0
    has_hired: bool = False

    class Config:
        from_attributes = True


class JobDetailResponse(JobResponse):
    contract_id: Optional[str] = None
    milestones: list["MilestoneResponse"] = []


class MilestoneDef(BaseModel):
    description: str
    amount: float
    due_date: Optional[datetime] = None


class ContractCreate(BaseModel):
    job_id: str
    freelancer_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    total_amount: float = Field(..., gt=0)
    deadline: Optional[datetime] = None
    milestones: list[MilestoneDef] = Field(default_factory=list)
    on_chain_id: Optional[int] = Field(None, description="On-chain contract ID if already deployed via MetaMask")
    contract_address: Optional[str] = Field(None, description="Contract address if already deployed via MetaMask")


class MilestoneResponse(BaseModel):
    id: str
    contract_id: str
    index: int
    description: str
    amount: float
    due_date: Optional[datetime] = None
    deliverable_cid: Optional[str] = None
    submission_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    status: str
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContractResponse(BaseModel):
    id: str
    job_id: Optional[str] = None
    client_id: str
    freelancer_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    total_amount: float
    deadline: Optional[datetime] = None
    terms_cid: Optional[str] = None
    on_chain_id: Optional[int] = None
    contract_address: Optional[str] = None
    status: str
    client_signed: bool = False
    freelancer_signed: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class MilestoneDisputeInfo(BaseModel):
    index: int
    description: str
    amount: float
    status: str
    deliverable_cid: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    class Config:
        from_attributes = True


class ContractDisputeInfo(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    total_amount: float
    status: str
    client_id: str
    freelancer_id: Optional[str] = None
    on_chain_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DisputeResponse(BaseModel):
    id: str
    contract_id: str
    raised_by: str
    reason: str
    status: str
    decision: Optional[str] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    created_at: datetime

    contract_detail: Optional[ContractDisputeInfo] = None
    milestones: list[MilestoneDisputeInfo] = []

    class Config:
        from_attributes = True


class MilestoneReject(BaseModel):
    reason: str = Field(..., min_length=1)


class MilestoneSubmit(BaseModel):
    deliverable_cid: Optional[str] = None
    submission_notes: Optional[str] = None


class DisputeCreate(BaseModel):
    reason: str = Field(..., min_length=1)


class DisputeResolveRequest(BaseModel):
    release_to_freelancer: bool
    resolution_notes: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    action: str
    actor_id: Optional[str] = None
    actor_role: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProposalCreate(BaseModel):
    job_id: str
    cover_letter: Optional[str] = None
    bid_amount: float = Field(..., gt=0)
    estimated_days: Optional[int] = Field(None, gt=0)


class ProposalResponse(BaseModel):
    id: str
    job_id: str
    freelancer_id: str
    cover_letter: Optional[str] = None
    bid_amount: float
    estimated_days: Optional[int] = None
    status: str
    contract_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    email: str = Field(...)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = "freelancer"


class AdminJobCreate(BaseModel):
    client_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    budget: float = Field(..., gt=0)
    category: Optional[str] = None
    skills: list[str] = []
    duration_days: Optional[int] = None
    status: str = "open"


class AdminProposalCreate(BaseModel):
    job_id: str
    freelancer_id: str
    bid_amount: float = Field(..., gt=0)
    cover_letter: Optional[str] = None
    estimated_days: Optional[int] = None
    status: str = "pending"


class AdminContractCreate(BaseModel):
    job_id: str
    client_id: str
    freelancer_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    total_amount: float = Field(..., gt=0)
    deadline: Optional[datetime] = None
    status: str = "draft"


class ContractDetail(BaseModel):
    contract: ContractResponse
    milestones: list[MilestoneResponse]
    dispute: Optional[DisputeResponse] = None
    proposals: list[ProposalResponse] = []