
const ASPECT_RATIO = 0.8;
const EDITOR_HEIGHT = 375;
const EDITOR_WIDTH = EDITOR_HEIGHT * ASPECT_RATIO;

const CANVAS_SCALE = 1;
const VIEWPORT_WIDTH = EDITOR_WIDTH;
const VIEWPORT_HEIGHT = EDITOR_HEIGHT;
const BORDER_WIDTH = 4;
const CROP_BORDER_WIDTH = 4;
const CROP_CORNER_SIZE = 12;
const BORDER_COLOUR = '#d53880';
const CROP_AREA_COLOUR = 'lime';
const EDITOR_BACKGROUND_COLOUR = '#D3F2F1';

// Cache DOM elements
const statusMessage = document.querySelector('#status-message');
const sourceImage = document.querySelector('#source-image');
const sourceCanvas = document.querySelector('#source-canvas');
const sourceImageDetails = document.querySelector('#source-image-details');
const editorCanvas = document.querySelector('#editor-canvas');
const context = editorCanvas.getContext('2d');
const uploadButton = document.querySelector('#photo-upload');
const rotateButton = document.querySelector('#rotate-button');
const resetButton = document.querySelector('#reset-button');
const toggleSourceButton = document.querySelector('#toggle-source-button');
const saveButton = document.querySelector('#save-button');

let cropData = {
  x: -1,
  y: -1,
  width: -1,
  height: -1
};

const img = new Image();
const reader = new FileReader();
let hasSource = false;
let rotationCounter = 0;
let ratioX = 0;
let scaledImageWidth = 0;
let scaledImageHeight = 0;

const drawEditorImage = () => {
  const canvas = editorCanvas;
  const context = editorCanvas.getContext('2d');

  const editorWidth = canvas.width;
  const editorHeight = canvas.height;
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  
  const imgOrientation = sourceWidth >= sourceHeight ? 'landscape' : 'portrait';

  let renderWidth = editorWidth;
  let renderHeight = renderWidth * sourceHeight / sourceWidth;
  if (imgOrientation === 'portrait' && renderHeight >= editorHeight) {
    renderHeight = editorHeight;
    renderWidth = renderHeight / sourceHeight * sourceWidth;
  }

  const editorCenterPosX = editorWidth * 0.5 - renderWidth * 0.5;
  const editorCenterPosY = editorHeight * 0.5 - renderHeight * 0.5;
  
  context.save();
  context.clearRect(0, 0, editorWidth, editorHeight);
  
  // Draw editor background
  context.fillStyle = EDITOR_BACKGROUND_COLOUR;
  context.fillRect(0, 0, editorWidth, editorHeight);

  // Draw border around the image
  context.fillStyle = BORDER_COLOUR;
  const borderBoxWidth = renderWidth / CANVAS_SCALE + BORDER_WIDTH * 2 / CANVAS_SCALE;
  const borderBoxHeight = renderHeight / CANVAS_SCALE + BORDER_WIDTH * 2 / CANVAS_SCALE;
  context.fillRect(editorCenterPosX - BORDER_WIDTH / CANVAS_SCALE, editorCenterPosY - BORDER_WIDTH / CANVAS_SCALE, borderBoxWidth / CANVAS_SCALE, borderBoxHeight / CANVAS_SCALE);

  // Draw image
  context.drawImage(sourceCanvas, 0, 0, sourceWidth, sourceHeight, editorCenterPosX / CANVAS_SCALE, editorCenterPosY / CANVAS_SCALE, renderWidth / CANVAS_SCALE, renderHeight / CANVAS_SCALE);

  // Draw crop area
  const cropWidth = imgOrientation === 'landscape' ? renderHeight * ASPECT_RATIO : renderWidth;
  const cropHeight = imgOrientation === 'landscape' ? cropWidth / ASPECT_RATIO : cropWidth / ASPECT_RATIO;
  cropData = {
    x: editorWidth * 0.5 - cropWidth * 0.5,
    y: editorHeight * 0.5 - cropHeight * 0.5,
    width: cropWidth,
    height: cropHeight
  };

  context.strokeStyle = CROP_AREA_COLOUR;
  context.lineWidth = CROP_BORDER_WIDTH;
  context.strokeRect(cropData.x, cropData.y, cropData.width / CANVAS_SCALE, cropData.height / CANVAS_SCALE);

  // Draw crop corners
  context.fillStyle = CROP_AREA_COLOUR;
  context.fillRect(cropData.x - CROP_CORNER_SIZE * 0.5, cropData.y - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.x + cropData.width - CROP_CORNER_SIZE * 0.5, cropData.y - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.x + cropData.width - CROP_CORNER_SIZE * 0.5, cropData.y + cropData.height - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.x - CROP_CORNER_SIZE * 0.5, cropData.y + cropData.height - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);

  context.restore();
};

