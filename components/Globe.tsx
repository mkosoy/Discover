'use client';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Line, OrbitControls, Stars } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Discovery, Investigation } from '@/lib/types';

function latLon(lat: number, lon: number, radius = 1.36) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}
function vectorToLatLon(vector: THREE.Vector3) {
  const v = vector.clone().normalize();
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI;
  let lon = Math.atan2(v.z, -v.x) * 180 / Math.PI - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

type FocusTarget = { id: string; location: { lat: number; lon: number } };

function Earth({ active, discoveries, investigations, onSelect, onSelectInvestigation }: { active?: FocusTarget; discoveries: Discovery[]; investigations: Investigation[]; onSelect: (discovery: Discovery, point?: { lat: number; lon: number }) => void; onSelectInvestigation: (investigation: Investigation) => void }) {
  const group = useRef<THREE.Group>(null);
  const pointerDown = useRef<{ x: number; y: number }>();
  const earth = useLoader(THREE.TextureLoader, '/textures/earth-blue-marble.jpg');
  const bump = useLoader(THREE.TextureLoader, '/textures/earth-topology.png');
  earth.colorSpace = THREE.SRGBColorSpace;
  const target = useMemo(() => {
    if (!active) return new THREE.Quaternion();
    const marker = latLon(active.location.lat, active.location.lon, 1).normalize();
    return new THREE.Quaternion().setFromUnitVectors(marker, new THREE.Vector3(0, 0, 1));
  }, [active?.id, active?.location.lat, active?.location.lon]);
  useFrame((state, dt) => {
    if (!group.current) return;
    group.current.quaternion.slerp(target, 1 - Math.pow(.002, dt));
    group.current.rotation.y += dt * .012;
  });
  const inspectPoint = (point: THREE.Vector3) => {
    if (!group.current || discoveries.length === 0) return;
    const inverse = group.current.getWorldQuaternion(new THREE.Quaternion()).invert();
    const local = point.clone().applyQuaternion(inverse).normalize();
    let best = discoveries[0];
    let bestDistance = Infinity;
    for (const discovery of discoveries) {
      const marker = latLon(discovery.location.lat, discovery.location.lon, 1).normalize();
      bestDistance = Math.min(bestDistance, marker.distanceTo(local));
      if (marker.distanceTo(local) === bestDistance) best = discovery;
    }
    onSelect(best, vectorToLatLon(local));
  };
  const dragged = (event: any) => {
    const native = event.nativeEvent as PointerEvent;
    return pointerDown.current ? Math.hypot(native.clientX - pointerDown.current.x, native.clientY - pointerDown.current.y) > 8 : false;
  };
  return <group ref={group}>
    <mesh
      onPointerDown={event => { const native = event.nativeEvent as PointerEvent; pointerDown.current = { x: native.clientX, y: native.clientY }; }}
      onClick={event => { event.stopPropagation(); if (!dragged(event)) inspectPoint(event.point); }}
    >
      <sphereGeometry args={[1.34, 96, 96]} />
      <meshStandardMaterial map={earth} bumpMap={bump} bumpScale={.045} roughness={.72} metalness={.02} />
    </mesh>
    <mesh scale={1.025}>
      <sphereGeometry args={[1.34, 96, 96]} />
      <shaderMaterial transparent blending={THREE.AdditiveBlending} side={THREE.BackSide} vertexShader={`varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec3 vNormal; void main(){ float intensity=pow(.72-dot(vNormal,vec3(0.,0.,1.)),2.1); gl_FragColor=vec4(.18,.55,1.,1.)*intensity;}`} />
    </mesh>
    <ConnectionArcs active={active} discoveries={discoveries} />
    {discoveries.map(d => <Marker key={d.id} discovery={d} active={active?.id === d.id} onSelect={onSelect} />)}
    {investigations.map(i => <InvestigationMarker key={i.id} investigation={i} active={active?.id === i.id} onSelect={onSelectInvestigation} />)}
  </group>;
}

function ConnectionArcs({ active, discoveries }: { active?: FocusTarget; discoveries: Discovery[] }) {
  const activeDiscovery = discoveries.find(d => d.id === active?.id);
  if (!activeDiscovery?.connections?.length) return null;
  return <>
    {activeDiscovery.connections.map(connection => {
      const other = discoveries.find(d => d.id === connection.id);
      if (!other) return null;
      const start = latLon(activeDiscovery.location.lat, activeDiscovery.location.lon, 1.39);
      const end = latLon(other.location.lat, other.location.lon, 1.39);
      const sum = start.clone().add(end);
      const mid = sum.length() > .01
        ? sum.normalize().multiplyScalar(1.74)
        : start.clone().cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(1.74);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      return <Line key={connection.id} points={curve.getPoints(56)} color="#8fe7ff" transparent opacity={.42} lineWidth={1.35} />;
    })}
  </>;
}

function Marker({ discovery, active, onSelect }: { discovery: Discovery; active: boolean; onSelect: (discovery: Discovery, point?: { lat: number; lon: number }) => void }) {
  const ref = useRef<THREE.Group>(null);
  const pointerDown = useRef<{ x: number; y: number }>();
  const pos = useMemo(() => latLon(discovery.location.lat, discovery.location.lon, 1.38), [discovery]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = active ? 1.25 + Math.sin(clock.elapsedTime * 4) * .12 : .65;
    ref.current.scale.setScalar(s);
  });
  const color = active ? '#8fe7ff' : '#f6c96f';
  return <group
    ref={ref}
    position={pos}
    onPointerDown={event => { const native = event.nativeEvent as PointerEvent; pointerDown.current = { x: native.clientX, y: native.clientY }; }}
    onClick={event => {
      event.stopPropagation();
      const native = event.nativeEvent as PointerEvent;
      const moved = pointerDown.current ? Math.hypot(native.clientX - pointerDown.current.x, native.clientY - pointerDown.current.y) > 8 : false;
      if (!moved) onSelect(discovery);
    }}
  >
    <mesh><sphereGeometry args={[.018, 18, 18]} /><meshBasicMaterial color={color} /></mesh>
    {active && <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.04, .0022, 8, 48]} /><meshBasicMaterial color={color} transparent opacity={.72} /></mesh>}
  </group>;
}

