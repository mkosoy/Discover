'use client';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Line, OrbitControls, Stars } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Discovery, Investigation } from '@/lib/types';
import type { PublicCamera } from '@/lib/cameras';

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

function subsolarPoint(date = new Date()) {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - yearStart) / 86400000);
  const declination = -23.44 * Math.cos((360 / 365) * (day + 10) * Math.PI / 180);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let lon = -15 * (utcHours - 12);
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat: declination, lon };
}

type FocusTarget = { id: string; location: { lat: number; lon: number }; connections?: { id: string }[] };

function Earth({ active, discoveries, investigations, cameras, sky, onSelect, onSelectCamera, onSelectInvestigation }: { active?: FocusTarget; discoveries: Discovery[]; investigations: Investigation[]; cameras: PublicCamera[]; sky?: { lat: number; lon: number }[]; onSelect: (discovery: Discovery, point?: { lat: number; lon: number }) => void; onSelectCamera: (camera: PublicCamera) => void; onSelectInvestigation: (investigation: Investigation) => void }) {
  const group = useRef<THREE.Group>(null);
  const pointerDown = useRef<{ x: number; y: number }>();
  const earth = useLoader(THREE.TextureLoader, '/textures/earth-blue-marble.jpg');
  const night = useLoader(THREE.TextureLoader, '/textures/earth-night.jpg');
  const bump = useLoader(THREE.TextureLoader, '/textures/earth-topology.png');
  earth.colorSpace = THREE.SRGBColorSpace;
  night.colorSpace = THREE.SRGBColorSpace;
  const sunDirection = useMemo(() => {
    const point = subsolarPoint();
    return latLon(point.lat, point.lon, 1).normalize();
  }, []);
  const target = useMemo(() => {
    if (!active) return new THREE.Quaternion();
    const marker = latLon(active.location.lat, active.location.lon, 1).normalize();
    return new THREE.Quaternion().setFromUnitVectors(marker, new THREE.Vector3(0, 0, 1));
  }, [active?.id, active?.location.lat, active?.location.lon]);
  useFrame((state, dt) => {
    if (!group.current) return;
    group.current.quaternion.slerp(target, 1 - Math.pow(.002, dt));
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
    <mesh scale={1.0015}>
      <sphereGeometry args={[1.34, 96, 96]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={{ nightMap: { value: night }, sunDirection: { value: sunDirection } }}
        vertexShader={`varying vec2 vUv; varying vec3 vNormal; void main(){ vUv=uv; vNormal=normalize(normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={`uniform sampler2D nightMap; uniform vec3 sunDirection; varying vec2 vUv; varying vec3 vNormal; void main(){ float sunDot=dot(normalize(vNormal),normalize(sunDirection)); float nightAmount=1.-smoothstep(-.14,.16,sunDot); vec3 night=texture2D(nightMap,vUv).rgb; float lights=pow(max(max(night.r,night.g),night.b),2.4); vec3 color=night*vec3(.95,1.08,1.45)+vec3(1.35,.88,.34)*lights*1.35; gl_FragColor=vec4(color,nightAmount*.92); }`}
      />
    </mesh>
    <mesh scale={1.025}>
      <sphereGeometry args={[1.34, 96, 96]} />
      <shaderMaterial transparent blending={THREE.AdditiveBlending} side={THREE.BackSide} vertexShader={`varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec3 vNormal; void main(){ float intensity=pow(.72-dot(vNormal,vec3(0.,0.,1.)),2.1); gl_FragColor=vec4(.18,.55,1.,1.)*intensity;}`} />
    </mesh>
    <ConnectionArcs active={active} discoveries={discoveries} />
    <OrbitTracks discoveries={discoveries} active={active} />
    {active && !discoveries.some(d => d.id === active.id) && !investigations.some(i => i.id === active.id) && <FocusMarker active={active} />}
    {discoveries.map((d, index) => {
      const samePlace = (other: Discovery) => Math.abs(other.location.lat - d.location.lat) < .08 && Math.abs(other.location.lon - d.location.lon) < .08;
      const slot = discoveries.slice(0, index).filter(samePlace).length;
      return <Marker key={d.id} discovery={d} slot={slot} active={active?.id === d.id} onSelect={onSelect} />;
    })}
    {Boolean(sky?.length) && <SkyTraffic positions={sky!} />}
    <CameraPins cameras={cameras.filter(camera => !discoveries.some(discovery => camera.youtubeId ? discovery.mediaVideo?.includes(camera.youtubeId) : false))} activeId={active?.id?.startsWith('camera-pin-') ? active.id.slice(11) : undefined} onSelect={onSelectCamera} />
    {investigations.map(i => <InvestigationMarker key={i.id} investigation={i} active={active?.id === i.id} onSelect={onSelectInvestigation} />)}
  </group>;
}

function FocusMarker({ active }: { active: FocusTarget }) {
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => latLon(active.location.lat, active.location.lon, 1.405), [active.location.lat, active.location.lon]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.scale.setScalar(1.05 + Math.sin(clock.elapsedTime * 5) * .12);
  });
  return <group ref={ref} position={pos}>
    <mesh><sphereGeometry args={[.026, 20, 20]} /><meshBasicMaterial color="#8fe7ff" /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.058, .0028, 8, 48]} /><meshBasicMaterial color="#8fe7ff" transparent opacity={.72} /></mesh>
  </group>;
}

function OrbitTracks({ discoveries, active }: { discoveries: Discovery[]; active?: FocusTarget }) {
  return <>
    {discoveries.filter(discovery => discovery.orbitTrack?.length).map(discovery => {
      const points = discovery.orbitTrack ?? [];
      const segments: typeof points[] = [[]];
      for (const point of points) {
        const segment = segments[segments.length - 1];
        const previous = segment[segment.length - 1];
        if (previous && Math.abs(previous.lon - point.lon) > 100) segments.push([point]);
        else segment.push(point);
      }
      const isActive = active?.id === discovery.id;
      return <group key={discovery.id}>
        {segments.filter(segment => segment.length > 1).map((segment, index) => <Line
          key={`${discovery.id}-${index}`}
          points={segment.map(point => latLon(point.lat, point.lon, 1.46))}
          color={isActive ? '#b8f4ff' : '#5ea8ff'}
          transparent
          opacity={isActive ? .82 : .34}
          lineWidth={isActive ? 1.9 : 1.05}
        />)}
      </group>;
    })}
  </>;
}

function ConnectionArcs({ active, discoveries }: { active?: FocusTarget; discoveries: Discovery[] }) {
  const activeDiscovery = discoveries.find(d => d.id === active?.id) ?? (active?.connections ? active as Discovery : undefined);
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

function Marker({ discovery, slot = 0, active, onSelect }: { discovery: Discovery; slot?: number; active: boolean; onSelect: (discovery: Discovery, point?: { lat: number; lon: number }) => void }) {
  const ref = useRef<THREE.Group>(null);
  const pointerDown = useRef<{ x: number; y: number }>();
  const pos = useMemo(() => {
    const base = latLon(discovery.location.lat, discovery.location.lon, discovery.id === 'iss-over-earth' ? 1.46 : 1.38);
    if (!slot) return base;
    const tangent = new THREE.Vector3(-base.z, 0, base.x);
    if (tangent.lengthSq() < .001) tangent.set(1, 0, 0);
    tangent.normalize();
    const bitangent = base.clone().normalize().cross(tangent).normalize();
    const angle = slot * 2.39996;
    return base.clone()
      .add(tangent.multiplyScalar(Math.cos(angle) * .058))
      .add(bitangent.multiplyScalar(Math.sin(angle) * .058))
      .normalize()
      .multiplyScalar(1.38);
  }, [discovery, slot]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = active ? 1.25 + Math.sin(clock.elapsedTime * 4) * .12 : .65;
    ref.current.scale.setScalar(s);
  });
  const color = active ? '#8fe7ff' : discovery.mediaVideo ? '#67e8c3' : discovery.visual === 'fire' ? '#ff9b70' : discovery.visual === 'ocean' ? '#69b7ff' : discovery.visual === 'storm' ? '#9aa8ff' : discovery.visual === 'seismic' ? '#ff7f6e' : discovery.visual === 'aurora' ? '#a5f3c8' : '#f6c96f';
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
    {discovery.mediaVideo && !active && <mesh><sphereGeometry args={[.034, 18, 18]} /><meshBasicMaterial color={color} transparent opacity={.18} /></mesh>}
    <mesh><sphereGeometry args={[.023, 18, 18]} /><meshBasicMaterial color={color} /></mesh>
    {active && <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.05, .0025, 8, 48]} /><meshBasicMaterial color={color} transparent opacity={.72} /></mesh>}
  </group>;
}

function SkyTraffic({ positions }: { positions: { lat: number; lon: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!ref.current) return;
    const matrix = new THREE.Matrix4();
    positions.forEach((pos, index) => {
      matrix.setPosition(latLon(pos.lat, pos.lon, 1.372));
      ref.current?.setMatrixAt(index, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return <instancedMesh key={`sky-${positions.length}`} ref={ref} args={[undefined, undefined, Math.max(1, positions.length)]}>
    <sphereGeometry args={[.0095, 6, 6]} />
    <meshBasicMaterial color="#ffd98a" transparent opacity={.62} />
  </instancedMesh>;
}

function CameraPins({ cameras, activeId, onSelect }: { cameras: PublicCamera[]; activeId?: string; onSelect: (camera: PublicCamera) => void }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const hitRef = useRef<THREE.InstancedMesh>(null);
  const pointerDown = useRef<{ x: number; y: number }>();
  const inactive = useMemo(() => cameras.filter(camera => camera.id !== activeId), [cameras, activeId]);
  const activeCamera = useMemo(() => cameras.find(camera => camera.id === activeId), [cameras, activeId]);
  useEffect(() => {
    if (!ref.current) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    inactive.forEach((camera, index) => {
      // Video look-ins are the primary value — render them larger so dense regions read as
      // a hierarchy of quality rather than uniform noise; still-image backups recede.
      const scale = camera.youtubeId ? 1 : .62;
      matrix.makeScale(scale, scale, scale);
      matrix.setPosition(latLon(camera.lat, camera.lon, 1.365));
      ref.current?.setMatrixAt(index, matrix);
      hitRef.current?.setMatrixAt(index, matrix);
      color.set(camera.youtubeId ? '#74dfc8' : '#f6c96f');
      ref.current?.setColorAt(index, color);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
    if (hitRef.current) hitRef.current.instanceMatrix.needsUpdate = true;
  }, [inactive]);
  return <>
    <instancedMesh key={`visual-${inactive.length}`} ref={ref} args={[undefined, undefined, Math.max(1, inactive.length)]}>
      <sphereGeometry args={[.0125, 8, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={.72} />
    </instancedMesh>
    <instancedMesh
      key={`hit-${inactive.length}`}
      ref={hitRef}
      args={[undefined, undefined, Math.max(1, inactive.length)]}
      onPointerDown={event => { const native = event.nativeEvent as PointerEvent; pointerDown.current = { x: native.clientX, y: native.clientY }; }}
      onClick={event => {
        event.stopPropagation();
        const native = event.nativeEvent as PointerEvent;
        const moved = pointerDown.current ? Math.hypot(native.clientX - pointerDown.current.x, native.clientY - pointerDown.current.y) > 8 : false;
        if (!moved && event.instanceId != null && inactive[event.instanceId]) onSelect(inactive[event.instanceId]);
      }}
    >
      <sphereGeometry args={[.034, 8, 8]} />
      <meshBasicMaterial color="#74dfc8" transparent opacity={.001} depthWrite={false} />
    </instancedMesh>
    {activeCamera && <ActiveCameraPin camera={activeCamera} />}
  </>;
}

function ActiveCameraPin({ camera }: { camera: PublicCamera }) {
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => latLon(camera.lat, camera.lon, 1.385), [camera.lat, camera.lon]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.scale.setScalar(1.18 + Math.sin(clock.elapsedTime * 4) * .1);
  });
  return <group ref={ref} position={pos}>
    <mesh><sphereGeometry args={[.025, 16, 16]} /><meshBasicMaterial color="#74dfc8" /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.052, .0025, 8, 48]} /><meshBasicMaterial color="#ffffff" transparent opacity={.72} /></mesh>
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
    <mesh><octahedronGeometry args={[.031, 0]} /><meshBasicMaterial color={active ? '#d8b4fe' : '#8a7dff'} transparent opacity={active ? 1 : .78} /></mesh>
    {active && <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.052, .0025, 8, 48]} /><meshBasicMaterial color="#d8b4fe" transparent opacity={.75} /></mesh>}
  </group>;
}

export default function Globe({ active, discoveries, investigations, cameras, sky, onSelect, onSelectCamera, onSelectInvestigation }: { active?: FocusTarget; discoveries: Discovery[]; investigations: Investigation[]; cameras: PublicCamera[]; sky?: { lat: number; lon: number }[]; onSelect: (discovery: Discovery, point?: { lat: number; lon: number }) => void; onSelectCamera: (camera: PublicCamera) => void; onSelectInvestigation: (investigation: Investigation) => void }) {
  const sun = useMemo(() => {
    const point = subsolarPoint();
    return latLon(point.lat, point.lon, 5.4);
  }, []);
  return <div className="globeWrap" aria-label="Interactive earth visualization">
    <Canvas camera={{ position: [0, .25, 4.1], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={['#02040c']} />
      <ambientLight intensity={.38} />
      <directionalLight position={[sun.x, sun.y, sun.z]} intensity={2.45} />
      <pointLight position={[-3, -2, -2]} intensity={.38} color="#5b7cff" />
      <Stars radius={80} depth={35} count={3600} factor={3.2} saturation={0} fade speed={.45} />
      <Earth active={active} discoveries={discoveries} investigations={investigations} cameras={cameras} sky={sky} onSelect={onSelect} onSelectCamera={onSelectCamera} onSelectInvestigation={onSelectInvestigation} />
      <OrbitControls enablePan={false} enableZoom minDistance={3.25} maxDistance={5.2} zoomSpeed={.55} rotateSpeed={.42} enableDamping dampingFactor={.08} />
    </Canvas>
    <div className="orbitalVignette" />
  </div>;
}
