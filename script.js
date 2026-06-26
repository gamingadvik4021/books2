// Strict Global Worker setup sequence handling to prevent system memory lockups
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com';

let pdfDoc = null;
let pageNum = 1;
let fabricCanvas = null;
let pageCanvasData = {};
let isRendering = false; // Flag to prevent multi-click thread collisions on heavy files

// Workspace Node Elements
const pdfUpload = document.getElementById('pdf-upload');
const toolbar = document.getElementById('toolbar');
const uploadPrompt = document.getElementById('upload-prompt');
const canvasContainer = document.getElementById('canvas-container');
const pageNumDisplay = document.getElementById('page-num');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const addTextBtn = document.getElementById('add-text-btn');
const addRectBtn = document.getElementById('add-rect-btn');
const pageColorInput = document.getElementById('page-color');
const downloadBtn = document.getElementById('download-btn');

// View Tab Navigation Elements
const tabEditor1 = document.getElementById('tab-editor1');
const tabEditor2 = document.getElementById('tab-editor2');
const viewEditor1 = document.getElementById('view-editor1');
const viewEditor2 = document.getElementById('view-editor2');
const editor2Frame = document.getElementById('editor2-frame');
const editor2Placeholder = document.getElementById('editor2-placeholder');

// --- Tab Controller Navigation Logic ---
tabEditor1.addEventListener('click', () => {
    tabEditor1.className = "px-4 py-1.5 rounded-md text-sm font-medium transition bg-indigo-600 text-white shadow";
    tabEditor2.className = "px-4 py-1.5 rounded-md text-sm font-medium transition text-gray-400 hover:text-white";
    viewEditor1.classList.remove('hidden');
    viewEditor2.classList.add('hidden');
});

