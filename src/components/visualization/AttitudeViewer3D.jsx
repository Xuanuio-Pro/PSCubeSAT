import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import { useTelemetry } from '../../contexts/telemetry-api';
import * as THREE from 'three';

function CubeSatModel({ rotation }) {
  const meshRef = useRef(null);

  useFrame(() => {
    if (meshRef.current && rotation) {
      meshRef.current.rotation.x = THREE.MathUtils.degToRad(rotation.roll ?? 0);
      meshRef.current.rotation.y = THREE.MathUtils.degToRad(rotation.yaw || 0);
      meshRef.current.rotation.z = THREE.MathUtils.degToRad(rotation.pitch ?? 0);
    }
  });

  return (
    <group ref={meshRef}>
      {/* Main body */}
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#1a3a5c" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Solar panels */}
      <mesh position={[1.1, 0, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1, 0.8, 0.03]} />
        <meshStandardMaterial color="#1a237e" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-1.1, 0, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1, 0.8, 0.03]} />
        <meshStandardMaterial color="#1a237e" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Solar panel grid lines */}
      {[-1.1, 1.1].map((x, idx) => (
        <group key={idx}>
          {Array.from({ length: 4 }, (_, i) => (
            <mesh key={i} position={[x, -0.3 + i * 0.2, 0.02]}>
              <boxGeometry args={[0.95, 0.005, 0.005]} />
              <meshBasicMaterial color="#3949ab" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Antenna */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
        <meshStandardMaterial color="#ccc" metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#f44" emissive="#f44" emissiveIntensity={0.3} />
      </mesh>

      {/* Camera lens */}
      <mesh position={[0, 0, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.06, 16]} />
        <meshStandardMaterial color="#333" metalness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.55]}>
        <circleGeometry args={[0.1, 16]} />
        <meshStandardMaterial color="#111" metalness={1} />
      </mesh>

      {/* Labels */}
      <Text position={[0, -0.55, 0.51]} fontSize={0.08} color="#8b949e" anchorX="center">
        PTIT CubeSat
      </Text>
    </group>
  );
}

function AxisHelper() {
  return (
    <group>
      {/* X axis - Red */}
      <mesh position={[1.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.01, 0.01, 3, 4]} />
        <meshBasicMaterial color="#f85149" />
      </mesh>
      <Text position={[3.2, 0, 0]} fontSize={0.15} color="#f85149">X (Roll)</Text>

      {/* Y axis - Green */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 3, 4]} />
        <meshBasicMaterial color="#3fb950" />
      </mesh>
      <Text position={[0, 3.2, 0]} fontSize={0.15} color="#3fb950">Y (Yaw)</Text>

      {/* Z axis - Blue */}
      <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 3, 4]} />
        <meshBasicMaterial color="#388bfd" />
      </mesh>
      <Text position={[0, 0, 3.2]} fontSize={0.15} color="#388bfd">Z (Pitch)</Text>
    </group>
  );
}

/** @param {{height?: number|string}} props */
export default function AttitudeViewer3D({ height = 350 }) {
  const { attitude: rotation, attitudeReceivedAt, now, status } = useTelemetry();
  const imuFresh = attitudeReceivedAt !== null && now - attitudeReceivedAt <= 5000;
  const display = value => value == null ? '—' : value.toFixed(1);

  return (
    <div className="card" style={{ opacity: status === 'live' && imuFresh ? 1 : 0.65 }}>
      <div className="card-header">
        <h3>🛰️ 3D Attitude Viewer {!imuFresh && <small>· {attitudeReceivedAt === null ? 'chờ IMU' : 'IMU stale'}</small>}</h3>
        <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--accent-red)' }}>P: {display(rotation.pitch)}°</span>
          <span style={{ color: 'var(--accent-green)' }}>R: {display(rotation.roll)}°</span>
          <span style={{ color: 'var(--accent-blue)' }}>Y tương đối: {display(rotation.yaw)}°</span>
        </div>
      </div>
      <div style={{ height, background: '#070b14' }}>
        <Canvas camera={{ position: [3, 2, 3], fov: 50 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <pointLight position={[-3, -3, -3]} intensity={0.3} color="#388bfd" />

          <CubeSatModel rotation={rotation} />
          <AxisHelper />

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
    </div>
  );
}
