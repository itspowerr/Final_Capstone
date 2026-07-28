"""
Seed the database with fake data for local testing.

Usage (from backend/ with venv active):
    python -m scripts.seed_fake_data
"""

import asyncio
import random
import sys
from datetime import timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from faker import Faker
from sqlalchemy import select

from app.database import async_session_factory
from app.models import (
    Contract,
    ContractMilestone,
    ContractStatus,
    ExperienceLevel,
    Job,
    MilestoneStatus,
    Notification,
    Proposal,
    User,
    UserRole,
)
from app.routers.auth import hash_password

fake = Faker()

NUM_FREELANCERS = 35
NUM_CLIENTS = 15
NUM_JOBS = 40
MIN_PROPOSALS_PER_JOB = 2
MAX_PROPOSALS_PER_JOB = 5
CONTRACT_RATE = 0.4  # fraction of jobs that get a contract from one of their proposals

SKILLS_POOL = [
    "React", "Node.js", "Python", "Solidity", "TypeScript", "Django",
    "FastAPI", "PostgreSQL", "AWS", "Docker", "GraphQL", "Vue.js",
    "Rust", "Go", "Kubernetes", "UI/UX Design", "Figma", "Web3.js",
    "Smart Contracts", "Machine Learning",
]
CATEGORIES = [
    "Web Development", "Mobile Development", "Blockchain", "Design",
    "Data Science", "DevOps", "Writing", "Marketing",
]
JOB_STATUSES = ["open", "in_progress", "completed"]
FAKE_PASSWORD = "FakePass123"


def random_skills(k=None):
    return random.sample(SKILLS_POOL, k or random.randint(2, 5))


async def seed():
    async with async_session_factory() as db:
        existing = (await db.execute(select(User.id).limit(1))).first()
        if existing:
            print("Existing users found — adding fake data on top of them.")

        password_hash = hash_password(FAKE_PASSWORD)

        freelancers = []
        for _ in range(NUM_FREELANCERS):
            user = User(
                username=fake.name(),
                email=fake.unique.email(),
                password_hash=password_hash,
                role=UserRole.freelancer,
                bio=fake.paragraph(nb_sentences=4),
                skills=random_skills(),
                hourly_rate=round(random.uniform(15, 150), 2),
                rating=round(random.uniform(3.5, 5.0), 1),
                headline=fake.job(),
                experience_level=random.choice(list(ExperienceLevel)),
                industries=random.sample(CATEGORIES, k=random.randint(1, 3)),
                is_available=random.random() > 0.2,
                location=f"{fake.city()}, {fake.country()}",
                github_url=f"https://github.com/{fake.user_name()}",
                linkedin_url=f"https://linkedin.com/in/{fake.user_name()}",
            )
            db.add(user)
            freelancers.append(user)

        clients = []
        for _ in range(NUM_CLIENTS):
            user = User(
                username=fake.company(),
                email=fake.unique.email(),
                password_hash=password_hash,
                role=UserRole.client,
                bio=fake.catch_phrase(),
                location=f"{fake.city()}, {fake.country()}",
            )
            db.add(user)
            clients.append(user)

        await db.flush()  # assign IDs

        jobs = []
        for _ in range(NUM_JOBS):
            job = Job(
                client_id=random.choice(clients).id,
                title=fake.catch_phrase(),
                description=fake.paragraph(nb_sentences=6),
                budget=round(random.uniform(200, 10000), 2),
                category=random.choice(CATEGORIES),
                skills=random_skills(),
                duration_days=random.choice([7, 14, 30, 60, 90]),
                status=random.choice(JOB_STATUSES),
            )
            db.add(job)
            jobs.append(job)

        await db.flush()

        contracts_made = 0
        for job in jobs:
            applicants = random.sample(
                freelancers, k=min(random.randint(MIN_PROPOSALS_PER_JOB, MAX_PROPOSALS_PER_JOB), len(freelancers))
            )
            proposals = []
            for freelancer in applicants:
                proposal = Proposal(
                    job_id=job.id,
                    freelancer_id=freelancer.id,
                    cover_letter=fake.paragraph(nb_sentences=3),
                    bid_amount=round(job.budget * random.uniform(0.7, 1.1), 2),
                    estimated_days=random.choice([5, 10, 20, 30]),
                    status="pending",
                )
                db.add(proposal)
                proposals.append(proposal)

            await db.flush()

            if random.random() < CONTRACT_RATE and proposals:
                accepted = random.choice(proposals)
                accepted.status = "accepted"
                for p in proposals:
                    if p is not accepted:
                        p.status = "rejected"

                contract = Contract(
                    job_id=job.id,
                    client_id=job.client_id,
                    freelancer_id=accepted.freelancer_id,
                    title=job.title,
                    description=job.description,
                    total_amount=accepted.bid_amount,
                    deadline=fake.date_time_between(start_date="+7d", end_date="+90d", tzinfo=timezone.utc),
                    status=random.choice(list(ContractStatus)),
                    client_signed=True,
                    freelancer_signed=random.random() > 0.3,
                )
                db.add(contract)
                await db.flush()
                accepted.contract_id = contract.id

                num_milestones = random.randint(2, 4)
                remaining = contract.total_amount
                for i in range(num_milestones):
                    amount = round(remaining / (num_milestones - i), 2) if i < num_milestones - 1 else round(remaining, 2)
                    remaining -= amount
                    db.add(
                        ContractMilestone(
                            contract_id=contract.id,
                            index=i,
                            description=fake.sentence(nb_words=6),
                            amount=amount,
                            due_date=contract.deadline - timedelta(days=(num_milestones - i) * 7),
                            status=random.choice(list(MilestoneStatus)),
                        )
                    )

                db.add(
                    Notification(
                        user_id=accepted.freelancer_id,
                        type="proposal_accepted",
                        title="Your proposal was accepted!",
                        message=f'Your proposal for "{job.title}" was accepted.',
                        entity_type="contract",
                        entity_id=contract.id,
                    )
                )
                contracts_made += 1

        await db.commit()
        print(f"Seeded {NUM_FREELANCERS} freelancers, {NUM_CLIENTS} clients, {NUM_JOBS} jobs, "
              f"{contracts_made} contracts.")
        print(f"All fake users share the password: {FAKE_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