function InvestigationMarker({ investigation, active, onSelect }: { investigation: Investigation; active: boolean; onSelect: (investigation: Investigation) => void }) {
  const ref = useRef<THREE.Group>(null);
  const pointerDown = useRef<{ x: number; y: number }>();
  const pos = useMemo(() => latLon(investigation.location.lat, investigation.location.lon, 1.395), [investigation]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.scale.setScalar(active ? 1.25 + Math.sin(clock.elapsedTime * 4) * .12 : .78);
  });
  return <group
    ref={ref}
    position={pos}
    onPointerDown={event => { const native = event.nativeEvent as PointerEvent; pointerDown.current = { x: native.clientX, y: native.clientY }; }}
    onClick={event => {
      event.stopPropagation();
      const native = event.nativeEvent as PointerEvent;
      const moved = pointerDown.current ? Math.hypot(native.clientX - pointerDown.current.x, native.clientY - pointerDown.current.y) > 8 : false;
      if (!moved) onSelect(investigation);
    }}
  >
    <mesh><octahedronGeometry args={[.026, 0]} /><meshBasicMaterial color={active ? '#d8b4fe' : '#8a7dff'} transparent opacity={active ? 1 : .78} /></mesh>
    {active && <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.052, .0025, 8, 48]} /><meshBasicMaterial color="#d8b4fe" transparent opacity={.75} /></mesh>}
  </group>;
}

export default function Globe({ active, discoveries, investigations, onSelect, onSelectInvestigation }: { active?: FocusTarget; discoveries: Discovery[]; investigations: Investigation[]; onSelect: (discovery: Discovery, point?: { lat: number; lon: number }) => void; onSelectInvestigation: (investigation: Investigation) => void }) {
  return <div className="globeWrap" aria-label="Interactive earth visualization">
    <Canvas camera={{ position: [0, .25, 4.1], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={['#02040c']} />
      <ambientLight intensity={.62} />
      <directionalLight position={[4, 2, 5]} intensity={2.2} />
      <pointLight position={[-3, -2, -2]} intensity={.5} color="#5b7cff" />
      <Stars radius={80} depth={35} count={3600} factor={3.2} saturation={0} fade speed={.45} />
      <Earth active={active} discoveries={discoveries} investigations={investigations} onSelect={onSelect} onSelectInvestigation={onSelectInvestigation} />
      <OrbitControls enablePan={false} enableZoom minDistance={3.25} maxDistance={5.2} zoomSpeed={.55} rotateSpeed={.42} enableDamping dampingFactor={.08} />
    </Canvas>
    <div className="orbitalVignette" />
  </div>;
}
