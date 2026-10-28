"""Smoke-test production proxies with isolated Docker containers and trusted local TLS.

No public certificate is requested and no existing service is restarted. Requires
Docker; uses temporary localhost ports, a private test network and a fake backend.
"""
import base64
import hashlib
import http.client
import json
from pathlib import Path
import socket
import ssl
import subprocess
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
BACKEND = '''import base64, hashlib, json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *args): pass
    def do_GET(self):
        data = json.dumps({'path': self.path, 'scheme': self.headers.get('X-Forwarded-Proto')}).encode()
        if self.path.startswith('/ws'):
            key = self.headers['Sec-WebSocket-Key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
            self.send_response(101)
            self.send_header('Upgrade', 'websocket')
            self.send_header('Connection', 'Upgrade')
            self.send_header('Sec-WebSocket-Accept', base64.b64encode(hashlib.sha1(key.encode()).digest()).decode())
            self.end_headers()
            self.wfile.write(bytes([0x81, len(data)]) + data)
            self.wfile.flush()
            self.close_connection = True
        else:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
ThreadingHTTPServer(('0.0.0.0', 8000), Handler).serve_forever()
'''


def docker(*args, check=True):
    return subprocess.run(['docker', *args], capture_output=True, text=True, check=check)


def main():
    prefix = 'pscubesat-https-smoke-' + uuid4().hex[:8]
    folder = ROOT / 'scratch' / prefix
    folder.mkdir(parents=True)
    (folder / 'backend.py').write_text(BACKEND, encoding='utf-8')
    (folder / 'index.html').write_text('<!doctype html><title>USB HTTPS smoke</title>', encoding='utf-8')
    names = [prefix + suffix for suffix in ('-backend', '-frontend', '-gateway')]
    docker('network', 'create', prefix)
    try:
        docker('run', '-d', '--name', names[0], '--network', prefix, '--network-alias', 'fastapi',
               '-v', f'{folder.as_posix()}:/fixtures:ro', 'python:3.12-slim', 'python', '/fixtures/backend.py')
        docker('run', '-d', '--name', names[1], '--network', prefix, '--network-alias', 'frontend',
               '-v', f'{(ROOT / "nginx.conf").as_posix()}:/etc/nginx/conf.d/default.conf:ro',
               '-v', f'{(ROOT / "nginx-security-headers.conf").as_posix()}:/etc/nginx/snippets/security-headers.conf:ro',
               '-v', f'{(folder / "index.html").as_posix()}:/usr/share/nginx/html/index.html:ro',
               'nginx:1.25-alpine')
        docker('run', '-d', '--name', names[2], '--network', prefix, '-e', 'SITE_DOMAIN=localhost',
               '-p', '127.0.0.1::80', '-p', '127.0.0.1::443',
               '-v', f'{(ROOT / "deploy/Caddyfile").as_posix()}:/etc/caddy/Caddyfile:ro', 'caddy:2-alpine')
        ca = folder / 'root.crt'
        deadline = time.monotonic() + 30
        while True:
            result = docker('cp', f'{names[2]}:/data/caddy/pki/authorities/local/root.crt', str(ca), check=False)
            if result.returncode == 0:
                break
            if time.monotonic() >= deadline:
                raise RuntimeError('Caddy local test CA was not ready')
            time.sleep(.25)
        port = int(docker('port', names[2], '443/tcp').stdout.strip().rsplit(':', 1)[1])
        http_port = int(docker('port', names[2], '80/tcp').stdout.strip().rsplit(':', 1)[1])
        context = ssl.create_default_context(cafile=str(ca))
        connection = http.client.HTTPSConnection('localhost', port, context=context, timeout=10)
        connection.request('GET', '/lab1')
        page = connection.getresponse()
        assert page.status == 200
        assert page.getheader('Permissions-Policy') == 'serial=(self)'
        page.read()
        connection.request('GET', '/assets/missing.js')
        missing = connection.getresponse()
        assert missing.status == 404
        missing.read()
        connection.request('GET', '/index.html')
        html = connection.getresponse()
        assert html.getheader('Cache-Control') == 'no-cache'
        html.read()
        connection.request('GET', '/api/health?usb=1')
        response = connection.getresponse()
        assert response.status == 200
        assert response.getheader('Cache-Control') == 'no-store'
        assert json.loads(response.read()) == {'path': '/api/health?usb=1', 'scheme': 'https'}
        connection.close()
        redirect = http.client.HTTPConnection('localhost', http_port, timeout=5)
        redirect.request('GET', '/lab1?usb=1')
        response = redirect.getresponse()
        assert response.status in (301, 302, 307, 308)
        assert response.getheader('Location') == 'https://localhost/lab1?usb=1'
        response.read()
        redirect.close()
        key = base64.b64encode(uuid4().bytes).decode()
        with socket.create_connection(('localhost', port), timeout=10) as tcp:
            with context.wrap_socket(tcp, server_hostname='localhost') as secure:
                secure.sendall((f'GET /ws/test HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\n'
                    f'Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
                stream = secure.makefile('rb')
                assert b'101' in stream.readline()
                headers = {}
                while (line := stream.readline()) != b'\r\n':
                    name, value = line.decode().split(':', 1)
                    headers[name.lower()] = value.strip()
                expected = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
                assert headers['sec-websocket-accept'] == expected
                frame = stream.read(2)
                assert frame[0] == 0x81
                data = json.loads(stream.read(frame[1]))
                assert data == {'path': '/ws/test', 'scheme': 'https'}
                stream.close()
        print('PASS: trusted TLS, HTTP redirect, SPA route, Serial policy, HTTPS API scheme and WSS upgrade/message')
    finally:
        # Only resources created under this random test prefix are removed.
        for name in reversed(names):
            docker('rm', '-f', '-v', name, check=False)
        docker('network', 'rm', prefix, check=False)


if __name__ == '__main__':
    main()
