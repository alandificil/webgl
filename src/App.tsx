import { useState, useEffect, useRef } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import * as THREE from 'three';
// Corrigir import do GLTFLoader e RGBELoader para funcionar com a instalação padrão do three
// @ts-ignore
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// @ts-ignore
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';


function AirConditionerViewer() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Cena, câmera e renderizador
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0); // Fundo claro
    new EXRLoader()
      .load('/lights/studio.exr', function (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture; // Só iluminação
        // Não defina scene.background!
      });
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    let cameraDistance = 5.5; // Mais distante
    let cameraTarget = new THREE.Vector3(0, 1, 0); // Centro do equipamento
    let cameraAngleY = Math.PI / 1.6; // Rotação horizontal 
    let cameraAngleX = 0.1; // Rotação vertical inicial (levemente de cima)
    const minPolarAngle = -Math.PI / 2 + 0.15; // Limite para não inverter
    const maxPolarAngle = Math.PI / 2 - 0.15;

    function updateCamera() {
      // Coordenadas esféricas para manter o centro no equipamento
      const x = cameraDistance * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);
      const y = cameraDistance * Math.sin(cameraAngleX) + cameraTarget.y;
      const z = cameraDistance * Math.cos(cameraAngleY) * Math.cos(cameraAngleX);
      camera.position.set(x, y, z);
      camera.lookAt(cameraTarget);
    }
    updateCamera();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // Luzes
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Carregar modelo GLB
    const loader = new GLTFLoader();
    let model: THREE.Object3D = new THREE.Object3D();
    let ventiladorEvap: THREE.Object3D | null = null;
    let tuboGasMesh: THREE.Mesh | null = null;
    let compressor1: THREE.Object3D | null = null;
    let compressor2: THREE.Object3D | null = null;
    loader.load('/rooftop_engie.glb', (gltf: GLTF) => {
      model = gltf.scene;
      model.traverse((child) => { 
        if (child.isMesh) {
          if (child.material && child.material.name === 'Black_Ventilation') {
            ventiladorEvap = child;
          }
          if (child.material.name === 'Material_Tubo_Gas_Laranja') {
            tuboGasMesh = child;
          }
          if (child.material.name === 'Black_Compressor1') {
            compressor1 = child;
          }
          if (child.material.name === 'Black_Compressor2') {
            compressor2 = child;
          }
        }
      });
      scene.add(model);
    });

    // Controle de rotação com mouse (horizontal e vertical, suavizado)
    let isDragging = false;
    let previousX = 0;
    let previousY = 0;
    let targetAngleY = cameraAngleY;
    let targetAngleX = cameraAngleX;
    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      previousX = e.clientX;
      previousY = e.clientY;
    };
    const onPointerUp = () => {
      isDragging = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - previousX;
        const deltaY = e.clientY - previousY;
        targetAngleY -= deltaX * 0.01; // inverter sentido
        targetAngleX += deltaY * 0.01; // inverter sentido
        // Limitar o ângulo vertical
        targetAngleX = Math.max(minPolarAngle, Math.min(maxPolarAngle, targetAngleX));
        previousX = e.clientX;
        previousY = e.clientY;
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // Zoom com scroll do mouse
    const minDistance = 2.5;
    const maxDistance = 8;
    const onWheel = (e: WheelEvent) => {
      cameraDistance += e.deltaY * 0.003;
      cameraDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance));
    };
    renderer.domElement.addEventListener('wheel', onWheel);

    // Responsividade
    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Variável de status da ventilação
    let ventiladorStatus: 'bom' | 'alerta' | 'critico' = 'alerta';
    let compressor1Status: 'bom' | 'alerta' | 'critico' = 'critico';
    let compressor2Status: 'bom' | 'alerta' | 'critico' = 'alerta';

    // Animação
    const animate = () => {
      requestAnimationFrame(animate);
      // Suavizar rotação 
      cameraAngleY += (targetAngleY - cameraAngleY) * 0.1;
      cameraAngleX += (targetAngleX - cameraAngleX) * 0.1;
      updateCamera();

      if (ventiladorEvap && ventiladorEvap instanceof THREE.Mesh) {
        ventiladorEvap.rotation.x += 0.08;
      }

      const time = performance.now() * 0.0025; // menor frequência

      const applyStatusEffect = (mesh: THREE.Object3D | null, status: 'bom' | 'alerta' | 'critico') => {
        if (mesh && mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
          if (status === 'critico') {
            const pulse = (Math.sin(time * 2) + 1) / 2;
            const baseColor = new THREE.Color('#DB3735');
            const currentColor = new THREE.Color().lerpColors(new THREE.Color('#701313'), baseColor, pulse);
            mesh.material.color.copy(currentColor);
          } else if (status === 'alerta') {
            const pulse = (Math.sin(time * 2) + 1) / 2;
            const baseColor = new THREE.Color('#FF8C47');
            const currentColor = new THREE.Color().lerpColors(new THREE.Color('#975800'), baseColor, pulse);
            mesh.material.color.copy(currentColor);
          } else {
            mesh.material.color.set('#000000');
          }
        }
      };

      applyStatusEffect(ventiladorEvap, ventiladorStatus);
      applyStatusEffect(compressor1, compressor1Status);
      applyStatusEffect(compressor2, compressor2Status);

      const ventCompress1 = model.getObjectByName('Vent_Compress_1');
      const ventCompress2 = model.getObjectByName('Vent_Compress_2');

      if (ventCompress1) {
        ventCompress1.rotation.y += 0.09;
      }

      if (ventCompress2) {
        ventCompress2.rotation.y += 0.09;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '500px', background: '#222', borderRadius: 8, margin: '2rem auto' }} />;
}

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <h1>Ar-condicionado 3D (gire com o mouse)</h1>
      <AirConditionerViewer />
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
