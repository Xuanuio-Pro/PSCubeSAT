import sys


def configure_console_encoding():
    """Uvicorn reload workers and Windows pipes may default to cp1252."""
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='backslashreplace')
