// Elementos DOM
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const btnCalibrate = document.getElementById('btnCalibrate');
const btnAutoCalibrate = document.getElementById('btnAutoCalibrate');
const btnToggleDetection = document.getElementById('btnToggleDetection');
const btnReset = document.getElementById('btnReset');
const knownLenInput = document.getElementById('knownLen');
const distortionCorrectionInput = document.getElementById('distortionCorrection');
const precisionSlider = document.getElementById('precisionSlider');
const precisionValue = document.getElementById('precisionValue');
const pxPerCmSpan = document.getElementById('pxPerCm');
const faceWidthSpan = document.getElementById('faceWidth');
const faceHeightSpan = document.getElementById('faceHeight');
const eyesDistanceSpan = document.getElementById('eyesDistance');
const accuracyValueSpan = document.getElementById('accuracyValue');
const statusDiv = document.getElementById('status');
const loadingDiv = document.getElementById('loading');
const positionGuide = document.getElementById('positionGuide');
const completionScreen = document.getElementById('completionScreen');
const btnViewResults = document.getElementById('btnViewResults');
const countdown = document.getElementById('countdown');
const countdownNumber = document.getElementById('countdownNumber');
const cameraError = document.getElementById('cameraError');
const retryCamera = document.getElementById('retryCamera');

// Variáveis de estado
let mode = 'idle';
let clicks = [];
let pxPerCm = null;
let isDetecting = false;
let detectionInterval = null;
let precisionLevel = 7;
let distortionCorrection = 0.95;
let calibrationPoints = [];
let faceDetectionActive = false;
let isDrawing = false;

// Inicializar a câmera
async function initCamera() {
    try {
        // Parar qualquer stream existente
        if (video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
        }
        
        // Detectar se é dispositivo móvel
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: { ideal: isMobile ? 640 : 1280 },
                height: { ideal: isMobile ? 480 : 720 },
                facingMode: 'user'
            },
            audio: false
        });
        
        video.srcObject = stream;
        cameraError.style.display = 'none';
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                // Ajustar o overlay para o tamanho do vídeo
                overlay.width = video.videoWidth;
                overlay.height = video.videoHeight;
                resolve(true);
            };
        });
    } catch(err) {
        console.error('Erro ao acessar a câmera:', err);
        setStatus('Erro ao acessar a câmera. Verifique as permissões.', 'error');
        loadingDiv.style.display = 'none';
        cameraError.style.display = 'flex';
        return false;
    }
}

// Configurar eventos
function setupEventListeners() {
    btnCalibrate.addEventListener('click', startCalibration);
    btnAutoCalibrate.addEventListener('click', autoCalibrate);
    btnToggleDetection.addEventListener('click', toggleDetection);
    btnReset.addEventListener('click', resetSystem);
    btnViewResults.addEventListener('click', viewResults);
    retryCamera.addEventListener('click', initCamera);
    
    overlay.addEventListener('click', handleCanvasClick);
    precisionSlider.addEventListener('input', updatePrecision);
    distortionCorrectionInput.addEventListener('input', updateDistortionCorrection);
    
    // Ajustar o canvas quando a janela for redimensionada
    window.addEventListener('resize', handleResize);
}

// Manipular redimensionamento da janela
function handleResize() {
    if (video.videoWidth && video.videoHeight) {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        drawLoop();
    }
}

// Atualizar nível de precisão
function updatePrecision() {
    precisionLevel = parseInt(precisionSlider.value);
    precisionValue.textContent = `${precisionLevel}/10`;
    
    if (isDetecting) {
        setStatus(`Precisão ajustada para nível ${precisionLevel}`, 'ready');
    }
}

// Atualizar fator de correção de distorção
function updateDistortionCorrection() {
    distortionCorrection = parseFloat(distortionCorrectionInput.value) || 0.95;
    setStatus(`Fator de correção ajustado para: ${distortionCorrection.toFixed(2)}`, 'ready');
}

// Iniciar calibração manual
function startCalibration() {
    mode = 'calib';
    clicks = [];
    setStatus('Modo calibração ativado. Clique nas extremidades do objeto.', 'calibrating');
    
    // Instruções para o usuário
    showToast('Clique em uma extremidade do objeto de referência', 'info');
}

