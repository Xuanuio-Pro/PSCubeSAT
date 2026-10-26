-- Development-only database for docker-compose.dev.yml (bound to 127.0.0.1). Never use in production.
CREATE ROLE cubesat LOGIN PASSWORD 'cubesat_dev';
CREATE DATABASE cubesat OWNER cubesat;
