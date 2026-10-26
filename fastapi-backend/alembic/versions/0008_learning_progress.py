"""Class learning path, progress events, overrides and versioned submissions.

Downgrade retains additive data and guards; re-upgrade is idempotent.
"""

from alembic import op

revision = "0008_learning_progress"
down_revision = "0007_curriculum"
branch_labels = None
depends_on = None


def upgrade():
    for statement in [
        """CREATE TABLE IF NOT EXISTS prerequisites (
            class_id BIGINT NOT NULL, version INTEGER NOT NULL, lab_id INTEGER NOT NULL, required_lab_id INTEGER NOT NULL,
            PRIMARY KEY(class_id,version,lab_id,required_lab_id),
            FOREIGN KEY(class_id,version) REFERENCES class_course_versions(class_id,version) ON DELETE RESTRICT,
            CONSTRAINT ck_prerequisite_self CHECK(lab_id <> required_lab_id))""",
        """CREATE TABLE IF NOT EXISTS lesson_progress (
            id BIGSERIAL PRIMARY KEY, membership_id BIGINT NOT NULL REFERENCES class_memberships(id) ON DELETE RESTRICT,
            lesson_id TEXT NOT NULL, lesson_version TEXT NOT NULL, course_version_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'not_started', last_position DOUBLE PRECISION NOT NULL DEFAULT 0,
            watched_segments JSONB NOT NULL DEFAULT '[]', completed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_member_lesson_version UNIQUE(membership_id,lesson_version),
            FOREIGN KEY(course_version_id,lesson_id) REFERENCES lessons(course_version_id,id) ON DELETE RESTRICT,
            CONSTRAINT ck_lesson_progress_status CHECK(status IN ('not_started','in_progress','pending_review','completed','waived')))""",
        "CREATE INDEX IF NOT EXISTS ix_lesson_progress_membership_id ON lesson_progress(membership_id)",
        """CREATE TABLE IF NOT EXISTS progress_events (
            idempotency_key TEXT PRIMARY KEY, membership_id BIGINT NOT NULL REFERENCES class_memberships(id) ON DELETE RESTRICT,
            lesson_version TEXT NOT NULL, kind TEXT NOT NULL, payload_hash TEXT NOT NULL, response JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now())""",
        """CREATE TABLE IF NOT EXISTS completion_overrides (
            id BIGSERIAL PRIMARY KEY, membership_id BIGINT NOT NULL REFERENCES class_memberships(id) ON DELETE RESTRICT,
            class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT, version INTEGER NOT NULL,
            action TEXT NOT NULL, lesson_version TEXT, lab_id INTEGER,
            actor BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT, reason TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now())""",
        "CREATE INDEX IF NOT EXISTS ix_completion_overrides_membership_id ON completion_overrides(membership_id)",
        """CREATE TABLE IF NOT EXISTS practice_submissions (
            id BIGSERIAL PRIMARY KEY, progress_id BIGINT NOT NULL REFERENCES lesson_progress(id) ON DELETE RESTRICT,
            revision INTEGER NOT NULL, code TEXT NOT NULL, rubric_snapshot TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending_review', feedback TEXT, reviewed_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
            reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_submission_revision UNIQUE(progress_id,revision))""",
        "CREATE INDEX IF NOT EXISTS ix_practice_submissions_progress_id ON practice_submissions(progress_id)",
    ]:
        op.execute(statement)
    op.execute("""INSERT INTO prerequisites(class_id,version,lab_id,required_lab_id)
        SELECT c.class_id,c.version,(l->>'lab_id')::int,d.value::int FROM class_course_versions c,
            jsonb_array_elements(c.lab_settings) l,
            jsonb_array_elements_text(COALESCE(l->'prerequisites','[]')) d
        WHERE NOT EXISTS(SELECT 1 FROM prerequisites p WHERE p.class_id=c.class_id AND p.version=c.version
            AND p.lab_id=(l->>'lab_id')::int AND p.required_lab_id=d.value::int)""")
    op.execute("""CREATE OR REPLACE FUNCTION guard_prerequisites() RETURNS trigger AS $$
        DECLARE cid BIGINT; rev INT;
        BEGIN
            IF TG_OP='DELETE' THEN cid:=OLD.class_id; rev:=OLD.version; ELSE cid:=NEW.class_id; rev:=NEW.version; END IF;
            IF EXISTS(SELECT 1 FROM class_course_versions WHERE class_id=cid AND version=rev AND status='published')
            OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM class_course_versions WHERE class_id=OLD.class_id AND version=OLD.version AND status='published'))
            THEN RAISE EXCEPTION 'Published prerequisites are immutable'; END IF;
            IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
        END $$ LANGUAGE plpgsql""")
    op.execute("DROP TRIGGER IF EXISTS immutable_prerequisites ON prerequisites")
    op.execute(
        "CREATE TRIGGER immutable_prerequisites BEFORE INSERT OR UPDATE OR DELETE ON prerequisites FOR EACH ROW EXECUTE FUNCTION guard_prerequisites()"
    )


def downgrade():
    # Do not discard progress, submissions, reasons or prerequisite history.
    pass
