"""Private quiz editions, snapshots and durable AI draft jobs.

Downgrade intentionally retains all quiz data and guards. Re-upgrade is idempotent.
Old application code must not be used to administer pilot classes after rollback.
"""

from alembic import op

revision = "0009_quizzes"
down_revision = "0008_learning_progress"
branch_labels = None
depends_on = None

STATEMENTS = [
    """CREATE TABLE IF NOT EXISTS question_generation_budgets (
    day TEXT NOT NULL, 
    reserved_microusd INTEGER DEFAULT '0' NOT NULL, 
    PRIMARY KEY (day)
)""",
    """CREATE TABLE IF NOT EXISTS question_banks (
    id TEXT NOT NULL, 
    class_id BIGINT NOT NULL, 
    course_version_id TEXT NOT NULL, 
    lab_id INTEGER NOT NULL, 
    version INTEGER NOT NULL, 
    revision INTEGER DEFAULT '1' NOT NULL, 
    status TEXT DEFAULT 'draft' NOT NULL, 
    reason TEXT DEFAULT '' NOT NULL, 
    created_by BIGINT NOT NULL, 
    published_by BIGINT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_bank_version UNIQUE (class_id, lab_id, version), 
    FOREIGN KEY(course_version_id, lab_id) REFERENCES labs (course_version_id, id) ON DELETE RESTRICT, 
    CONSTRAINT ck_bank_status CHECK (status IN ('draft','published')), 
    FOREIGN KEY(class_id) REFERENCES classes (id) ON DELETE RESTRICT, 
    FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE RESTRICT, 
    FOREIGN KEY(published_by) REFERENCES users (id) ON DELETE RESTRICT
)""",
    """CREATE TABLE IF NOT EXISTS quiz_attempt_grants (
    idempotency_key TEXT NOT NULL, 
    membership_id BIGINT NOT NULL, 
    lesson_version TEXT NOT NULL, 
    extra_attempts INTEGER NOT NULL, 
    actor BIGINT NOT NULL, 
    reason TEXT NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (idempotency_key), 
    FOREIGN KEY(membership_id) REFERENCES class_memberships (id) ON DELETE RESTRICT, 
    FOREIGN KEY(actor) REFERENCES users (id) ON DELETE RESTRICT
)""",
    """CREATE TABLE IF NOT EXISTS question_generation_jobs (
    id TEXT NOT NULL, 
    bank_id TEXT NOT NULL, 
    actor BIGINT NOT NULL, 
    bank_revision INTEGER NOT NULL, 
    status TEXT DEFAULT 'queued' NOT NULL, 
    sources JSONB NOT NULL, 
    count INTEGER NOT NULL, 
    tries INTEGER DEFAULT '0' NOT NULL, 
    reserved_microusd INTEGER DEFAULT '0' NOT NULL, 
    error TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    started_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(bank_id) REFERENCES question_banks (id) ON DELETE RESTRICT, 
    FOREIGN KEY(actor) REFERENCES users (id) ON DELETE RESTRICT
)""",
    """CREATE TABLE IF NOT EXISTS question_versions (
    id TEXT NOT NULL, 
    bank_id TEXT NOT NULL, 
    question_id TEXT NOT NULL, 
    content JSONB NOT NULL, 
    status TEXT DEFAULT 'draft' NOT NULL, 
    reviewer BIGINT, 
    reviewed_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_bank_question UNIQUE (bank_id, question_id), 
    CONSTRAINT ck_question_status CHECK (status IN ('draft','approved','retired')), 
    FOREIGN KEY(bank_id) REFERENCES question_banks (id) ON DELETE RESTRICT, 
    FOREIGN KEY(reviewer) REFERENCES users (id) ON DELETE RESTRICT
)""",
    """CREATE INDEX IF NOT EXISTS ix_question_versions_bank_id ON question_versions (bank_id)""",
    """CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT NOT NULL, 
    class_id BIGINT NOT NULL, 
    membership_id BIGINT NOT NULL, 
    lab_id INTEGER NOT NULL, 
    lesson_id TEXT NOT NULL, 
    lesson_version TEXT NOT NULL, 
    course_version_id TEXT NOT NULL, 
    bank_id TEXT NOT NULL, 
    number INTEGER NOT NULL, 
    status TEXT DEFAULT 'active' NOT NULL, 
    policy JSONB NOT NULL, 
    answer_revision INTEGER DEFAULT '0' NOT NULL, 
    started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    submitted_at TIMESTAMP WITH TIME ZONE, 
    revealed_at TIMESTAMP WITH TIME ZONE, 
    score INTEGER, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_quiz_number UNIQUE (membership_id, lesson_version, number), 
    CONSTRAINT ck_attempt_status CHECK (status IN ('active','submitted','expired')), 
    FOREIGN KEY(class_id) REFERENCES classes (id) ON DELETE RESTRICT, 
    FOREIGN KEY(membership_id) REFERENCES class_memberships (id) ON DELETE RESTRICT, 
    FOREIGN KEY(bank_id) REFERENCES question_banks (id) ON DELETE RESTRICT
)""",
    """CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_active ON quiz_attempts (membership_id, lesson_version) WHERE status='active'""",
    """CREATE INDEX IF NOT EXISTS ix_quiz_attempts_expires_at ON quiz_attempts (expires_at)""",
    """CREATE INDEX IF NOT EXISTS ix_quiz_attempts_class_id ON quiz_attempts (class_id)""",
    """CREATE TABLE IF NOT EXISTS quiz_policies (
    class_id BIGINT NOT NULL, 
    lab_id INTEGER NOT NULL, 
    bank_id TEXT, 
    revision INTEGER DEFAULT '1' NOT NULL, 
    num_questions INTEGER DEFAULT '5' NOT NULL, 
    time_limit_minutes INTEGER DEFAULT '10' NOT NULL, 
    pass_score INTEGER DEFAULT '4' NOT NULL, 
    max_attempts INTEGER DEFAULT '3' NOT NULL, 
    score_rule TEXT DEFAULT 'highest' NOT NULL, 
    reveal_policy TEXT DEFAULT 'after_attempts' NOT NULL, 
    closes_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (class_id, lab_id), 
    CONSTRAINT ck_quiz_policy CHECK (num_questions=5 AND pass_score BETWEEN 1 AND 5 AND time_limit_minutes BETWEEN 1 AND 180 AND max_attempts BETWEEN 1 AND 100), 
    FOREIGN KEY(class_id) REFERENCES classes (id) ON DELETE RESTRICT, 
    FOREIGN KEY(bank_id) REFERENCES question_banks (id) ON DELETE RESTRICT
)""",
    """CREATE TABLE IF NOT EXISTS quiz_attempt_items (
    id TEXT NOT NULL, 
    attempt_id TEXT NOT NULL, 
    question_version_id TEXT NOT NULL, 
    position INTEGER NOT NULL, 
    snapshot JSONB NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_attempt_position UNIQUE (attempt_id, position), 
    CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_version_id), 
    FOREIGN KEY(attempt_id) REFERENCES quiz_attempts (id) ON DELETE RESTRICT, 
    FOREIGN KEY(question_version_id) REFERENCES question_versions (id) ON DELETE RESTRICT
)""",
    """CREATE INDEX IF NOT EXISTS ix_quiz_attempt_items_attempt_id ON quiz_attempt_items (attempt_id)""",
    """CREATE TABLE IF NOT EXISTS quiz_requests (
    idempotency_key TEXT NOT NULL, 
    membership_id BIGINT NOT NULL, 
    attempt_id TEXT NOT NULL, 
    payload_hash TEXT NOT NULL, 
    revision INTEGER DEFAULT '0' NOT NULL, 
    PRIMARY KEY (idempotency_key), 
    FOREIGN KEY(membership_id) REFERENCES class_memberships (id) ON DELETE RESTRICT, 
    FOREIGN KEY(attempt_id) REFERENCES quiz_attempts (id) ON DELETE RESTRICT
)""",
    """CREATE TABLE IF NOT EXISTS quiz_answers (
    attempt_id TEXT NOT NULL, 
    item_id TEXT NOT NULL, 
    choice_id TEXT NOT NULL, 
    PRIMARY KEY (attempt_id, item_id), 
    FOREIGN KEY(attempt_id) REFERENCES quiz_attempts (id) ON DELETE RESTRICT, 
    FOREIGN KEY(item_id) REFERENCES quiz_attempt_items (id) ON DELETE RESTRICT
)""",
]


