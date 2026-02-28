from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.ranking import Ranking
from app.models.submission import Submission
from app.models.session import Session
from app.models.user import User
from app.models.question import Question
import uuid


async def compute_rankings(test_id: str, db: AsyncSession):
    """
    Compute rankings for all candidates in a test.
    
    Scoring logic:
    - Each accepted question = 100 points base
    - Bonus for fast runtime (up to 20 points)
    - Penalty for wrong attempts (-10 per wrong attempt)
    - Final score = sum of all question scores
    """

    # Get all sessions for this test
    sessions_result = await db.execute(
        select(Session).where(
            Session.test_id == test_id,
            Session.user_id.isnot(None)
        )
    )
    sessions = sessions_result.scalars().all()

    # Get all questions for this test
    questions_result = await db.execute(
        select(Question).where(Question.test_id == test_id)
    )
    questions = questions_result.scalars().all()
    total_questions = len(questions)

    candidate_scores = []

    for session in sessions:
        # Get all submissions for this session
        subs_result = await db.execute(
            select(Submission).where(
                Submission.session_id == session.id,
                Submission.user_id == session.user_id
            ).order_by(Submission.submitted_at)
        )
        submissions = subs_result.scalars().all()

        # Group by question
        question_submissions = {}
        for sub in submissions:
            qid = str(sub.question_id)
            if qid not in question_submissions:
                question_submissions[qid] = []
            question_submissions[qid].append(sub)

        total_score = 0
        questions_solved = 0
        total_runtime = 0
        penalty = 0

        for qid, qsubs in question_submissions.items():
            wrong_attempts = 0
            accepted = None

            for sub in qsubs:
                if sub.status == "accepted":
                    accepted = sub
                    break
                else:
                    wrong_attempts += 1

            if accepted:
                questions_solved += 1
                base_points = 100

                # Runtime bonus (max 20 points)
                runtime_ms = accepted.runtime_ms or 1000
                runtime_bonus = max(0, 20 - int(runtime_ms / 100))

                # Wrong attempt penalty
                attempt_penalty = wrong_attempts * 10

                question_score = base_points + runtime_bonus - attempt_penalty
                total_score += max(question_score, 10)
                total_runtime += runtime_ms
                penalty += attempt_penalty

        candidate_scores.append({
            "user_id": session.user_id,
            "session_id": session.id,
            "total_score": total_score,
            "questions_solved": questions_solved,
            "total_runtime_ms": total_runtime,
            "penalty_score": penalty,
            "final_score": total_score,
        })

    # Sort by final score desc, then runtime asc
    candidate_scores.sort(
        key=lambda x: (-x["final_score"], x["total_runtime_ms"])
    )

    # Assign ranks and save
    for rank_num, candidate in enumerate(candidate_scores, 1):
        # Check if ranking exists
        existing = await db.execute(
            select(Ranking).where(
                Ranking.test_id == test_id,
                Ranking.user_id == candidate["user_id"]
            )
        )
        ranking = existing.scalar_one_or_none()

        if ranking:
            ranking.rank = rank_num
            ranking.total_score = candidate["total_score"]
            ranking.questions_solved = candidate["questions_solved"]
            ranking.total_runtime_ms = candidate["total_runtime_ms"]
            ranking.penalty_score = candidate["penalty_score"]
            ranking.final_score = candidate["final_score"]
        else:
            ranking = Ranking(
                test_id=test_id,
                user_id=candidate["user_id"],
                rank=rank_num,
                total_score=candidate["total_score"],
                questions_solved=candidate["questions_solved"],
                total_runtime_ms=candidate["total_runtime_ms"],
                penalty_score=candidate["penalty_score"],
                final_score=candidate["final_score"],
            )
            db.add(ranking)

    await db.flush()


async def get_leaderboard(test_id: str, db: AsyncSession) -> list:
    result = await db.execute(
        select(Ranking, User)
        .join(User, Ranking.user_id == User.id)
        .where(Ranking.test_id == test_id)
        .order_by(Ranking.rank)
    )
    rows = result.all()

    return [
        {
            "rank": ranking.rank,
            "user_id": str(ranking.user_id),
            "username": user.username,
            "email": user.email,
            "total_score": ranking.total_score,
            "questions_solved": ranking.questions_solved,
            "total_runtime_ms": ranking.total_runtime_ms,
            "penalty_score": ranking.penalty_score,
            "final_score": ranking.final_score,
        }
        for ranking, user in rows
    ]