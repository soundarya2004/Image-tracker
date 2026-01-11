        const DISPLAY_W = 900;
        const DISPLAY_H = 600;
        
        let refImg = null;
        let patchData = null;
        let isSelectingROI = false;
        let startX, startY, currentX, currentY;
        
        const refCanvas = document.getElementById('refCanvas');
        const targetCanvas = document.getElementById('targetCanvas');
        const refCtx = refCanvas.getContext('2d');
        const targetCtx = targetCanvas.getContext('2d');
        
        document.getElementById('refImage').addEventListener('change', handleRefImage);
        document.getElementById('targetImage').addEventListener('change', handleTargetImage);
        document.getElementById('undoBtn').addEventListener('click', undoSelection);
        
        refCanvas.addEventListener('mousedown', startROI);
        refCanvas.addEventListener('mousemove', drawROI);
        refCanvas.addEventListener('mouseup', endROI);
        
        function handleRefImage(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    refImg = img;
                    const {canvas: resized, scale} = resizeForDisplay(img);
                    refCanvas.width = resized.width;
                    refCanvas.height = resized.height;
                    refCtx.drawImage(resized, 0, 0);
                    
                    document.getElementById('refStatus').innerHTML = 
                        '<div class="notification notification-info">Image loaded successfully. Draw a rectangle to select the region of interest.</div>';
                    patchData = null;
                    document.getElementById('targetImage').disabled = true;
                    document.getElementById('targetLabel').classList.add('disabled');
                    document.getElementById('undoBtn').disabled = true;
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
        
        function startROI(e) {
            if (!refImg || patchData) return;
            isSelectingROI = true;
            const rect = refCanvas.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
        }
        
        function drawROI(e) {
            if (!isSelectingROI) return;
            const rect = refCanvas.getBoundingClientRect();
            currentX = e.clientX - rect.left;
            currentY = e.clientY - rect.top;
            
            refCtx.clearRect(0, 0, refCanvas.width, refCanvas.height);
            const {canvas: resized} = resizeForDisplay(refImg);
            refCtx.drawImage(resized, 0, 0);
            
            refCtx.strokeStyle = '#386ed8ff';
            refCtx.lineWidth = 2;
            refCtx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        }
        
        function endROI(e) {
            if (!isSelectingROI) return;
            isSelectingROI = false;
            
            const rect = refCanvas.getBoundingClientRect();
            currentX = e.clientX - rect.left;
            currentY = e.clientY - rect.top;
            
            const x = Math.min(startX, currentX);
            const y = Math.min(startY, currentY);
            const w = Math.abs(currentX - startX);
            const h = Math.abs(currentY - startY);
            
            if (w < 10 || h < 10) {
                document.getElementById('refStatus').innerHTML = 
                    '<div class="notification notification-error">Selection area is too small. Please select a larger region.</div>';
                return;
            }
            
            const {scale} = resizeForDisplay(refImg);
            const origX = Math.floor(x / scale);
            const origY = Math.floor(y / scale);
            const origW = Math.floor(w / scale);
            const origH = Math.floor(h / scale);
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = refImg.width;
            tempCanvas.height = refImg.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(refImg, 0, 0);
            
            patchData = {
                imageData: tempCtx.getImageData(origX, origY, origW, origH),
                width: origW,
                height: origH
            };
            
            refCtx.clearRect(0, 0, refCanvas.width, refCanvas.height);
            const {canvas: resized} = resizeForDisplay(refImg);
            refCtx.drawImage(resized, 0, 0);
            refCtx.strokeStyle = '#48df1bff';
            refCtx.lineWidth = 3;
            refCtx.strokeRect(x, y, w, h);
            
            document.getElementById('refStatus').innerHTML = 
                '<div class="notification notification-success">Region selected successfully. You may now upload a target image for tracking.</div>';
            document.getElementById('targetImage').disabled = false;
            document.getElementById('targetLabel').classList.remove('disabled');
            document.getElementById('undoBtn').disabled = false;
        }
        
        function undoSelection() {
            patchData = null;
            if (refImg) {
                refCtx.clearRect(0, 0, refCanvas.width, refCanvas.height);
                const {canvas: resized} = resizeForDisplay(refImg);
                refCtx.drawImage(resized, 0, 0);
            }
            document.getElementById('refStatus').innerHTML = 
                '<div class="notification notification-info">Selection cleared. Draw a new rectangle to select region of interest.</div>';
            document.getElementById('targetImage').disabled = true;
            document.getElementById('targetLabel').classList.add('disabled');
            document.getElementById('undoBtn').disabled = true;
            targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
            document.getElementById('targetStatus').innerHTML = '';
            document.getElementById('results').innerHTML = 
                '<div class="empty-message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>No tracking data available. Upload images to begin analysis.</p></div>';
        }
        
        function handleTargetImage(e) {
            if (!patchData) return;
            
            const file = e.target.files[0];
            if (!file) return;
            
            document.getElementById('targetStatus').innerHTML = 
                '<div class="notification notification-info">Processing image and performing pattern matching...</div>';
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    performMatching(img);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
        
        function resizeForDisplay(img) {
            const scale = Math.min(DISPLAY_W / img.width, DISPLAY_H / img.height, 1.0);
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            return {canvas, scale};
        }
        
        function edgeMap(imageData) {
            const gray = new Uint8Array(imageData.width * imageData.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
                gray[i / 4] = Math.floor(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2]);
            }
            
            const edges = new Uint8Array(imageData.width * imageData.height);
            const w = imageData.width, h = imageData.height;
            
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const gx = -gray[(y-1)*w + x-1] + gray[(y-1)*w + x+1] - 2*gray[y*w + x-1] + 2*gray[y*w + x+1] - gray[(y+1)*w + x-1] + gray[(y+1)*w + x+1];
                    const gy = -gray[(y-1)*w + x-1] - 2*gray[(y-1)*w + x] - gray[(y-1)*w + x+1] + gray[(y+1)*w + x-1] + 2*gray[(y+1)*w + x] + gray[(y+1)*w + x+1];
                    const mag = Math.sqrt(gx*gx + gy*gy);
                    edges[y*w + x] = mag > 80 ? 255 : 0;
                }
            }
            return edges;
        }
        
        function distanceTransform(edges, w, h) {
            const dist = new Float32Array(w * h);
            dist.fill(1e9);
            
            for (let i = 0; i < edges.length; i++) {
                if (edges[i] > 0) dist[i] = 0;
            }
            
            for (let y = 1; y < h; y++) {
                for (let x = 1; x < w; x++) {
                    const idx = y * w + x;
                    dist[idx] = Math.min(dist[idx], dist[idx - 1] + 1, dist[idx - w] + 1);
                }
            }
            
            for (let y = h - 2; y >= 0; y--) {
                for (let x = w - 2; x >= 0; x--) {
                    const idx = y * w + x;
                    dist[idx] = Math.min(dist[idx], dist[idx + 1] + 1, dist[idx + w] + 1);
                }
            }
            
            return dist;
        }
        
        function rotateImageData(imageData, angle) {
            const rad = angle * Math.PI / 180;
            const cos = Math.cos(rad), sin = Math.sin(rad);
            const w = imageData.width, h = imageData.height;
            
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            
            ctx.translate(w / 2, h / 2);
            ctx.rotate(rad);
            ctx.translate(-w / 2, -h / 2);
            ctx.putImageData(imageData, 0, 0);
            
            return ctx.getImageData(0, 0, w, h);
        }
        
        function performMatching(targetImg) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = targetImg.width;
            tempCanvas.height = targetImg.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(targetImg, 0, 0);
            const targetData = tempCtx.getImageData(0, 0, targetImg.width, targetImg.height);
            
            let best = {score: 1e9, loc: null, angle: 0};
            
            for (let angle = -20; angle <= 20; angle += 5) {
                const rotated = rotateImageData(patchData.imageData, angle);
                const {score, loc} = chamferMatchFast(rotated, targetData);
                
                if (score !== null && score < best.score) {
                    best = {score, loc, angle};
                }
            }
            
            const confidence = Math.exp(-best.score / 5.0);
            
            if (best.loc === null || confidence < 0.45) {
                document.getElementById('targetStatus').innerHTML = 
                    '<div class="notification notification-error">Pattern matching failed. No suitable match found in target image.</div>';
                document.getElementById('results').innerHTML = 
                    '<div class="empty-message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><p>Part not detected in target image.</p></div>';
                return;
            }
            
            const {canvas: resized, scale} = resizeForDisplay(targetImg);
            targetCanvas.width = resized.width;
            targetCanvas.height = resized.height;
            targetCtx.drawImage(resized, 0, 0);
            
            const x = Math.floor(best.loc.x * scale);
            const y = Math.floor(best.loc.y * scale);
            const w = Math.floor(patchData.width * scale);
            const h = Math.floor(patchData.height * scale);
            
            targetCtx.strokeStyle = '#00e50fff';
            targetCtx.lineWidth = 3;
            targetCtx.strokeRect(x, y, w, h);
            
            document.getElementById('targetStatus').innerHTML = 
                '<div class="notification notification-success">Pattern matching completed successfully.</div>';
            
            document.getElementById('results').innerHTML = `
                <div class="metrics-grid">
                    <div class="metric-box">
                        <div class="metric-title">X Position</div>
                        <div class="metric-number">${best.loc.x}</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-title">Y Position</div>
                        <div class="metric-number">${best.loc.y}</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-title">Rotation</div>
                        <div class="metric-number">${best.angle}°</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-title">Confidence</div>
                        <div class="metric-number">${(confidence * 100).toFixed(1)}%</div>
                    </div>
                </div>
            `;
        }
        
        function chamferMatchFast(patchData, sceneData, stride = 10, maxEdges = 500) {
            const ep = edgeMap(patchData);
            const es = edgeMap(sceneData);
            
            const dist = distanceTransform(es, sceneData.width, sceneData.height);
            
            const edgePoints = [];
            for (let i = 0; i < ep.length; i++) {
                if (ep[i] > 0) {
                    edgePoints.push({x: i % patchData.width, y: Math.floor(i / patchData.width)});
                }
            }
            
            if (edgePoints.length < 60) return {score: null, loc: null};
            
            const sampledPoints = edgePoints.length > maxEdges 
                ? edgePoints.sort(() => Math.random() - 0.5).slice(0, maxEdges)
                : edgePoints;
            
            let bestScore = 1e9;
            let bestLoc = null;
            
            const h = patchData.height, w = patchData.width;
            const H = sceneData.height, W = sceneData.width;
            
            for (let y = 0; y < H - h; y += stride) {
                for (let x = 0; x < W - w; x += stride) {
                    let sum = 0;
                    for (const pt of sampledPoints) {
                        const sy = y + pt.y;
                        const sx = x + pt.x;
                        if (sy < H && sx < W) {
                            sum += dist[sy * W + sx];
                        }
                    }
                    const score = sum / sampledPoints.length;
                    
                    if (score < bestScore) {
                        bestScore = score;
                        bestLoc = {x, y};
                    }
                }
            }
            
            return {score: bestScore, loc: bestLoc};
        }