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

    // Criação da cena 3D, que é o container principal onde todos os objetos, luzes e câmeras serão adicionados.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0); // Define um fundo claro para a cena.

    // Carregamento da textura de ambiente HDR usando EXRLoader para iluminação realista.
    // Essa textura não será usada como fundo, apenas para iluminação ambiente.
    new EXRLoader()
      .load('/lights/studio.exr', function (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture; // Define a iluminação ambiente da cena.
        // Não definimos scene.background para manter o fundo claro.
      });

    // Configuração da câmera perspectiva, que simula a visão humana.
    // Parâmetros: campo de visão, proporção, plano próximo e plano distante.
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);

    // Variáveis para controlar a posição da câmera em coordenadas esféricas para facilitar a rotação.
    let cameraDistance = 5.5; // Distância da câmera ao centro do objeto.
    let cameraTarget = new THREE.Vector3(0, 1, 0); // Ponto para onde a câmera olha (centro do equipamento).
    let cameraAngleY = Math.PI / 1.6; // Ângulo horizontal inicial da câmera.
    let cameraAngleX = 0.1; // Ângulo vertical inicial da câmera (ligeiramente de cima).
    const minPolarAngle = -Math.PI / 2 + 0.15; // Limite inferior para a rotação vertical (não permite inverter).
    const maxPolarAngle = Math.PI / 2 - 0.15;  // Limite superior para a rotação vertical.

    // Função para atualizar a posição da câmera com base nos ângulos e distância definidos.
    // Converte coordenadas esféricas em coordenadas cartesianas.
    function updateCamera() {
      const x = cameraDistance * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);
      const y = cameraDistance * Math.sin(cameraAngleX) + cameraTarget.y;
      const z = cameraDistance * Math.cos(cameraAngleY) * Math.cos(cameraAngleX);
      camera.position.set(x, y, z);
      camera.lookAt(cameraTarget); // Faz a câmera olhar para o centro do equipamento.
    }
    updateCamera();

    // Criação do renderizador WebGL para desenhar a cena na tela.
    // Antialias habilitado para suavizar as bordas e alpha para transparência.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight); // Ajusta o tamanho do canvas ao container.
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Mapeamento de tons para cores realistas.
    renderer.outputColorSpace = THREE.SRGBColorSpace;   // Espaço de cor padrão para monitores.
    renderer.domElement.style.cursor = 'grab';
    mount.appendChild(renderer.domElement); // Adiciona o canvas do renderizador ao DOM.

    // Configuração das luzes da cena para iluminar o modelo 3D.
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Luz ambiente geral.
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Luz direcional simulando o sol.
    directionalLight.position.set(5, 10, 7.5); // Posição da luz.
    scene.add(directionalLight);

    // Loader para carregar modelos 3D no formato GLB (GLTF binário).
    const loader = new GLTFLoader();

    // Variáveis para armazenar referências aos objetos do modelo carregado.
    let model: THREE.Object3D = new THREE.Object3D();
    let ventiladorEvap: THREE.Object3D | null = null;
    let tuboGasMesh: THREE.Mesh | null = null;
    let compressor1: THREE.Object3D | null = null;
    let compressor2: THREE.Object3D | null = null;

    // Array para armazenar todos os meshes que possuem o material "White_Equipment".
    let whiteEquipments: THREE.Object3D[] = [];

    // Variáveis para controlar o status dos componentes do equipamento.
    let ventiladorStatus: 'bom' | 'alerta' | 'critico' = 'bom';
    let compressor1Status: 'bom' | 'alerta' | 'critico' = 'critico';
    let compressor2Status: 'bom' | 'alerta' | 'critico' = 'bom';
    let equipamentoStatus: 'bom' | 'alerta' | 'critico' = 'alerta';

    // Variáveis para armazenar os meshes das plaquinhas de status, que serão coloridas conforme o status.
    let statusCircleVent: THREE.Object3D | null = null;
    let statusCircleC1: THREE.Object3D | null = null;
    let statusCircleC2: THREE.Object3D | null = null;
    let statusCircleOther: THREE.Object3D | null = null;


    // Carregamento do modelo 3D GLB.
    loader.load('/rooftop_engie.glb', (gltf: GLTF) => {
      model = gltf.scene;
      // Percorre todos os objetos do modelo para identificar e armazenar referências importantes.
      model.traverse((child) => { 
        if (child.isMesh) {
          // Identifica o ventilador pela cor do material.
          if (child.material && child.material.name === 'Black_Ventilation') {
            ventiladorEvap = child;
          }
          // Identifica compressores pelos nomes dos materiais.
          if (child.material.name === 'Black_Compressor1') {
            compressor1 = child;
          }
          if (child.material.name === 'Black_Compressor2') {
            compressor2 = child;
          }
          // Armazena todos os objetos com material branco do equipamento para efeitos visuais.
          if (child.material && child.material.name === 'White_Equipment') {
            whiteEquipments.push(child);
          }
          // Identifica as plaquinhas de status para aplicar cores e interatividade.
          if (child.isMesh && child.material && child.material.name === 'Status_Color_Circle_Ventilation') {
            statusCircleVent = child;
            console.log('Plaquinha de ventilação encontrada:', child);
          }
          if (child.material && child.material.name === 'Status_Color_Circle_C1') {
            statusCircleC1 = child;
          }
          if (child.material && child.material.name === 'Status_Color_Circle_C2') {
            statusCircleC2 = child;
          }
          if (child.material && child.material.name === 'Status_Color_Circle_Other') {
            statusCircleOther = child;
          }
        }
      });
      scene.add(model); // Adiciona o modelo carregado à cena.
    });

    // Controle de rotação da câmera usando o mouse.
    // Variáveis para controlar o estado do arrasto e ângulos alvo para suavização.
    let isDragging = false;
    let previousX = 0;
    let previousY = 0;
    let targetAngleY = cameraAngleY;
    let targetAngleX = cameraAngleX;

    // Evento disparado ao iniciar o clique e arrasto do mouse.
    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      previousX = e.clientX;
      previousY = e.clientY;
      renderer.domElement.style.cursor = 'grabbing';
    };

    // Evento disparado ao soltar o clique do mouse.
    const onPointerUp = () => {
      isDragging = false;
      renderer.domElement.style.cursor = 'grab';
    };

    // Evento disparado quando o mouse se move enquanto está clicado.
    const onPointerMove = (e: PointerEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - previousX;
        const deltaY = e.clientY - previousY;
        // Atualiza os ângulos alvo baseados no movimento do mouse.
        targetAngleY -= deltaX * 0.01; // Inverte o sentido horizontal.
        targetAngleX += deltaY * 0.01; // Inverte o sentido vertical.
        // Limita a rotação vertical para não inverter a câmera.
        targetAngleX = Math.max(minPolarAngle, Math.min(maxPolarAngle, targetAngleX));
        previousX = e.clientX;
        previousY = e.clientY;
      }
    };

    // Adiciona os event listeners para controlar a rotação da câmera.
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);


    // Controle de zoom usando a roda do mouse.
    const minDistance = 2.5; // Distância mínima da câmera.
    const maxDistance = 8;   // Distância máxima da câmera.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistance += e.deltaY * 0.003; // Ajusta a distância com base no scroll.
      cameraDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance)); // Limita a distância.
    };
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Função para atualizar o tamanho do renderizador e a proporção da câmera quando a janela for redimensionada.
    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix(); // Atualiza a matriz de projeção da câmera.
      renderer.setSize(mount.clientWidth, mount.clientHeight); // Ajusta o tamanho do canvas.
    };
    window.addEventListener('resize', handleResize);

    // Função para aplicar a cor correspondente ao status nas plaquinhas de status.
    function applyStatusColor(
      mesh: THREE.Object3D | null,
      status: 'bom' | 'alerta' | 'critico'
    ) {
      if (
        mesh &&
        mesh instanceof THREE.Mesh &&
        (mesh.material instanceof THREE.MeshStandardMaterial ||
          mesh.material instanceof THREE.MeshBasicMaterial)
      ) {
        if (status === 'critico') {
          mesh.material.color.set('#DB3735'); // Vermelho para crítico.
        } else if (status === 'alerta') {
          mesh.material.color.set('#FF8C47'); // Laranja para alerta.
        } else {
          mesh.material.color.set('#008836'); // Verde para bom.
        }
      }
    }

    // Função principal de animação que é chamada a cada frame.
    const animate = () => {
      requestAnimationFrame(animate); // Solicita a próxima animação.

      // Suaviza a rotação da câmera interpolando entre os ângulos atuais e os alvos.
      cameraAngleY += (targetAngleY - cameraAngleY) * 0.1;
      cameraAngleX += (targetAngleX - cameraAngleX) * 0.1;
      updateCamera(); // Atualiza a posição da câmera.

      // Rotaciona o ventilador se ele estiver carregado.
      if (ventiladorEvap && ventiladorEvap instanceof THREE.Mesh) {
        ventiladorEvap.rotation.x += 0.08; // Rotação constante para simular funcionamento.
      }

      const time = performance.now() * 0.0025; // Tempo para animações pulsantes.

      // Função para aplicar efeito pulsante de cor baseado no status (localizada dentro de animate)
      const applyStatusEffect = (mesh: THREE.Object3D | null, status: 'bom' | 'alerta' | 'critico') => {
        if (mesh && mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
          if (status === 'critico') {
            const pulse = (Math.sin(time * 1.6) + 1) / 2; // Piscar mais lento (reduz a velocidade da pulsação).
            const baseColor = new THREE.Color('#DB3735'); // Cor base vermelha.
            const currentColor = new THREE.Color().lerpColors(new THREE.Color('#701313'), baseColor, pulse); // Interpola entre tons.
            mesh.material.color.copy(currentColor);
          } else if (status === 'alerta') {
            const pulse = (Math.sin(time * 1.6) + 1) / 2; // Piscar mais lento (reduz a velocidade da pulsação).
            const baseColor = new THREE.Color('#FF8C47'); // Cor base laranja.
            const currentColor = new THREE.Color().lerpColors(new THREE.Color('#975800'), baseColor, pulse);
            mesh.material.color.copy(currentColor);
          } else {
            mesh.material.color.set('#000000'); // Preto para status bom (sem efeito).
          }
        }
      };

      // Aplica os efeitos de status nos componentes principais.
      applyStatusEffect(ventiladorEvap, ventiladorStatus);
      applyStatusEffect(compressor1, compressor1Status);
      applyStatusEffect(compressor2, compressor2Status);

      // Rotaciona as ventoinhas dos compressores para simular funcionamento.
      const ventCompress1 = model.getObjectByName('Vent_Compress_1');
      const ventCompress2 = model.getObjectByName('Vent_Compress_2');

      if (ventCompress1) {
        ventCompress1.rotation.y += 0.1;
      }

      if (ventCompress2) {
        ventCompress2.rotation.y += 0.1;
      }

      // Aplica as cores estáticas nas plaquinhas de status.
      applyStatusColor(statusCircleVent, ventiladorStatus);
      applyStatusColor(statusCircleC1, compressor1Status);
      applyStatusColor(statusCircleC2, compressor2Status);
      applyStatusColor(statusCircleOther, equipamentoStatus);

      // Renderiza a cena a partir da perspectiva da câmera.
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup: Remove event listeners e elementos DOM quando o componente é desmontado.
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      mount.removeChild(renderer.domElement);
      renderer.dispose(); // Libera recursos do renderizador.
    };
  }, []);

  // Retorna um div que servirá como container para o canvas WebGL.
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
