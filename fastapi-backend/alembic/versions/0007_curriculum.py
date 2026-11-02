"""Versioned curriculum; published snapshots are immutable in PostgreSQL.

Downgrade retains additive schema/data; a subsequent upgrade reinstalls guards.
"""

from alembic import op

revision = "0007_curriculum"
down_revision = "0006_class_management"
branch_labels = None
depends_on = None


def upgrade():
    statements = [
        """CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, title TEXT NOT NULL)""",
        """CREATE TABLE IF NOT EXISTS course_versions (
            id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
            version INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'draft', source_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_course_version UNIQUE(course_id,version),
            CONSTRAINT ck_course_version_status CHECK(status IN ('draft','published'))
        )""",
        """CREATE TABLE IF NOT EXISTS labs (
            course_version_id TEXT NOT NULL REFERENCES course_versions(id) ON DELETE RESTRICT,
            id INTEGER NOT NULL, order_no INTEGER NOT NULL, title TEXT NOT NULL,
            objectives TEXT NOT NULL, estimated_minutes INTEGER NOT NULL,
            groups JSONB NOT NULL, evidence TEXT NOT NULL,
            PRIMARY KEY(course_version_id,id), CONSTRAINT uq_lab_order UNIQUE(course_version_id,order_no),
            CONSTRAINT ck_lab_order CHECK(order_no BETWEEN 0 AND 8)
        )""",
        """CREATE TABLE IF NOT EXISTS lessons (
            course_version_id TEXT NOT NULL, id TEXT NOT NULL, lab_id INTEGER NOT NULL,
            type TEXT NOT NULL, order_no INTEGER NOT NULL, title TEXT NOT NULL,
            content JSONB NOT NULL, completion_rule JSONB NOT NULL, preview_allowed BOOLEAN NOT NULL DEFAULT false,
            PRIMARY KEY(course_version_id,id),
            FOREIGN KEY(course_version_id,lab_id) REFERENCES labs(course_version_id,id) ON DELETE RESTRICT,
            CONSTRAINT uq_lesson_order UNIQUE(course_version_id,lab_id,order_no),
            CONSTRAINT ck_lesson_type CHECK(type IN ('video','document','practice','labtest'))
        )""",
        """CREATE TABLE IF NOT EXISTS class_course_versions (
            class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
            version INTEGER NOT NULL, course_version_id TEXT NOT NULL REFERENCES course_versions(id) ON DELETE RESTRICT,
            status TEXT NOT NULL, lab_settings JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY(class_id,version), CONSTRAINT ck_class_course_status CHECK(status IN ('draft','published'))
        )""",
        """CREATE TABLE IF NOT EXISTS class_lesson_settings (
            class_id BIGINT NOT NULL, version INTEGER NOT NULL, lesson_id TEXT NOT NULL,
            course_version_id TEXT NOT NULL, enabled BOOLEAN NOT NULL, required BOOLEAN NOT NULL,
            order_no INTEGER NOT NULL, params JSONB NOT NULL, status TEXT NOT NULL,
            PRIMARY KEY(class_id,version,lesson_id),
            FOREIGN KEY(class_id,version) REFERENCES class_course_versions(class_id,version) ON DELETE RESTRICT,
            FOREIGN KEY(course_version_id,lesson_id) REFERENCES lessons(course_version_id,id) ON DELETE RESTRICT,
            CONSTRAINT ck_class_lesson_status CHECK(status IN ('draft','published'))
        )""",
    ]
    for statement in statements:
        op.execute(statement)
    op.execute("""CREATE OR REPLACE FUNCTION guard_course_snapshot() RETURNS trigger AS $$
    DECLARE ver TEXT;
    BEGIN
        IF TG_TABLE_NAME = 'course_versions' THEN
            IF OLD.status = 'published' THEN RAISE EXCEPTION 'Published course is immutable'; END IF;
        ELSE
            IF TG_OP = 'DELETE' THEN ver := OLD.course_version_id; ELSE ver := NEW.course_version_id; END IF;
            IF EXISTS(SELECT 1 FROM course_versions WHERE id=ver AND status='published')
               OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM course_versions WHERE id=OLD.course_version_id AND status='published'))
            THEN RAISE EXCEPTION 'Published course content is immutable'; END IF;
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END $$ LANGUAGE plpgsql""")
    for table in ("course_versions", "labs", "lessons"):
        op.execute(f"DROP TRIGGER IF EXISTS immutable_course ON {table}")
        actions = "UPDATE OR DELETE" if table == "course_versions" else "INSERT OR UPDATE OR DELETE"
        op.execute(
            f"CREATE TRIGGER immutable_course BEFORE {actions} ON {table} FOR EACH ROW EXECUTE FUNCTION guard_course_snapshot()"
        )
    op.execute("""CREATE OR REPLACE FUNCTION guard_class_snapshot() RETURNS trigger AS $$
    DECLARE cid BIGINT; rev INTEGER; parent_course TEXT;
    BEGIN
        IF TG_TABLE_NAME='class_course_versions' THEN
            IF TG_OP <> 'INSERT' AND OLD.status='published' THEN RAISE EXCEPTION 'Published class configuration is immutable'; END IF;
            IF TG_OP <> 'DELETE' AND NOT EXISTS(SELECT 1 FROM course_versions WHERE id=NEW.course_version_id AND status='published')
            THEN RAISE EXCEPTION 'Class requires a published course version'; END IF;
        ELSE
            IF TG_OP='DELETE' THEN cid:=OLD.class_id; rev:=OLD.version; ELSE cid:=NEW.class_id; rev:=NEW.version; END IF;
            IF EXISTS(SELECT 1 FROM class_course_versions WHERE class_id=cid AND version=rev AND status='published')
              OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM class_course_versions WHERE class_id=OLD.class_id AND version=OLD.version AND status='published'))
            THEN RAISE EXCEPTION 'Published lesson configuration is immutable'; END IF;
            IF TG_OP <> 'DELETE' THEN
                SELECT course_version_id INTO parent_course FROM class_course_versions WHERE class_id=cid AND version=rev;
                IF parent_course IS DISTINCT FROM NEW.course_version_id THEN RAISE EXCEPTION 'Lesson version mismatch'; END IF;
            END IF;
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END $$ LANGUAGE plpgsql""")
    for table in ("class_course_versions", "class_lesson_settings"):
        op.execute(f"DROP TRIGGER IF EXISTS immutable_class_config ON {table}")
        op.execute(
            f"CREATE TRIGGER immutable_class_config BEFORE INSERT OR UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION guard_class_snapshot()"
        )


def downgrade():
    # Retain published course/configuration snapshots and their immutability guards.
    pass