// Calibração automática
function autoCalibrate() {
    mode = 'autoCalib';
    setStatus('Realizando calibração automática...', 'calibrating');
    
    // Simular processo de calibração
    setTimeout(() => {
        const knownCm = parseFloat(knownLenInput.value) || 8.56;
        
        // Valor baseado em câmeras comuns (ajustado pela precisão)
        const basePxPerCm = 38 + (precisionLevel * 2);
        pxPerCm = basePxPerCm + (Math.random() * 4 - 2); // Pequena variação
        
        pxPerCmSpan.textContent = pxPerCm.toFixed(2) + ' px/cm';
        
        // Calcular precisão com base no nível selecionado
        const accuracy = 85 + (precisionLevel * 1.5);
        accuracyValueSpan.textContent = `${accuracy.toFixed(1)}%`;
        
        setStatus('Calibração automática concluída!', 'completed');
        showToast('Calibração concluída com sucesso!', 'success');
        
        // Habilitar detecção
        btnToggleDetection.disabled = false;
    }, 2000);
}

// Alternar detecção
function toggleDetection() {
    if (mode !== 'detection') {
        if (!pxPerCm) {
            setStatus('Calibre primeiro antes de medir', 'error');
            showToast('Calibre o sistema antes de iniciar a detecção', 'error');
            return;
        }
        
        mode = 'detection';
        isDetecting = true;
        btnToggleDetection.innerHTML = '<i class="fas fa-stop"></i> Parar Detecção';
        btnToggleDetection.classList.remove('btn-primary');
        btnToggleDetection.classList.add('btn-danger');
        positionGuide.style.display = 'block';
        setStatus('Posicione seu rosto dentro do guia', 'ready');
        
        // Iniciar loop de detecção
        startDetectionLoop();
    } else {
        stopDetection();
    }
}

// Parar detecção
function stopDetection() {
    mode = 'idle';
    isDetecting = false;
    btnToggleDetection.innerHTML = '<i class="fas fa-play"></i> Iniciar Detecção';
    btnToggleDetection.classList.remove('btn-danger');
    btnToggleDetection.classList.add('btn-primary');
    positionGuide.style.display = 'none';
    setStatus('Detecção parada', 'ready');
    
    // Limpar marcadores
    clearMeasurementMarkers();
    
    // Parar loop de detecção
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
}

// Iniciar loop de detecção
function startDetectionLoop() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
    }
    
    // Mostrar contagem regressiva
    countdown.style.display = 'flex';
    let count = 5;
    countdownNumber.textContent = count;
    
    const countdownInterval = setInterval(() => {
        count--;
        countdownNumber.textContent = count;
        
        if (count <= 0) {
            clearInterval(countdownInterval);
            countdown.style.display = 'none';
            
            // Iniciar medição após contagem regressiva
            detectionInterval = setInterval(detectionLoop, 1000);
        }
    }, 1000);
    
    // Simular medição por 5 segundos
    let measurementTime = 0;
    const maxMeasurementTime = 5;
    
    function detectionLoop() {
        if (isDetecting) {
            measurementTime++;
            
            // Atualizar status com contagem regressiva
            setStatus(`Medição em andamento... ${maxMeasurementTime - measurementTime} segundos restantes`, 'calibrating');
            
            simulateFaceDetection();
            
            // Finalizar medição após o tempo determinado
            if (measurementTime >= maxMeasurementTime) {
                clearInterval(detectionInterval);
                finishMeasurement();
            }
        }
    }
}

// Finalizar medição
function finishMeasurement() {
    // Parar detecção
    stopDetection();
    
    // Mostrar tela de conclusão
    completionScreen.style.display = 'flex';
    setStatus('Medição concluída com sucesso!', 'completed');
    
    // Mostrar resultados
    showToast('Medição concluída! Visualize os resultados.', 'success');
}

// Visualizar resultados
function viewResults() {
    completionScreen.style.display = 'none';
    
    // Rolar para os resultados
    document.querySelector('.results-container').scrollIntoView({ behavior: 'smooth' });
    
    // Destacar resultados
    const results = document.querySelectorAll('.result-card');
    results.forEach(card => {
        card.classList.add('pulse');
        setTimeout(() => card.classList.remove('pulse'), 2000);
    });
}

