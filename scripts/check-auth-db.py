"""Exercise auth HTTP handlers with the configured PostgreSQL; remove only own test row.

Run with the backend Python environment after alembic upgrade head.
No user email, password, hash or token is printed.
"""
import asyncio
from pathlib import Path
import secrets
import sys
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'fastapi-backend'))

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select
from app.core.security import verify_password
from app.db.database import get_engine, get_session_maker, init_db
from app.models.tables import RevokedToken, User
from app.routers.auth import router


async def main():
    await init_db()
    app = FastAPI()
    app.include_router(router)
    email = f'auth-check-{uuid4().hex}@example.com'
    password = secrets.token_urlsafe(24)
    sessions = get_session_maker()
    token_hashes = []
    try:
        live = '--live' in sys.argv
        async with AsyncClient(transport=None if live else ASGITransport(app=app),
                               base_url='http://localhost:5175' if live else 'http://test') as client:
            registered = await client.post('/api/auth/register', json={
                'email': email.upper(), 'password': password, 'full_name': 'Kiểm thử lưu tài khoản'})
            assert registered.status_code == 201, 'Registration failed'
            data = registered.json()
            assert data['user']['email'] == email and 'password_hash' not in data['user']
            async with sessions() as db:
                user = (await db.execute(select(User).where(User.email == email))).scalar_one()
                assert user.full_name == 'Kiểm thử lưu tài khoản' and user.role.value == 'user'
                assert user.password_hash != password and verify_password(password, user.password_hash)
            assert (await client.post('/api/auth/register', json={'email': email, 'password': password})).status_code == 400
            assert (await client.post('/api/auth/login', json={'email': email, 'password': 'wrong'})).status_code == 401
            login = await client.post('/api/auth/login', json={'email': email.upper(), 'password': password})
            assert login.status_code == 200 and login.json()['user']['id'] == data['user']['id']
            token = login.json()['access_token']
            headers = {'Authorization': f'Bearer {token}'}
            assert (await client.get('/api/auth/me', headers=headers)).status_code == 200
            assert (await client.post('/api/auth/logout', headers=headers)).status_code == 200
            from hashlib import sha256
            token_hashes.append(sha256(token.encode()).hexdigest())
            assert (await client.get('/api/auth/me', headers=headers)).status_code == 401
            print('PASS: HTTP register -> new DB connection -> bcrypt/name/role -> duplicate -> login -> me -> logout/revocation')
    finally:
        async with sessions() as db:
            await db.execute(delete(RevokedToken).where(RevokedToken.token_hash.in_(token_hashes)))
            await db.execute(delete(User).where(User.email == email))
            await db.commit()
        await get_engine().dispose()
        print('Temporary test account removed; existing accounts retained.')


if __name__ == '__main__':
    asyncio.run(main())
