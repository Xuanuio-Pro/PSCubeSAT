-- Historical schema reference only. Use: python -m alembic upgrade head
-- Versioned migrations are authoritative; no fixed admin credentials are seeded.
-- ============================================================
-- PTIT STEM CUBE
-- Database Schema (Clean Version - No Projects, No OTA Firmware)
-- PostgreSQL 15+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE device_status AS ENUM ('offline', 'online', 'sleep', 'error');
CREATE TYPE acl_permission AS ENUM ('allow', 'deny');
CREATE TYPE acl_action AS ENUM ('publish', 'subscribe', 'all');
CREATE TYPE command_status AS ENUM ('pending', 'sent', 'executed', 'failed');

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS
$$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users
(
    id              BIGSERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT,
    role            user_role NOT NULL DEFAULT 'user',
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ -- Soft Delete
);

CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DEVICES
-- ============================================================

CREATE TABLE devices
(
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT
                        REFERENCES users(id)
                        ON DELETE RESTRICT, -- Ngăn xóa user nếu còn liên kết với device

    device_uid          TEXT NOT NULL UNIQUE,
    device_name         TEXT NOT NULL,
    description         TEXT,
    model               TEXT,
    firmware_version    TEXT, -- Cột này vẫn giữ để thiết bị tự gửi báo phiên bản đang chạy
    
    status              device_status DEFAULT 'offline',
    enabled             BOOLEAN DEFAULT TRUE,
    last_seen           TIMESTAMPTZ,

    last_lat            DOUBLE PRECISION,
    last_lon            DOUBLE PRECISION,
    last_alt            DOUBLE PRECISION,
    last_position_at    TIMESTAMPTZ,

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ -- Soft Delete (Bảo vệ lịch sử telemetry)
);

CREATE INDEX idx_devices_uid ON devices(device_uid);
CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_devices_deleted ON devices(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_devices_updated
BEFORE UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MQTT USERS
-- ============================================================

CREATE TABLE mqtt_credentials
(
    id              BIGSERIAL PRIMARY KEY,
    device_id       BIGINT UNIQUE
                    REFERENCES devices(id)
                    ON DELETE CASCADE,

    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    enabled         BOOLEAN DEFAULT TRUE,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mqtt_username ON mqtt_credentials(username);

CREATE TRIGGER trg_mqtt_updated
BEFORE UPDATE ON mqtt_credentials
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MQTT ACL
-- ============================================================

CREATE TABLE mqtt_acl
(
    id              BIGSERIAL PRIMARY KEY,
    device_id       BIGINT
                    REFERENCES devices(id)
                    ON DELETE CASCADE,

    permission      acl_permission NOT NULL,
    action          acl_action NOT NULL,
    topic           TEXT NOT NULL
);

CREATE INDEX idx_acl_device ON mqtt_acl(device_id);

-- ============================================================
-- TELEMETRY (Table Partitioning PG15+)
-- ============================================================

CREATE TABLE telemetry
(
    id              BIGSERIAL,
    device_id       BIGINT NOT NULL,
    payload         JSONB NOT NULL,
    received_at     TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id, received_at) 
) PARTITION BY RANGE (received_at);

-- Tạo sẵn phân vùng cho tháng hiện tại và tháng sau
CREATE TABLE telemetry_2026_07 PARTITION OF telemetry
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
    
CREATE TABLE telemetry_2026_08 PARTITION OF telemetry
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');


CREATE INDEX idx_telemetry_device ON telemetry(device_id);
CREATE INDEX idx_telemetry_time ON telemetry(received_at DESC);
CREATE INDEX idx_telemetry_payload ON telemetry USING GIN(payload);

-- ============================================================
-- LAB PROGRESS
-- ============================================================

CREATE TABLE lab_progress
(
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL
                    REFERENCES users(id)
                    ON DELETE CASCADE,
    lab_id          INTEGER NOT NULL, -- khớp id tĩnh của lab bên frontend (0-8)

    video_watched   BOOLEAN DEFAULT FALSE,
    doc_viewed      BOOLEAN DEFAULT FALSE,
    compiled_at     TIMESTAMPTZ, -- set lần đầu biên dịch thành công cho lab này
    completed_at    TIMESTAMPTZ, -- set khi đạt tiêu chí hoàn thành

    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (user_id, lab_id)
);

CREATE INDEX idx_lab_progress_user ON lab_progress(user_id);

CREATE TRIGGER trg_lab_progress_updated
BEFORE UPDATE ON lab_progress
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMANDS
-- ============================================================

CREATE TABLE commands
(
    id              BIGSERIAL PRIMARY KEY,
    device_id       BIGINT
                    REFERENCES devices(id)
                    ON DELETE RESTRICT,

    command         JSONB NOT NULL,
    status          command_status DEFAULT 'pending',

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    executed_at     TIMESTAMPTZ
);

CREATE INDEX idx_command_device ON commands(device_id);
CREATE INDEX idx_command_status ON commands(status);