const drawSourceImage = () => {
  const canvas = sourceCanvas;
  const context = sourceCanvas.getContext('2d');
  
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  context.translate(canvas.width / CANVAS_SCALE * 0.5, canvas.height / CANVAS_SCALE * 0.5);
  context.rotate(Math.PI/2 * rotationCounter);
  
  let logicalWidth = rotationCounter%2 === 0 ? canvas.width : canvas.height;
  let logicalHeight = logicalWidth === canvas.width ? canvas.height : canvas.width;
  context.drawImage(img, logicalWidth / CANVAS_SCALE * -0.5, logicalHeight / CANVAS_SCALE * -0.5, logicalWidth / CANVAS_SCALE, logicalHeight / CANVAS_SCALE);
  context.restore();
};

const renderPreviewImage = (file) => {
  img.onload = onLoadImage;
  img.src = URL.createObjectURL(file);
};

const setCanvasSize = (canvas, width, height, scale) => {
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.getContext('2d').scale(scale, scale);
};

const resizeCanvases = () => {  
  let logicalWidth = rotationCounter%2 === 0 ? img.naturalWidth : img.naturalHeight;
  let logicalHeight =
    logicalWidth === img.naturalWidth ? img.naturalHeight : img.naturalWidth;
  ratioX = VIEWPORT_WIDTH / img.naturalWidth;

  setCanvasSize(sourceCanvas, logicalWidth / CANVAS_SCALE, logicalHeight / CANVAS_SCALE, CANVAS_SCALE);
  setCanvasSize(
    editorCanvas,
    VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT,
    CANVAS_SCALE
  );

  if (logicalWidth / CANVAS_SCALE < VIEWPORT_WIDTH || logicalHeight / CANVAS_SCALE < VIEWPORT_HEIGHT) {
    showSizeStatus(true);
  } else {
    showSizeStatus();
  }
};

const showSizeStatus = (showWarning = false) => {
  statusMessage.innerHTML = showWarning ? '&#10060; Image is too small for printing' : '&#9989; Size is good';
};

const redrawCanvases = () => {
  resizeCanvases();
  drawSourceImage();
  drawEditorImage();
};

const onLoadImage = () => {
  rotationCounter = 0;
  updateSourceImageDetails();
  redrawCanvases();
};

const setupButtons = () => {
  uploadButton.addEventListener('change', (e) => {
    let files = e.target.files;

    if (files.length > 0) {
      hasSource = true;
      renderPreviewImage(files[0], context);
    }
    updateButtons();
  });

  rotateButton.addEventListener('click', () => {
    rotationCounter = rotationCounter < 3 ? ++rotationCounter : 0;
    redrawCanvases();
  });

  saveButton.addEventListener('click', () => {
    const imageData = editorCanvas.toDataURL();
    navigator.clipboard.writeText(imageData);
    console.info('Check clipboard for image data');
  });

  toggleSourceButton.addEventListener('click', () => {
    sourceImage.style.display = sourceImage.style.display !== 'none' ? 'none' : 'block';
  });

  resetButton.addEventListener('click', () => {
    rotationCounter = 0;
    redrawCanvases();
  });
};

const updateSourceImageDetails = () => {
  sourceImageDetails.innerHTML = `Width: ${img.naturalWidth}px`;
  sourceImageDetails.innerHTML += `<br/>Height: ${img.naturalHeight}px`;
};

const updateButtons = () => {
  if (!hasSource) {
    rotateButton.setAttribute('disabled', 'disabled');
    saveButton.setAttribute('disabled', 'disabled');
    resetButton.setAttribute('disabled', 'disabled');
  } else {
    rotateButton.removeAttribute('disabled');
    saveButton.removeAttribute('disabled');
    resetButton.removeAttribute('disabled');
  }
};

const onMouseMove = (e) => {
  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Hit detection - main area = MOVE
  if (x >= cropData.x && x <= cropData.x + cropData.width && y >= cropData.y && y <= cropData.y + cropData.height) {
    setCursor(editorCanvas, 'move');
  } else {
    setCursor(editorCanvas, 'default');
  }
}

const init = () => {
  setCanvasSize(
    editorCanvas,
    VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT,
    CANVAS_SCALE
  );
  setupButtons();
  updateButtons();

  editorCanvas.addEventListener('mouseenter', () => {
    editorCanvas.addEventListener('mousemove', onMouseMove);
  });

  editorCanvas.addEventListener('mouseleave', () => {
    editorCanvas.removeEventListener('mousemove', onMouseMove);
  });
};

const setCursor = (el, cursorStyle = 'default') => {
  if (el && typeof el.style !== 'undefined') {
    el.style.cursor = cursorStyle;
  }
}

init();
