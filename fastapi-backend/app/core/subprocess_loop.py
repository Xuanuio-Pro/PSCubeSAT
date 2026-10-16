"""Run subprocess jobs on a Proactor loop under Windows reload workers."""
import asyncio
from concurrent.futures import Future
from threading import Thread
import sys


async def run_with_subprocesses(operation, *args):
    # Uvicorn's Windows reload worker uses SelectorEventLoop (no subprocesses).
    # Keep Linux and normal Windows Proactor execution on the caller's loop.
    if sys.platform != 'win32' or not isinstance(asyncio.get_running_loop(), asyncio.SelectorEventLoop):
        return await operation(*args)

    loop = asyncio.ProactorEventLoop()
    task = loop.create_task(operation(*args))
    completed = Future()

    def worker():
        result, error = None, None
        try:
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(task)
        except BaseException as exc:
            error = exc
        finally:
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.close()
        if error is None:
            completed.set_result(result)
        else:
            completed.set_exception(error)

    Thread(target=worker, name='compiler-subprocess', daemon=True).start()
    done = asyncio.wrap_future(completed)
    try:
        return await asyncio.shield(done)
    except asyncio.CancelledError:
        # Do not release the build lock until the job's finally block has removed
        # its container and stopped its CLI. Cancelling to_thread alone cannot do this.
        if not completed.done():
            try:
                loop.call_soon_threadsafe(task.cancel)
            except RuntimeError:
                pass  # Worker finished and closed its loop concurrently.
        try:
            await asyncio.shield(done)
        except BaseException:
            pass
        raise
