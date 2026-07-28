import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text, func, JSON
from sqlalchemy.orm import relationship

from app.database import Base


def generate_pseudonymous_id(prefix: str = "usr") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class UserRole(str, enum.Enum):
    client = "client"
    freelancer = "freelancer"
    admin = "admin"


class AuthMethod(str, enum.Enum):
    email = "email"
    wallet = "wallet"


class ExperienceLevel(str, enum.Enum):
    junior = "junior"
    mid = "mid"
    senior = "senior"
    lead = "lead"


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "freeledger"}

    id = Column(String(50), primary_key=True, default=lambda: generate_pseudonymous_id("usr"))
    username = Column(String(100), nullable=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)
    auth_method = Column(Enum(AuthMethod, name="auth_method", schema="freeledger"), default=AuthMethod.email, nullable=False)
    wallet_address = Column(String(42), nullable=True, index=True)
    role = Column(Enum(UserRole, name="userrole", schema="freeledger"), default=UserRole.freelancer)
    bio = Column(Text, nullable=True)
    skills = Column(JSON, default=list)
    hourly_rate = Column(Float, default=0.0)
    rating = Column(Float, default=0.0)
    avatar_cid = Column(String, nullable=True)
    headline = Column(String(200), nullable=True)
    experience_level = Column(Enum(ExperienceLevel, name="experience_level", schema="freeledger"), default=ExperienceLevel.mid)
    industries = Column(JSON, default=list)
    is_available = Column(Boolean, default=True)
    location = Column(String(200), nullable=True)
    github_url = Column(String(500), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    portfolio_url = Column(String(500), nullable=True)
    portfolio_cids = Column(JSON, default=list)
    totp_secret = Column(String(64), nullable=True)
    totp_enabled = Column(Boolean, default=False)
    totp_backup_codes = Column(JSON, default=list)
    email_notifications = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    jobs = relationship("Job", back_populates="client", foreign_keys="Job.client_id")
    proposals = relationship("Proposal", back_populates="freelancer", foreign_keys="Proposal.freelancer_id")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = {"schema": "freeledger"}

    id = Column(String(50), primary_key=True, default=lambda: generate_pseudonymous_id("job"))
    client_id = Column(String(50), ForeignKey("freeledger.users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    budget = Column(Float, nullable=False)
    category = Column(String(100), nullable=True, index=True)
    skills = Column(JSON, default=list)
    duration_days = Column(Integer, nullable=True)
    status = Column(String(20), default="open", index=True)
    on_chain_job_id = Column(Integer, nullable=True, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    client = relationship("User", back_populates="jobs", foreign_keys=[client_id])
    proposals = relationship("Proposal", back_populates="job", cascade="all, delete-orphan")


class Proposal(Base):
    __tablename__ = "proposals"
    __table_args__ = (
        Index("uq_job_freelancer", "job_id", "freelancer_id", unique=True),
        {"schema": "freeledger"},
    )

    id = Column(String(50), primary_key=True, default=lambda: generate_pseudonymous_id("prop"))
    job_id = Column(String(50), ForeignKey("freeledger.jobs.id"), nullable=False, index=True)
    freelancer_id = Column(String(50), ForeignKey("freeledger.users.id"), nullable=False, index=True)
    cover_letter = Column(Text, nullable=True)
    bid_amount = Column(Float, nullable=False)
    estimated_days = Column(Integer, nullable=True)
    status = Column(String(20), default="pending", index=True)
    contract_id = Column(String(50), ForeignKey("freeledger.contracts.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="proposals")
    freelancer = relationship("User", back_populates="proposals", foreign_keys=[freelancer_id])


class ContractStatus(str, enum.Enum):
    draft = "draft"
    pending_review = "pending_review"
    pending_signatures = "pending_signatures"
    pending_funding = "pending_funding"
    active = "active"
    delivered = "delivered"
    revision_requested = "revision_requested"
    completed = "completed"
    cancelled = "cancelled"
    disputed = "disputed"


class Contract(Base):
    __tablename__ = "contracts"
    __table_args__ = {"schema": "freeledger"}

    id = Column(String(50), primary_key=True, default=lambda: generate_pseudonymous_id("ct"))
    job_id = Column(String(50), ForeignKey("freeledger.jobs.id"), nullable=False, index=True)
    client_id = Column(String(50), ForeignKey("freeledger.users.id"), nullable=False, index=True)
    freelancer_id = Column(String(50), ForeignKey("freeledger.users.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    total_amount = Column(Float, nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=True)
    terms_cid = Column(String, nullable=True)
    on_chain_id = Column(Integer, nullable=True)
    contract_address = Column(String(42), nullable=True)
    status = Column(Enum(ContractStatus, name="contractstatus", schema="freeledger"), default=ContractStatus.draft, index=True)
    client_signed = Column(Boolean, default=False)
    freelancer_signed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    dispute = relationship("Dispute", uselist=False)
    milestones_rel = relationship("ContractMilestone", order_by="ContractMilestone.index")


class MilestoneStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"
    paid = "paid"


class ContractMilestone(Base):
    __tablename__ = "contract_milestones"
    __table_args__ = (
        Index("uq_contract_milestone_index", "contract_id", "index", unique=True),
        {"schema": "freeledger"},
    )

    id = Column(String(50), primary_key=True, default=lambda: generate_pseudonymous_id("ms"))
    contract_id = Column(String(50), ForeignKey("freeledger.contracts.id"), nullable=False, index=True)
    index = Column(Integer, nullable=False)
    description = Column(String(500), nullable=False)
    amount = Column(Float, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    deliverable_cid = Column(String, nullable=True)
    submission_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    status = Column(Enum(MilestoneStatus, name="milestonestatus", schema="freeledger"), default=MilestoneStatus.pending)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)


class DisputeStatus(str, enum.Enum):
    open = "open"
    under_review = "under_review"
    resolved = "resolved"


class DisputeDecision(str, enum.Enum):
    refund = "refund"
    release = "release"


class Dispute(Base):
    __tablename__ = "disputes"
    __table_args__ = {"schema": "freeledger"}

    id = Column(String(50), primary_key=True, default=lambda: generate_pseudonymous_id("dp"))
    contract_id = Column(String(50), ForeignKey("freeledger.contracts.id"), nullable=False, unique=True, index=True)
    raised_by = Column(String(50), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(Enum(DisputeStatus, name="disputestatus", schema="freeledger"), default=DisputeStatus.open, index=True)
    decision = Column(Enum(DisputeDecision, name="disputedecision", schema="freeledger"), nullable=True)
    resolved_by = Column(String(50), ForeignKey("freeledger.users.id"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contract = relationship("Contract", foreign_keys=[contract_id], lazy="select")


class AdminAccount(Base):
    __tablename__ = "admin_accounts"
    __table_args__ = {"schema": "freeledger"}

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey("freeledger.users.id"), unique=True, nullable=False)
    role = Column(String(50), default="admin")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = {"schema": "freeledger"}

    id = Column(String(50), primary_key=True, default=lambda: generate_pseudonymous_id("aud"))
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(50), nullable=False, index=True)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=True)
    action = Column(String(50), nullable=False)
    actor_id = Column(String(50), nullable=True)
    actor_role = Column(String(50), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {"schema": "freeledger"}

    id = Column(String(50), primary_key=True, default=lambda: generate_pseudonymous_id("ntf"))
    user_id = Column(String(50), ForeignKey("freeledger.users.id"), nullable=False, index=True)
    type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(String(50), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())