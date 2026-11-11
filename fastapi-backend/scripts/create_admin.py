"""Tạo tài khoản admin mới hoặc nâng cấp tài khoản hiện có thành admin.

Sử dụng:
    python scripts/create_admin.py --email admin@example.com --password "MatKhau123" --name "Quản trị viên"
Hoặc chạy trực tiếp để nhập qua giao diện console tương tác:
    python scripts/create_admin.py
"""

import argparse
import asyncio
import getpass
import sys
from pathlib import Path

# Đảm bảo thư mục fastapi-backend nằm trong sys.path khi chạy trực tiếp
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.database import get_session_maker  # noqa: E402
from app.models.tables import AccountStatus, User, UserRole  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


async def create_or_promote_admin(email: str, password: str | None, full_name: str | None) -> None:
    email_clean = email.strip().lower()
    if not email_clean or "@" not in email_clean:
        print(f"[!] Email khong hop le: '{email}'")
        sys.exit(1)

    session_maker = get_session_maker()
    async with session_maker() as session:
        result = await session.execute(select(User).where(User.email == email_clean))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            role_val = (
                existing_user.role.value
                if hasattr(existing_user.role, "value")
                else existing_user.role
            )
            print(
                f"[i] Tim thay nguoi dung: {email_clean} (ID: {existing_user.id}, Role hien tai: {role_val})"
            )
            existing_user.role = UserRole.admin
            existing_user.status = AccountStatus.active
            if full_name:
                existing_user.full_name = full_name.strip()
            if password:
                existing_user.password_hash = hash_password(password)
                print("[*] Da cap nhat mat khau moi.")
            await session.commit()
            print(f"[+] Da nang cap thanh cong tai khoan {email_clean} thanh ADMIN!")
        else:
            if not password:
                print("[!] Can cung cap mat khau khi tao tai khoan admin moi.")
                sys.exit(1)

            name_val = (
                full_name.strip() if full_name and full_name.strip() else email_clean.split("@")[0]
            )
            new_admin = User(
                email=email_clean,
                password_hash=hash_password(password),
                full_name=name_val,
                role=UserRole.admin,
                status=AccountStatus.active,
            )
            session.add(new_admin)
            await session.commit()
            await session.refresh(new_admin)
            print(
                f"[+] Da tao moi tai khoan ADMIN thanh cong: {new_admin.email} (ID: {new_admin.id}, Ten: {new_admin.full_name})"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", "-e", help="Email của tài khoản admin")
    parser.add_argument("--password", "-p", help="Mật khẩu của tài khoản admin")
    parser.add_argument("--name", "-n", help="Họ và tên hiển thị")
    args = parser.parse_args()

    email = args.email
    password = args.password
    name = args.name

    if not email:
        email = input("Nhập email admin: ").strip()

    if not password and not args.email:
        # Trong chế độ tương tác, hỏi mật khẩu
        password = getpass.getpass(
            "Nhập mật khẩu (để trống nếu chỉ muốn nâng quyền tài khoản đã có): "
        ).strip()
        if not password:
            password = None

    if not name and not args.email:
        name_input = input("Nhập họ và tên (để trống để giữ nguyên/lấy từ email): ").strip()
        name = name_input if name_input else None

    asyncio.run(create_or_promote_admin(email=email, password=password, full_name=name))


if __name__ == "__main__":
    main()