def upgrade():
    for statement in STATEMENTS:
        op.execute(statement)
    # Existing classes receive empty draft banks; no specialist content is generated.
    op.execute("""INSERT INTO question_banks(id,class_id,course_version_id,lab_id,version,created_by)
        SELECT 'seed:' || c.class_id || ':' || l.id, c.class_id, c.course_version_id, l.id, 1, cl.created_by
        FROM (SELECT DISTINCT ON (class_id) class_id,course_version_id
            FROM class_course_versions ORDER BY class_id,version DESC) c
        JOIN classes cl ON cl.id=c.class_id
        JOIN labs l ON l.course_version_id=c.course_version_id
        WHERE l.id BETWEEN 0 AND 8
        ON CONFLICT DO NOTHING""")
    op.execute("""INSERT INTO quiz_policies(class_id,lab_id)
        SELECT DISTINCT class_id,lab_id FROM question_banks ON CONFLICT DO NOTHING""")
    op.execute("""CREATE OR REPLACE FUNCTION protect_quiz_bank() RETURNS trigger AS $$
    BEGIN
        IF OLD.status = 'published' THEN RAISE EXCEPTION 'Published bank is immutable'; END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END; $$ LANGUAGE plpgsql""")
    op.execute("DROP TRIGGER IF EXISTS protect_quiz_bank ON question_banks")
    op.execute(
        "CREATE TRIGGER protect_quiz_bank BEFORE UPDATE OR DELETE ON question_banks FOR EACH ROW EXECUTE FUNCTION protect_quiz_bank()"
    )
    op.execute("""CREATE OR REPLACE FUNCTION protect_quiz_question() RETURNS trigger AS $$
    DECLARE target TEXT;
    BEGIN
        IF TG_OP = 'INSERT' THEN target := NEW.bank_id; ELSE target := OLD.bank_id; END IF;
        IF EXISTS (SELECT 1 FROM question_banks WHERE id=target AND status='published') THEN
            RAISE EXCEPTION 'Published question is immutable';
        END IF;
        IF TG_OP='UPDATE' AND NEW.bank_id <> OLD.bank_id THEN RAISE EXCEPTION 'Cannot move a question'; END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END; $$ LANGUAGE plpgsql""")
    op.execute("DROP TRIGGER IF EXISTS protect_quiz_question ON question_versions")
    op.execute(
        "CREATE TRIGGER protect_quiz_question BEFORE INSERT OR UPDATE OR DELETE ON question_versions FOR EACH ROW EXECUTE FUNCTION protect_quiz_question()"
    )
    op.execute("""CREATE OR REPLACE FUNCTION protect_quiz_item() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'Attempt items are immutable'; END; $$ LANGUAGE plpgsql""")
    op.execute("DROP TRIGGER IF EXISTS protect_quiz_item ON quiz_attempt_items")
    op.execute(
        "CREATE TRIGGER protect_quiz_item BEFORE UPDATE OR DELETE ON quiz_attempt_items FOR EACH ROW EXECUTE FUNCTION protect_quiz_item()"
    )
    op.execute("""CREATE OR REPLACE FUNCTION protect_quiz_attempt() RETURNS trigger AS $$
    BEGIN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Attempt history cannot be deleted'; END IF;
        IF (to_jsonb(NEW) - ARRAY['status','score','answer_revision','submitted_at','revealed_at']) IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['status','score','answer_revision','submitted_at','revealed_at']) THEN
            RAISE EXCEPTION 'Attempt snapshot is immutable';
        END IF;
        IF OLD.status <> 'active' AND (NEW.status,NEW.score,NEW.submitted_at,NEW.answer_revision) IS DISTINCT FROM
            (OLD.status,OLD.score,OLD.submitted_at,OLD.answer_revision) THEN RAISE EXCEPTION 'Final grade is immutable'; END IF;
        RETURN NEW;
    END; $$ LANGUAGE plpgsql""")
    op.execute("DROP TRIGGER IF EXISTS protect_quiz_attempt ON quiz_attempts")
    op.execute(
        "CREATE TRIGGER protect_quiz_attempt BEFORE UPDATE OR DELETE ON quiz_attempts FOR EACH ROW EXECUTE FUNCTION protect_quiz_attempt()"
    )
    op.execute("""CREATE OR REPLACE FUNCTION protect_quiz_answer() RETURNS trigger AS $$
    DECLARE target TEXT;
    BEGIN
        IF TG_OP='DELETE' THEN target := OLD.attempt_id; ELSE target := NEW.attempt_id; END IF;
        IF NOT EXISTS (SELECT 1 FROM quiz_attempts WHERE id=target AND status='active') THEN
            RAISE EXCEPTION 'Final answers are immutable';
        END IF;
        IF TG_OP='UPDATE' AND (NEW.attempt_id,NEW.item_id) IS DISTINCT FROM (OLD.attempt_id,OLD.item_id) THEN
            RAISE EXCEPTION 'Cannot move an answer';
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        IF NOT EXISTS (SELECT 1 FROM quiz_attempt_items i, jsonb_array_elements(i.snapshot->'choices') c
            WHERE i.id=NEW.item_id AND i.attempt_id=NEW.attempt_id AND c->>'id'=NEW.choice_id) THEN
            RAISE EXCEPTION 'Choice does not belong to attempt';
        END IF;
        RETURN NEW;
    END; $$ LANGUAGE plpgsql""")
    op.execute("DROP TRIGGER IF EXISTS protect_quiz_answer ON quiz_answers")
    op.execute(
        "CREATE TRIGGER protect_quiz_answer BEFORE INSERT OR UPDATE OR DELETE ON quiz_answers FOR EACH ROW EXECUTE FUNCTION protect_quiz_answer()"
    )


def downgrade():
    # Deliberately preserve data, unique active-attempt index and history guards.
    pass
