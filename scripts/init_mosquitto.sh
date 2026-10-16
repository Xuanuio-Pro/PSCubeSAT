#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Script khởi tạo Mosquitto passwd file lần đầu
# Chạy: bash scripts/init_mosquitto.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

PASSWD_FILE="mosquitto/config/passwd"
ACL_FILE="mosquitto/config/acl"

echo "🔐 Khởi tạo Mosquitto credentials..."

# Kiểm tra mosquitto_passwd đã cài chưa
if ! command -v mosquitto_passwd &> /dev/null; then
    echo "⚠️  mosquitto_passwd chưa cài. Đang cài..."
    sudo apt-get install -y mosquitto-clients mosquitto
fi

# Tạo passwd file với backend-service account
echo "→ Tạo tài khoản backend-service..."
mosquitto_passwd -c -b "$PASSWD_FILE" backend-service "cubesat_backend_2024"

echo ""
echo "✅ Mosquitto passwd file tạo thành công: $PASSWD_FILE"
echo ""
echo "📋 Thông tin tài khoản backend-service:"
echo "   Username: backend-service"
echo "   Password: cubesat_backend_2024"
echo ""
echo "⚠️  Nhớ thay đổi password trong production!"
echo "   Lệnh đổi: mosquitto_passwd -b $PASSWD_FILE backend-service <new-password>"
echo ""
echo "🚀 Tiếp theo: docker compose up -d mosquitto"
