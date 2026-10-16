from functools import lru_cache

from fastapi import HTTPException
from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings


@lru_cache
def _google_request():
    return Request()


async def verify_google_credential(credential: str) -> dict:
    client_id = get_settings().google_client_id
    if not client_id:
        raise HTTPException(503, 'Đăng nhập Google chưa được cấu hình trên máy chủ.')
    try:
        claims = await run_in_threadpool(
            id_token.verify_oauth2_token, credential, _google_request(), client_id
        )
    except ValueError as exc:
        raise HTTPException(401, 'Thông tin đăng nhập Google không hợp lệ hoặc đã hết hạn.') from exc
    except TransportError as exc:
        raise HTTPException(503, 'Không thể xác thực với Google. Vui lòng thử lại.') from exc
    except GoogleAuthError as exc:
        raise HTTPException(401, 'Thông tin đăng nhập Google không hợp lệ.') from exc
    if claims.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
        raise HTTPException(401, 'Nguồn phát hành token Google không hợp lệ.')
    if not claims.get('sub') or not claims.get('email') or claims.get('email_verified') is not True:
        raise HTTPException(401, 'Tài khoản Google phải có email đã được xác minh.')
    return claims
