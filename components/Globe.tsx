'use client';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Discovery } from '@/lib/types';

function latLon(lat: number, lon: number, radius = 1.36) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

function Earth({ active, discoveries }: { active?: Discovery; discoveries: Discovery[] }) {
  const group = useRef<THREE.Group>(null);
  const earth = useLoader(THREE.TextureLoader, '/textures/earth-blue-marble.jpg');
  const bump = useLoader(THREE.TextureLoader, '/textures/earth-topology.png');
  earth.colorSpace = THREE.SRGBColorSpace;
  const target = useMemo(() => {
    if (!active) return new THREE.Quaternion();
    const marker = latLon(active.location.lat, active.location.lon, 1).normalize();
    return new THREE.Quaternion().setFromUnitVectors(marker, new THREE.Vector3(0, 0, 1));
  }, [active?.id]);
  useFrame((state, dt) => {
    if (!group.current) return;
    group.current.quaternion.slerp(target, 1 - Math.pow(.002, dt));
    group.current.rotation.y += dt * .012;
    state.camera.position.lerp(new THREE.Vector3(0, .22, 4.05), .04);
    state.camera.lookAt(0, 0, 0);
  });
  return <group ref={group}>
    <mesh>
      <sphereGeometry args={[1.34, 96, 96]} />
      <meshStandardMaterial map={earth} bumpMap={bump} bumpScale={.045} roughness={.72} metalness={.02} />
    </mesh>
    <mesh scale={1.025}>
      <sphereGeometry args={[1.34, 96, 96]} />
      <shaderMaterial transparent blending={THREE.AdditiveBlending} side={THREE.BackSide} vertexShader={`varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec3 vNormal; void main(){ float intensity=pow(.72-dot(vNormal,vec3(0.,0.,1.)),2.1); gl_FragColor=vec4(.18,.55,1.,1.)*intensity;}`} />
    </mesh>
    {discoveries.map(d => <Marker key={d.id} discovery={d} active={active?.id === d.id} />)}
  </group>;
}

function Marker({ discovery, active }: { discovery: Discovery; active: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => latLon(discovery.location.lat, discovery.location.lon, 1.38), [discovery]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = active ? 1.25 + Math.sin(clock.elapsedTime * 4) * .12 : .65;
    ref.current.scale.setScalar(s);
  });
  const color = active ? '#8fe7ff' : '#f6c96f';
  return <group ref={ref} position={pos}>
    <mesh><sphereGeometry args={[.018, 18, 18]} /><meshBasicMaterial color={color} /></mesh>
    {active && <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.04, .0022, 8, 48]} /><meshBasicMaterial color={color} transparent opacity={.72} /></mesh>}
  </group>;
}

export default function Globe({ active, discoveries }: { active?: Discovery; discoveries: Discovery[] }) {
  return <div className="globeWrap" aria-label="Interactive earth visualization">
    <Canvas camera={{ position: [0, .25, 4.1], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={['#02040c']} />
      <ambientLight intensity={.62} />
      <directionalLight position={[4, 2, 5]} intensity={2.2} />
      <pointLight position={[-3, -2, -2]} intensity={.5} color="#5b7cff" />
      <Stars radius={80} depth={35} count={3600} factor={3.2} saturation={0} fade speed={.45} />
      <Earth active={active} discoveries={discoveries} />
    </Canvas>
    <div className="orbitalVignette" />
  </div>;
}