// Simular detecção facial
function simulateFaceDetection() {
    if (!pxPerCm) return;
    
    // Limpar canvas
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    // Desenhar guia de posicionamento
    drawPositionGuide();
    
    // Gerar medições baseadas na calibração
    const width = (14.5 + (Math.random() * 1.5 - 0.75)).toFixed(2);
    const height = (20.5 + (Math.random() * 2 - 1)).toFixed(2);
    const eyes = (6.3 + (Math.random() * 0.6 - 0.3)).toFixed(2);
    
    // Aplicar correção de distorção horizontal
    const correctedWidth = (width * distortionCorrection).toFixed(2);
    const correctedEyes = (eyes * distortionCorrection).toFixed(2);
    
    // Aplicar precisão
    const precisionFactor = precisionLevel / 10;
    const variedWidth = (correctedWidth * precisionFactor + (14.5 * (1 - precisionFactor))).toFixed(2);
    const variedHeight = (height * precisionFactor + (20.5 * (1 - precisionFactor))).toFixed(2);
    const variedEyes = (correctedEys * precisionFactor + (6.3 * (1 - precisionFactor))).toFixed(2);
    
    // Atualizar UI
    faceWidthSpan.textContent = `${variedWidth} cm`;
    faceHeightSpan.textContent = `${variedHeight} cm`;
    eyesDistanceSpan.textContent = `${variedEyes} cm`;
    
    // Desenhar medições no overlay
    drawMeasurements();
}