tabEditor2.addEventListener('click', () => {
    tabEditor2.className = "px-4 py-1.5 rounded-md text-sm font-medium transition text-gray-400 hover:text-white";
    tabEditor1.className = "px-4 py-1.5 rounded-md text-sm font-medium transition bg-indigo-600 text-white shadow";
    viewEditor1.classList.add('hidden');
    viewEditor2.classList.remove('hidden');
    
    if (fabricCanvas) {
        editor2Placeholder.classList.add('hidden');
        editor2Frame.classList.remove('hidden');
        const doc = editor2Frame.contentDocument || editor2Frame.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
            <body style="background:#111827; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; font-family:sans-serif; color:#9ca3af;">
                <div style="text-align:center;">
                    <img src="${fabricCanvas.toDataURL()}" style="max-width:90%; max-height:85vh; border: 1px solid #374151; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);" />
                    <p style="margin-top:15px; font-size:13px; color:#6366f1; letter-spacing:1px;">PREVIEW STREAM // COMPILED RENDER LAYER ONE</p>
                </div>
            </body>
            </html>
        `);
        doc.close();
    }
});

// --- Core Workspace Engine Functions ---
function initCanvas(width, height) {
    if (fabricCanvas) {
        fabricCanvas.clear();
        fabricCanvas.dispose();
    }
    canvasContainer.style.width = `${width}px`;
    canvasContainer.style.height = `${height}px`;
    fabricCanvas = new fabric.Canvas('book-canvas', {
        width: width,
        height: height,
        backgroundColor: '#ffffff'
    });
}

async function renderPage(num) {
    if (isRendering) return; // Block multiple clicks until thread completes
    isRendering = true;

    if (fabricCanvas && pageNum) {
        pageCanvasData[pageNum] = fabricCanvas.toJSON();
    }

    pageNum = num;
    pageNumDisplay.textContent = `Page ${num} / ${pdfDoc.numPages}`;
    
    try {
        const page = await pdfDoc.getPage(num);
        // Scaled to exactly 1.0 to handle memory limits across long documents efficiently
        const viewport = page.getViewport({ scale: 1.0 });
        
        initCanvas(viewport.width, viewport.height);

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;

        await page.render({ canvasContext: tempCtx, viewport: viewport }).promise;

        fabric.Image.fromURL(tempCanvas.toDataURL(), (img) => {
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
                scaleX: 1,
                scaleY: 1
            });
            
            if (pageCanvasData[num]) {
                fabricCanvas.loadFromJSON(pageCanvasData[num], () => {
                    fabricCanvas.renderAll();
                    isRendering = false; // Unlock UI
                });
            } else {
                isRendering = false; // Unlock UI
            }
            
            // Clean up temporary DOM components instantly to save system heap RAM space
            tempCanvas.remove();
        });
    } catch (err) {
        console.error(err);
        isRendering = false;
    }
}

// --- Event Handlers ---
pdfUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    const fileReader = new FileReader();
    fileReader.onload = async function() {
        try {
            const typedarray = new Uint8Array(this.result);
            pdfDoc = await pdfjsLib.getDocument({data: typedarray}).promise;
            
            uploadPrompt.classList.add('hidden');
            toolbar.classList.remove('hidden');
            canvasContainer.classList.remove('hidden');
            downloadBtn.classList.remove('hidden');
            
            pageCanvasData = {};
            await renderPage(1);
        } catch (err) {
            alert("Error loading PDF structural parameters mapping layout: " + err.message);
        }
    };
    fileReader.readAsArrayBuffer(file);
});

addTextBtn.addEventListener('click', () => {
    if (!fabricCanvas) return;
    const text = new fabric.IText('Double Click to Edit', {
        left: 50,
        top: 50,
        fontFamily: 'sans-serif',
        fill: '#4f46e5',
        fontSize: 24
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
});

addRectBtn.addEventListener('click', () => {
    if (!fabricCanvas) return;
    const rect = new fabric.Rect({
        left: 80,
        top: 80,
        fill: 'rgba(99, 102, 241, 0.3)',
        width: 150,
        height: 100,
        stroke: '#4f46e5',
        strokeWidth: 2
    });
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
});

pageColorInput.addEventListener('input', (e) => {
    if (!fabricCanvas) return;
    const overlay = new fabric.Rect({
        left: 0,
        top: 0,
        width: fabricCanvas.width,
        height: fabricCanvas.height,
        fill: e.target.value,
        opacity: 0.15,
        selectable: false,
        evented: false
    });
    fabricCanvas.add(overlay);
    fabricCanvas.renderAll();
});

prevPageBtn.addEventListener('click', () => {
    if (!pdfDoc || pageNum <= 1 || isRendering) return;
    renderPage(pageNum - 1);
});

nextPageBtn.addEventListener('click', () => {
    if (!pdfDoc || pageNum >= pdfDoc.numPages || isRendering) return;
    renderPage(pageNum + 1);
});

// --- Fixed High-Performance Download Engine For Large PDFs ---
downloadBtn.addEventListener('click', async () => {
    if (!pdfDoc || !fabricCanvas) return;
    
    // 1. Save the design layout of your current page first
    pageCanvasData[pageNum] = fabricCanvas.toJSON();
    
    // 2. Change button text to show live background loading progress
    downloadBtn.disabled = true;
    downloadBtn.style.opacity = "0.6";
    downloadBtn.textContent = "Compiling Pages (0%)...";
    
    const { jsPDF } = window.jspdf;
    let finalDoc = null;
    const originalPageNum = pageNum; // Remember where the user was looking

    try {
        // 3. Process each page sequentially with micro-task breaks to clear system RAM
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            // Update download button text with real-time percentage
            const percent = Math.round((i / pdfDoc.numPages) * 100);
            downloadBtn.textContent = `Processing Page ${i}/${pdfDoc.numPages} (${percent}%)`;
            
            // Bypass thread lock and render the target page
            isRendering = false; 
            await renderPage(i);
            
            // Wait 50 milliseconds to ensure the browser canvas has drawn the data completely
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Compress the image data slightly (0.85 quality) to ensure large books don't crash
            const rawDataString = fabricCanvas.toDataURL({ format: 'jpeg', quality: 0.85 });
            const canvasW = fabricCanvas.width;
            const canvasH = fabricCanvas.height;

            if (i === 1) {
                const pageLayoutMode = canvasW > canvasH ? 'l' : 'p';
                finalDoc = new jsPDF(pageLayoutMode, 'px', [canvasW, canvasH]);
            } else {
                finalDoc.addPage([canvasW, canvasH]);
            }
            
            finalDoc.addImage(rawDataString, 'JPEG', 0, 0, canvasW, canvasH);
        }

        // 4. Trigger the browser's download window file stream saving action
        downloadBtn.textContent = "Saving File...";
        finalDoc.save('custom-book-edition.pdf');
        
    } catch (error) {
        console.error("Download pipeline failed:", error);
        alert("Download failed due to browser memory limits. Try using a slightly smaller PDF file.");
    } finally {
        // 5. Restore the user's view back to the page they were originally editing
