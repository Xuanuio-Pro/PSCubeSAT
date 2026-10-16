FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir platformio==6.1.18
ENV PLATFORMIO_CORE_DIR=/opt/platformio PLATFORMIO_SETTING_ENABLE_TELEMETRY=no
COPY app/services/build_config.py app/firmware/export_flash_manifest.py app/firmware/lab1.cpp app/firmware/ptitcube_smoke.cpp app/firmware/camera_driver_smoke.cpp compiler/prepare.py /opt/compiler/
# Download and compile trusted starters at image build time. Runtime has no network.
COPY compiler/overrides /opt/compiler/overrides
RUN python /opt/compiler/prepare.py
COPY compiler/permissions.py /opt/compiler/permissions.py
RUN python /opt/compiler/permissions.py
COPY compiler/job.py /opt/compiler/job.py
ENV PLATFORMIO_CORE_DIR=/work/pio HOME=/work TMPDIR=/tmp PYTHONDONTWRITEBYTECODE=1
USER 65532:65532
WORKDIR /work
ENTRYPOINT ["python", "/opt/compiler/job.py"]
