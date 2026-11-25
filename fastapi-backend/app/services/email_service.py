"""SMTP email delivery for password recovery links."""

import html
import smtplib
import ssl
from email.message import EmailMessage

from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings


def resolve_frontend_base_url(request_origin: str | None = None) -> str:
    """Resolve frontend origin from trusted config/allowlist; never trust raw Host headers."""
    settings = get_settings()
    if settings.frontend_url.strip():
        return settings.frontend_url.strip().rstrip("/")
    allowed = {origin.rstrip("/") for origin in settings.allowed_origins_list if origin.strip()}
    if request_origin:
        normalized = request_origin.strip().rstrip("/")
        if normalized in allowed:
            return normalized
    if settings.allowed_origins_list:
        return settings.allowed_origins_list[0].rstrip("/")
    return "http://localhost:5175"


def _send_smtp_sync(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    settings = get_settings()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = (
        settings.smtp_from.strip() or settings.smtp_user.strip() or "no-reply@cubesat.local"
    )
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    context = ssl.create_default_context()
    smtp_cls = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP
    with smtp_cls(settings.smtp_host.strip(), settings.smtp_port, timeout=10) as server:
        if not settings.smtp_use_ssl and settings.smtp_use_tls:
            server.starttls(context=context)
        if settings.smtp_user.strip():
            server.login(settings.smtp_user.strip(), settings.smtp_password)
        server.send_message(msg)


async def send_password_reset_email(to_email: str, reset_url: str, ttl_minutes: int) -> None:
    subject = "[PTIT CubeSAT] Đặt lại mật khẩu tài khoản"
    safe_url = html.escape(reset_url, quote=True)
    text_body = (
        "Bạn hoặc ai đó vừa yêu cầu đặt lại mật khẩu trên nền tảng học tập PTIT CubeSAT.\n\n"
        f"Mở liên kết sau để đặt mật khẩu mới (hiệu lực {ttl_minutes} phút, chỉ dùng 1 lần):\n"
        f"{reset_url}\n\n"
        "Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này."
    )
    html_body = (
        '<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">'
        '<h2 style="color:#0a4174">Đặt lại mật khẩu PTIT CubeSAT</h2>'
        "<p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản học tập của mình.</p>"
        f'<p><a href="{safe_url}" style="display:inline-block;padding:10px 18px;'
        'background:#0a4174;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">'
        "Đặt lại mật khẩu</a></p>"
        f"<p>Liên kết có hiệu lực trong <strong>{ttl_minutes} phút</strong> và chỉ sử dụng được một lần.</p>"
        f'<p style="font-size:12px;color:#475569">Hoặc dán liên kết sau vào trình duyệt: {safe_url}</p>'
        '<p style="font-size:12px;color:#64748b">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.</p>'
        "</div>"
    )
    await run_in_threadpool(_send_smtp_sync, to_email, subject, text_body, html_body)


async def send_verification_email(to_email: str, verify_url: str, ttl_hours: int) -> None:
    subject = "[PTIT CubeSAT] Xác minh email đăng ký"
    safe_url = html.escape(verify_url, quote=True)
    text_body = (
        "Cảm ơn bạn đã đăng ký tài khoản trên nền tảng học tập PTIT CubeSAT.\n\n"
        f"Mở liên kết sau để xác minh email (hiệu lực {ttl_hours} giờ, chỉ dùng 1 lần):\n"
        f"{verify_url}\n\n"
        "Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này."
    )
    html_body = (
        '<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">'
        '<h2 style="color:#0a4174">Xác minh email PTIT CubeSAT</h2>'
        "<p>Cảm ơn bạn đã đăng ký. Hãy xác minh email để bắt đầu học.</p>"
        f'<p><a href="{safe_url}" style="display:inline-block;padding:10px 18px;'
        'background:#0a4174;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">'
        "Xác minh email</a></p>"
        f"<p>Liên kết có hiệu lực trong <strong>{ttl_hours} giờ</strong> và chỉ sử dụng được một lần.</p>"
        f'<p style="font-size:12px;color:#475569">Hoặc dán liên kết sau vào trình duyệt: {safe_url}</p>'
        '<p style="font-size:12px;color:#64748b">Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.</p>'
        "</div>"
    )
    await run_in_threadpool(_send_smtp_sync, to_email, subject, text_body, html_body)
