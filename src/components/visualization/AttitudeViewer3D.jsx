import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import { useTelemetry } from '../../contexts/telemetry-api';
import * as THREE from 'three';

function CubeSatModel({ quaternion }) {
  return (
    <group quaternion={quaternion}>
      {/* Main body */}
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#5aa9f0" metalness={0.15} roughness={0.55} />
      </mesh>

      {/* Solar panels */}
      <mesh position={[1.1, 0, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1, 0.8, 0.03]} />
        <meshStandardMaterial color="#3f6fe0" emissive="#1d3fa8" emissiveIntensity={0.45} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[-1.1, 0, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1, 0.8, 0.03]} />
        <meshStandardMaterial color="#3f6fe0" emissive="#1d3fa8" emissiveIntensity={0.45} metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Solar panel grid lines */}
      {[-1.1, 1.1].map((x, idx) => (
        <group key={idx}>
          {Array.from({ length: 4 }, (_, i) => (
            <mesh key={i} position={[x, -0.3 + i * 0.2, 0.02]}>
              <boxGeometry args={[0.95, 0.005, 0.005]} />
              <meshBasicMaterial color="#9fb8ff" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Antenna */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#f44" emissive="#f44" emissiveIntensity={0.3} />
      </mesh>

      {/* Camera lens */}
      <mesh position={[0, 0, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.06, 16]} />
        <meshStandardMaterial color="#f59e0b" emissive="#b45309" emissiveIntensity={0.35} metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.55]}>
        <circleGeometry args={[0.1, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#0891b2" emissiveIntensity={0.6} />
      </mesh>

      {/* Labels */}
      <Text position={[0, -0.55, 0.51]} fontSize={0.08} color="#e2e8f0" anchorX="center">
        PTIT CubeSat
      </Text>
    </group>
  );
}

/** Arrow in the fixed sensor-axis frame; `vector` is any [x, y, z] array, drawn with `length`. */
function VectorArrow({ vector, length, color }) {
  const arrow = useMemo(() => {
    const [x, y, z] = vector;
    return new THREE.ArrowHelper(new THREE.Vector3(x, y, z).normalize(), new THREE.Vector3(), length, color, 0.3, 0.15);
  }, [vector, length, color]);
  return <primitive object={arrow} />;
}

const finiteVector = (x, y, z) => [x, y, z].every(value => typeof value === 'number' && Number.isFinite(value)) && Math.hypot(x, y, z) > 1e-6 ? [x, y, z] : null;
const sensorToScene = (x, y, z) => new THREE.Vector3(x, z, -y); // sensor Z (up when flat) -> scene Y, sensor Y -> scene -Z
const ACCEL_COLOR = '#e3b341';
const MAG_COLOR = '#a371f7';

function AxisHelper() {
  return (
    <group>
      {/* X axis - Red */}
      <mesh position={[1.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.01, 0.01, 3, 4]} />
        <meshBasicMaterial color="#f85149" />
      </mesh>
      <Text position={[3.2, 0, 0]} fontSize={0.15} color="#f85149">X</Text>

      {/* Y axis - Green */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 3, 4]} />
        <meshBasicMaterial color="#3fb950" />
      </mesh>
      <Text position={[0, 3.2, 0]} fontSize={0.15} color="#3fb950">Lên ↑</Text>

      {/* Z axis - Blue */}
      <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 3, 4]} />
        <meshBasicMaterial color="#388bfd" />
      </mesh>
      <Text position={[0, 0, 3.2]} fontSize={0.15} color="#388bfd">Z</Text>
    </group>
  );
}

/** @param {{height?: number|string}} props */
export default function AttitudeViewer3D({ height = 350 }) {
  const { attitude, attitudeReceivedAt, now, status, latest, activity, mode, link, exerciseId } = useTelemetry();
  const display = value => value == null ? '—' : value.toFixed(1);
  // Lab4-02a only prints raw accelerometer counts: tilt comes from the direction, which does not depend on the sensor range.
  const raw = /^Lab4-02a/.test(exerciseId);
  const rawSample = activity.subsystems['raw-imu'];
  const rawFresh = Boolean(raw && mode === 'serial' && link === 'connected' && rawSample && now - rawSample.at <= 5000);
  const [rx, ry, rz] = rawFresh ? rawSample.values : [];
  const rotation = raw
    ? { pitch: rawFresh ? Math.atan2(-rx, Math.hypot(ry, rz)) * 180 / Math.PI : null, roll: rawFresh ? Math.atan2(ry, rz) * 180 / Math.PI : null, yaw: null }
    : attitude;
  const imuFresh = raw ? rawFresh : attitudeReceivedAt !== null && now - attitudeReceivedAt <= 5000;
  const waiting = raw ? !rawSample : attitudeReceivedAt === null;
  const accelBody = raw ? (rawFresh ? finiteVector(rx, ry, rz) : null) : finiteVector(latest?.accX, latest?.accY, latest?.accZ);
  const magBody = raw ? null : finiteVector(latest?.magX, latest?.magY, latest?.magZ);
  const [ax, ay, az] = accelBody ?? [];
  const [mx, my, mz] = magBody ?? [];
  const yaw = raw ? 0 : rotation.yaw ?? 0;
  // World frame: +Y is up. The accelerometer at rest reads the reaction to gravity (+1 g "up"), so the body is tilted until
  // its measured "up" matches world up; gravity itself is then drawn pointing down. Heading comes only from relative gyro yaw.
  const { quaternion, gravity, mag } = useMemo(() => {
    const q = new THREE.Quaternion();
    if (ax !== undefined) q.setFromUnitVectors(sensorToScene(ax, ay, az).normalize(), new THREE.Vector3(0, 1, 0));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(yaw)));
    return {
      quaternion: q,
      gravity: ax === undefined ? null : [0, -1, 0],
      mag: mx === undefined ? null : sensorToScene(mx, my, mz).applyQuaternion(q).toArray(),
    };
  }, [ax, ay, az, mx, my, mz, yaw]);
  const accelLength = ax === undefined ? 0 : raw ? 2 : Math.min(Math.hypot(ax, ay, az), 2.5) * 1.5;
  return (
    <div className="card" style={{ opacity: status === 'live' && imuFresh ? 1 : 0.65 }}>
      <div className="card-header">
        <h3>🛰️ 3D Attitude Viewer {!imuFresh && <small>· {link !== 'connected' ? 'mất kết nối' : waiting ? 'chờ IMU' : 'chưa có mẫu IMU mới'}</small>}</h3>
        <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--accent-red)' }}>P: {display(rotation.pitch)}°</span>
          <span style={{ color: 'var(--accent-green)' }}>R: {display(rotation.roll)}°</span>
          <span style={{ color: 'var(--accent-blue)' }}>Y tương đối: {display(rotation.yaw)}°</span>
        </div>
      </div>
      <div style={{ height, background: '#16213a' }}>
        <Canvas camera={{ position: [3, 2, 3], fov: 50 }}>
          <ambientLight intensity={0.9} />
          <hemisphereLight args={['#dbeafe', '#334155', 0.8]} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <pointLight position={[-3, -3, -3]} intensity={0.3} color="#388bfd" />

          <CubeSatModel quaternion={quaternion} />
          <AxisHelper />
          {gravity && <VectorArrow vector={gravity} length={accelLength} color={ACCEL_COLOR} />}
          {mag && <VectorArrow vector={mag} length={2} color={MAG_COLOR} />}

          <Grid
            position={[0, -2, 0]}
            args={[10, 10]}
            cellSize={0.5}
            cellThickness={0.5}
            cellColor="#1a1f2e"
            sectionSize={2}
            sectionColor="#30363d"
            fadeDistance={25}
            infiniteGrid
          />

          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={2}
            maxDistance={10}
          />
        </Canvas>
      </div>
      <div className="vector-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '8px 12px', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: ACCEL_COLOR }}>Trọng lực g (hướng xuống): {accelBody ? raw ? `đo [${accelBody.join(', ')}] số đếm thô (chỉ hướng)` : `đo ${accelBody.map(value => value.toFixed(2)).join(', ')} g · |a| = ${Math.hypot(...accelBody).toFixed(2)} g` : '—'}</span>
        {!raw && <span style={{ color: MAG_COLOR }}>Từ trường: {magBody ? `${magBody.map(value => value.toFixed(1)).join(', ')} µT · |B| = ${Math.hypot(...magBody).toFixed(1)} µT (chỉ hướng)` : '—'}</span>}
      </div>
    </div>
  );
}