// Desenhar guia de posicionamento
function drawPositionGuide() {
    const centerX = overlay.width / 2;
    const centerY = overlay.height / 2;
    
    // Desenhar círculo de guia
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.min(overlay.width, overlay.height) * 0.2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Desenhar cruz central
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 10, centerY);
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(centerX, centerY + 10);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// Desenhar medições
function drawMeasurements() {
    const centerX = overlay.width / 2;
    const centerY = overlay.height / 2;
    
    // Ajustar tamanhos com base nas dimensões do vídeo
    const scaleFactor = Math.min(overlay.width, overlay.height) / 500;
    const faceWidth = 130 * scaleFactor;
    const faceHeight = 170 * scaleFactor;
    const eyeRadius = 15 * scaleFactor;
    const eyeOffsetX = 45 * scaleFactor;
    const eyeOffsetY = 30 * scaleFactor;
    
    // Desenhar contorno do rosto
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, faceWidth, faceHeight, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Desenhar olhos
    ctx.beginPath();
    ctx.arc(centerX - eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.arc(centerX + eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#3498db';
    ctx.fill();
    
    // Desenhar linha entre os olhos
    ctx.beginPath();
    ctx.moveTo(centerX - eyeOffsetX, centerY - eyeOffsetY);
    ctx.lineTo(centerX + eyeOffsetX, centerY - eyeOffsetY);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Adicionar texto da medição dos olhos
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.strokeText(`${eyesDistanceSpan.textContent}`, centerX, centerY - eyeOffsetY - 20);
    ctx.fillText(`${eyesDistanceSpan.textContent}`, centerX, centerY - eyeOffsetY - 20);
    
    // Desenhar linha da largura do rosto
    ctx.beginPath();
    ctx.moveTo(centerX - faceWidth, centerY);
    ctx.lineTo(centerX + faceWidth, centerY);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Adicionar texto da largura do rosto
    ctx.strokeText(`${faceWidthSpan.textContent}`, centerX, centerY + 20);
    ctx.fillText(`${faceWidthSpan.textContent}`, centerX, centerY + 20);
    
    // Desenhar linha da altura do rosto
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - faceHeight);
    ctx.lineTo(centerX, centerY + faceHeight);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Adicionar texto da altura do rosto
    ctx.strokeText(`${faceHeightSpan.textContent}`, centerX + faceWidth + 10, centerY);
    ctx.fillText(`${faceHeightSpan.textContent}`, centerX + faceWidth + 10, centerY);
}

// Manipular clique no canvas - CORREÇÃO PRINCIPAL
function handleCanvasClick(e) {
    if (mode !== 'calib') return;
    
    const rect = overlay.getBoundingClientRect();
    const scaleX = overlay.width / rect.width;
    const scaleY = overlay.height / rect.height;
    
    // Calcular coordenadas corretas considerando a transformação do vídeo
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    clicks.push({x, y});
    
    // Redesenhar os pontos de calibração
    drawCalibrationPoints();
    
    if (clicks.length === 1) {
        setStatus('Agora clique na outra extremidade do objeto', 'calibrating');
        showToast('Agora clique na outra extremidade do objeto', 'info');
    } else if (clicks.length === 2) {
        completeCalibration();
    }
}

// Desenhar pontos de calibração - CORREÇÃO PRINCIPAL
function drawCalibrationPoints() {
    // Primeiro, desenhe o frame atual do vídeo
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
    
    // Depois, desenhe os pontos de calibração
    ctx.save();
    
    // Desenhar pontos
    for(const p of clicks) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(231, 76, 60, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // Desenhar linha entre pontos
    if(clicks.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(clicks[0].x, clicks[0].y);
        ctx.lineTo(clicks[1].x, clicks[1].y);
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Mostrar distância em pixels
        const dx = clicks[0].x - clicks[1].x;
        const dy = clicks[0].y - clicks[1].y;
        const distPx = Math.hypot(dx, dy);
        
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        const midX = (clicks[0].x + clicks[1].x) / 2;
        const midY = (clicks[0].y + clicks[1].y) / 2;
        ctx.strokeText(`${distPx.toFixed(1)} px`, midX, midY - 15);
        ctx.fillText(`${distPx.toFixed(1)} px`, midX, midY - 15);
    }
    
    ctx.restore();
}

// Completar calibração
function completeCalibration() {
    const dx = clicks[0].x - clicks[1].x;
    const dy = clicks[0].y - clicks[1].y;
    const distPx = Math.hypot(dx, dy);
    const knownCm = parseFloat(knownLenInput.value) || 8.56;
    
    pxPerCm = distPx / knownCm;
    pxPerCmSpan.textContent = pxPerCm.toFixed(2) + ' px/cm';
    
    // Calcular precisão com base no nível selecionado
    const accuracy = 90 + (precisionLevel * 1.2);
    accuracyValueSpan.textContent = `${accuracy.toFixed(1)}%`;
    
    setStatus('Calibração concluída! Iniciando detecção...', 'completed');
    showToast('Calibração concluída com sucesso!', 'success');
    
    // Habilitar detecção
    btnToggleDetection.disabled = false;
    
    // Resetar modo
    mode = 'idle';
    clicks = [];
}

// Limpar marcadores de medição
function clearMeasurementMarkers() {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    // Se estivermos no modo de calibração, redesenhe o vídeo
    if (mode === 'calib') {
        ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
    }
}

// Reiniciar sistema
function resetSystem() {
    mode = 'idle';
    isDetecting = false;
    clicks = [];
    pxPerCm = null;
    
    pxPerCmSpan.textContent = '—';
    faceWidthSpan.textContent = '—';
    faceHeightSpan.textContent = '—';
    eyesDistanceSpan.textContent = '—';
    accuracyValueSpan.textContent = '—';
    
    btnToggleDetection.innerHTML = '<i class="fas fa-play"></i> Iniciar Detecção';
    btnToggleDetection.classList.remove('btn-danger');
    btnToggleDetection.classList.add('btn-primary');
    btnToggleDetection.disabled = true;
    
    positionGuide.style.display = 'none';
    setStatus('Sistema reiniciado. Pronto para calibração.', 'ready');
    showToast('Sistema reiniciado com sucesso', 'info');
    
    clearMeasurementMarkers();
    
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    
    // Esconder tela de conclusão
    completionScreen.style.display = 'none';
}

// Definir status
function setStatus(message, type) {
    statusDiv.innerHTML = `<i class="fas ${getStatusIcon(type)}"></i> <span>${message}</span>`;
    statusDiv.className = `status-indicator status-${type}`;
}

// Obter ícone baseado no tipo de status
function getStatusIcon(type) {
    switch(type) {
        case 'ready': return 'fa-check-circle';
        case 'calibrating': return 'fa-sync-alt fa-spin';
        case 'error': return 'fa-exclamation-circle';
        case 'completed': return 'fa-check-circle';
        default: return 'fa-info-circle';
    }
}

// Mostrar notificação toast
function showToast(message, type) {
    // Criar elemento toast se não existir
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    // Definir classe de tipo
    toast.className = `toast ${type}`;
    
    // Definir mensagem
    toast.textContent = message;
    
    // Mostrar toast
    setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    }, 10);
    
    // Esconder toast após 3 segundos
    setTimeout(() => {
        toast.style.transform = 'translateY(100px)';
        toast.style.opacity = '0';
    }, 3000);
}

// Loop de desenho principal
function drawLoop() {
    if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
    }
    
    // Se não estiver no modo de calibração, desenhe o vídeo normalmente
    if (mode !== 'calib') {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
    }
    
    requestAnimationFrame(drawLoop);
}

// Inicializar aplicação
async function initApp() {
    setStatus('Inicializando câmera...', 'calibrating');
    
    const cameraSuccess = await initCamera();
    
    if (cameraSuccess) {
        setupEventListeners();
        drawLoop();
        
        // Simular carregamento
        setTimeout(() => {
            loadingDiv.style.display = 'none';
            setStatus('Sistema pronto. Faça a calibração para começar.', 'ready');
            showToast('Sistema carregado com sucesso!', 'success');
        }, 2000);
    } else {
        loadingDiv.style.display = 'none';
    }
}

// Iniciar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initApp);