from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.tables import User
from app.repository.device import DeviceRepository
from app.schemas.simulation import CreateSimulationRequest, SimulationResponse
from app.services.auth import get_required_user
from app.services.simulation.manager import SimulationSession, simulation_manager

router = APIRouter(prefix="/api/simulations", tags=["simulations"])


def _response(session: SimulationSession) -> SimulationResponse:
    return SimulationResponse(**session.to_dict())


def _get_owned_session(session_id: str, user: User) -> SimulationSession:
    try:
        session = simulation_manager.get(session_id)
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy simulation session.",
        ) from exc

    if session.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập simulation session này.",
        )

    return session


@router.post("", response_model=SimulationResponse, status_code=status.HTTP_201_CREATED)
async def create_simulation(
    request: CreateSimulationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    device = await DeviceRepository(db).get_by_id(request.device_id)
    if not device or not device.enabled or device.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy thiết bị thuộc tài khoản hiện tại.",
        )

    active_sessions = [
        item
        for item in simulation_manager.list_for_user(current_user.id)
        if item.device_uid == device.device_uid and item.status in {"starting", "running", "paused"}
    ]
    if active_sessions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Thiết bị đang có một simulation session hoạt động.",
        )

    session = await simulation_manager.create(
        user_id=current_user.id,
        device_id=device.id,
        device_uid=device.device_uid,
        config=request.config.model_dump(),
    )
    return _response(session)


@router.get("", response_model=list[SimulationResponse])
async def list_simulations(
    current_user: User = Depends(get_required_user),
):
    return [_response(session) for session in simulation_manager.list_for_user(current_user.id)]


@router.get("/{simulation_id}", response_model=SimulationResponse)
async def get_simulation(
    simulation_id: str,
    current_user: User = Depends(get_required_user),
):
    return _response(_get_owned_session(simulation_id, current_user))


@router.post("/{simulation_id}/start", response_model=SimulationResponse)
async def start_simulation(
    simulation_id: str,
    current_user: User = Depends(get_required_user),
    db: AsyncSession = Depends(get_db),
):
    session = _get_owned_session(simulation_id, current_user)
    if not await DeviceRepository(db).check_user_owns_device(
        current_user.id, session.device_uid, enabled_only=True
    ):
        raise HTTPException(404, "Thiết bị không còn hoạt động.")
    return _response(await simulation_manager.start(simulation_id))


@router.post("/{simulation_id}/pause", response_model=SimulationResponse)
async def pause_simulation(
    simulation_id: str,
    current_user: User = Depends(get_required_user),
):
    _get_owned_session(simulation_id, current_user)
    return _response(await simulation_manager.pause(simulation_id))


@router.post("/{simulation_id}/resume", response_model=SimulationResponse)
async def resume_simulation(
    simulation_id: str,
    current_user: User = Depends(get_required_user),
    db: AsyncSession = Depends(get_db),
):
    session = _get_owned_session(simulation_id, current_user)
    if not await DeviceRepository(db).check_user_owns_device(
        current_user.id, session.device_uid, enabled_only=True
    ):
        raise HTTPException(404, "Thiết bị không còn hoạt động.")
    return _response(await simulation_manager.resume(simulation_id))


@router.post("/{simulation_id}/reset", response_model=SimulationResponse)
async def reset_simulation(
    simulation_id: str,
    current_user: User = Depends(get_required_user),
):
    _get_owned_session(simulation_id, current_user)
    return _response(await simulation_manager.reset(simulation_id))


@router.post("/{simulation_id}/stop", response_model=SimulationResponse)
async def stop_simulation(
    simulation_id: str,
    current_user: User = Depends(get_required_user),
):
    _get_owned_session(simulation_id, current_user)
    return _response(await simulation_manager.stop(simulation_id))


@router.delete("/{simulation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_simulation(
    simulation_id: str,
    current_user: User = Depends(get_required_user),
):
    _get_owned_session(simulation_id, current_user)
    await simulation_manager.delete(simulation_id)
