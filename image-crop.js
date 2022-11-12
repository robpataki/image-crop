// TODO - Make Crop area resizable
// TODO - Determine and lock to minimum crop area

const ASPECT_RATIO = 35/45; //7:9
const EDITOR_HEIGHT = 375;
const EDITOR_WIDTH = EDITOR_HEIGHT * ASPECT_RATIO;

const SCALE = window.devicePixelRatio;
const VIEWPORT_WIDTH = EDITOR_WIDTH;
const VIEWPORT_HEIGHT = EDITOR_HEIGHT;
const BORDER_WIDTH = 2;
const CROP_BORDER_WIDTH = 2;
const CROP_CORNER_SIZE = 10;
const BORDER_COLOUR = '#b1b4b6';
const CROP_AREA_COLOUR = '#ffdd00';
const EDITOR_BACKGROUND_COLOUR = '#ffffff';
const CORNER = {
  TOP_LEFT: 'TL',
  TOP_RIGHT: 'TR',
  BOTTOM_RIGHT: 'BR',
  BOTTOM_LEFT: 'BL'
};
const ORIENTATION = {
  LANDSCAPE: 'L',
  PORTRAIT: 'P'
};
let imgOrientation = '';
let activeCropCorner = '';
let cropWidth = 0;
let cropHeight = 0;
let cropDragging = false;
let cropAreaActive = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragPosX = -1;
let dragPosY = -1;
let dragStartPosX = -1;
let dragStartPosY = -1;
let cachedCropPosX = -1;
let cachedCropPosY = -1;

// Cache DOM elements
const statusMessage = document.querySelector('#status-message');
const sourceImage = document.querySelector('#source-image');
const sourceCanvas = document.querySelector('#source-canvas');
const sourceImageDetails = document.querySelector('#source-image-details');
const editorCanvas = document.querySelector('#editor-canvas');
const exportCanvas = document.querySelector('#export-canvas');
const context = editorCanvas.getContext('2d');
const uploadButton = document.querySelector('#photo-upload');
const rotateButton = document.querySelector('#rotate-button');
const resetButton = document.querySelector('#reset-button');
const toggleSourceButton = document.querySelector('#toggle-source-button');
const saveButton = document.querySelector('#save-button');
const debugLog = document.querySelector('#debug-log');

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

const drawExportImage = (renderWidth) => {
  const canvas = exportCanvas;
  const context = exportCanvas.getContext('2d');
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);

  const ratioX = renderWidth / sourceCanvas.width / SCALE;

  if (imgOrientation === ORIENTATION.LANDSCAPE) {
    context.drawImage(sourceCanvas, cropData.x / ratioX / SCALE, ((editorCanvas.height - cropHeight) * 0.5 - cropData.y) / ratioX / SCALE, cropWidth / ratioX / SCALE, cropHeight / ratioX / SCALE, 0, 0, canvas.width / SCALE, canvas.height / SCALE);
  } else {
    context.drawImage(sourceCanvas, ((editorCanvas.width - cropWidth) * 0.5 - cropData.x) / ratioX / SCALE, cropData.y / ratioX / SCALE, cropWidth / ratioX / SCALE, cropHeight / ratioX / SCALE, 0, 0, canvas.width / SCALE, canvas.height / SCALE);
  }

  context.restore();
}

const drawEditorImage = () => {
  const canvas = editorCanvas;
  const context = editorCanvas.getContext('2d');

  const editorWidth = canvas.width;
  const editorHeight = canvas.height;
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  
  imgOrientation = sourceWidth >= sourceHeight ? ORIENTATION.LANDSCAPE : ORIENTATION.PORTRAIT;

  let renderWidth = editorWidth;
  let renderHeight = renderWidth * sourceHeight / sourceWidth;
  if (imgOrientation === ORIENTATION.PORTRAIT && renderHeight >= editorHeight) {
    renderHeight = editorHeight;
    renderWidth = renderHeight / sourceHeight * sourceWidth;
  }

  const editorCenterPosX = (editorWidth - renderWidth) * 0.5;
  const editorCenterPosY = (editorHeight - renderHeight) * 0.5;
  
  context.save();
  context.clearRect(0, 0, editorWidth, editorHeight);
  
  // Draw editor background
  context.fillStyle = EDITOR_BACKGROUND_COLOUR;
  context.fillRect(0, 0, editorWidth, editorHeight);

  // Draw border around the image
  context.fillStyle = BORDER_COLOUR;
  const borderBoxWidth = renderWidth + BORDER_WIDTH * 2;
  const borderBoxHeight = renderHeight + BORDER_WIDTH * 2;
  context.fillRect(editorCenterPosX / SCALE - BORDER_WIDTH / SCALE, editorCenterPosY / SCALE - BORDER_WIDTH / SCALE, borderBoxWidth / SCALE, borderBoxHeight / SCALE);

  // Draw image
  context.drawImage(sourceCanvas, 0, 0, sourceWidth, sourceHeight, editorCenterPosX / SCALE, editorCenterPosY / SCALE, renderWidth / SCALE, renderHeight / SCALE);

  drawCropArea({renderWidth, renderHeight, offsetX: dragOffsetX, offsetY: dragOffsetY});

  context.restore();

  drawExportImage(renderWidth);
};

const drawCropArea = ({renderWidth, renderHeight, offsetX = 0, offsetY = 0}) => {
  const canvas = editorCanvas;
  const context = canvas.getContext('2d');

  cropWidth = imgOrientation === ORIENTATION.LANDSCAPE ? renderHeight * ASPECT_RATIO : renderWidth;
  cropHeight = cropWidth / ASPECT_RATIO;
  if (cachedCropPosX < 0 && cachedCropPosY < 0) {
    cachedCropPosX = (canvas.width - cropWidth) * 0.5;
    cachedCropPosY = (canvas.height - cropHeight) * 0.5;
  }

  // Lock the crop area within the image boundaries
  let newCropPosX = cachedCropPosX + offsetX;
  let newCropPosY = cachedCropPosY + offsetY;
  if (imgOrientation === ORIENTATION.LANDSCAPE) {
    if (cachedCropPosX + offsetX > canvas.width - cropWidth && offsetX > 0) {
      newCropPosX = canvas.width - cropWidth;
    } else if (cachedCropPosX + offsetX < 0 && offsetX < 0) {
      newCropPosX = 0;
    }
    newCropPosY = canvas.height * 0.5 - cropHeight * 0.5;
  } else {
    if (cachedCropPosY + offsetY > canvas.height - cropHeight && offsetY > 0) {
      newCropPosY = canvas.height - cropHeight;
    } else if (cachedCropPosY + offsetY < 0 && offsetY < 0) {
      newCropPosY = 0;
    }
    newCropPosX = canvas.width * 0.5 - cropWidth * 0.5;
  }

  cropData = {
    x: newCropPosX,
    y: newCropPosY,
    width: cropWidth,
    height: cropHeight
  };

  context.strokeStyle = CROP_AREA_COLOUR;
  context.setLineDash([4, 2]);
  context.lineWidth = CROP_BORDER_WIDTH;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 2;
  context.shadowColor = '	#0b0c0c';
  context.strokeRect(cropData.x / SCALE, cropData.y / SCALE, cropData.width / SCALE, cropData.height / SCALE);

  // Draw crop corners
  context.fillStyle = CROP_AREA_COLOUR;
  context.fillRect(cropData.x / SCALE - CROP_CORNER_SIZE * 0.5, cropData.y / SCALE - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.x / SCALE + cropData.width / SCALE - CROP_CORNER_SIZE * 0.5, cropData.y / SCALE - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.x / SCALE + cropData.width / SCALE - CROP_CORNER_SIZE * 0.5, cropData.y / SCALE + cropData.height / SCALE - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.x / SCALE - CROP_CORNER_SIZE * 0.5, cropData.y / SCALE + cropData.height / SCALE - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
}

const drawSourceImage = () => {
  const canvas = sourceCanvas;
  const context = sourceCanvas.getContext('2d');
  
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  context.translate(canvas.width / SCALE * 0.5, canvas.height / SCALE * 0.5);
  context.rotate(Math.PI/2 * rotationCounter);
  
  let logicalWidth = rotationCounter%2 === 0 ? canvas.width : canvas.height;
  let logicalHeight = logicalWidth === canvas.width ? canvas.height : canvas.width;
  context.drawImage(img, logicalWidth / SCALE * -0.5, logicalHeight / SCALE * -0.5, logicalWidth / SCALE, logicalHeight / SCALE);
  context.restore();
};

const renderPreviewImage = (file) => {
  img.onload = onLoadImage;
  img.src = URL.createObjectURL(file);
};

const setCanvasSize = (canvas, width, height, scale) => {
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.getContext('2d').scale(scale, scale);
};

const resizeCanvases = () => {  
  let logicalWidth = rotationCounter%2 === 0 ? img.naturalWidth : img.naturalHeight;
  let logicalHeight =
    logicalWidth === img.naturalWidth ? img.naturalHeight : img.naturalWidth;
  ratioX = VIEWPORT_WIDTH / img.naturalWidth;

  setCanvasSize(sourceCanvas, logicalWidth / SCALE, logicalHeight / SCALE, SCALE);
  setCanvasSize(
    editorCanvas,
    VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT,
    SCALE
  );
  setCanvasSize(
    exportCanvas,
    VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT,
    SCALE
  );

  if (logicalWidth / SCALE < VIEWPORT_WIDTH || logicalHeight / SCALE < VIEWPORT_HEIGHT) {
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
  cachedCropPosX = -1;
  cachedCropPosY = -1;
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
    resetData();
    redrawCanvases();
  });

  saveButton.addEventListener('click', () => {
    const imageData = exportCanvas.toDataURL('image/jpeg', 0.2);
    navigator.clipboard.writeText(imageData);
    console.info('Check clipboard for image data');
  });

  toggleSourceButton.addEventListener('click', () => {
    sourceImage.style.display = sourceImage.style.display !== 'none' ? 'none' : 'block';
  });

  resetButton.addEventListener('click', () => {
    rotationCounter = 0;
    resetData();
    redrawCanvases();
  });
};

const resetData = () => {
  cachedCropPosX = -1;
  cachedCropPosY = -1;
  imgOrientation = '';
  cropWidth = 0;
  cropHeight = 0;
}

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

const checkCropAreaActivity = (e) => {
  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const halfCornerSize = CROP_CORNER_SIZE * 0.5;
  const scaledCropData = {
    x: cropData.x / SCALE,
    y: cropData.y / SCALE,
    width: cropData.width / SCALE,
    height: cropData.height / SCALE,
  };

  if (!cropDragging) {
    if (x >= scaledCropData.x && x <= scaledCropData.x + scaledCropData.width && y >= scaledCropData.y && y <= scaledCropData.y + scaledCropData.height) {
      setCursor(editorCanvas, 'move');
      cropAreaActive = true;
    } else {
      setCursor(editorCanvas, 'default');
      cropAreaActive = false;
    }

    // Corner detection
    activeCropCorner = '';
    if (x >= scaledCropData.x - halfCornerSize && x <= scaledCropData.x + halfCornerSize && y >= scaledCropData.y - halfCornerSize && y <= scaledCropData.y + halfCornerSize) {
      activeCropCorner = CORNER.TOP_LEFT;
    } else if (x >= scaledCropData.x - halfCornerSize && x <= scaledCropData.x + halfCornerSize && y >= scaledCropData.y + scaledCropData.height - halfCornerSize && y <= scaledCropData.y + scaledCropData.height + halfCornerSize) {
      activeCropCorner = CORNER.BOTTOM_LEFT;
    } else if (x >= scaledCropData.x + scaledCropData.width - halfCornerSize && x <= scaledCropData.x + scaledCropData.width + halfCornerSize && y >= scaledCropData.y - halfCornerSize && y <= scaledCropData.y + halfCornerSize) {
      activeCropCorner = CORNER.TOP_RIGHT;
    } else if (x >= scaledCropData.x + scaledCropData.width - halfCornerSize && x <= scaledCropData.x + scaledCropData.width + halfCornerSize && y >= scaledCropData.y + scaledCropData.height - halfCornerSize && y <= scaledCropData.y + scaledCropData.height + halfCornerSize) {
      activeCropCorner = CORNER.BOTTOM_RIGHT;
    }
  }
};

const onMouseMove = (e) => {
  checkCropAreaActivity(e);
  const rect = e.target.getBoundingClientRect();
  
  if (!cropDragging) {
    if (activeCropCorner) {
      setCursor(editorCanvas, 'grab');
    }
  } else {
    dragPosX = e.clientX * SCALE - rect.left;
    dragPosY = e.clientY * SCALE - rect.top;

    if (!activeCropCorner) {
      if (dragStartPosX < 0 && dragStartPosY < 0) {
        dragStartPosX = dragPosX;
        dragStartPosY = dragPosY;
      }

      dragOffsetX = dragPosX - dragStartPosX;
      dragOffsetY = dragPosY - dragStartPosY;
    }

    drawEditorImage();
  }
};

const onMouseDown = (e) => {
  checkCropAreaActivity(e);

  if (hasSource) {
    if (activeCropCorner || cropAreaActive) {
      cropDragging = true;

      if (activeCropCorner) {
        setCursor(editorCanvas, 'grabbing');
      }
    }
  }
};

const onMouseUp = (e) => {
  cropDragging = false;
  
  checkCropAreaActivity(e);

  cachedCropPosX = cropData.x;
  cachedCropPosY = cropData.y;
  dragPosX = -1;
  dragPosY = -1;
  dragStartPosX = -1;
  dragStartPosY = -1;
  dragOffsetX = 0;
  dragOffsetY = 0;
};

initCropAreaInteraction = () => {
  editorCanvas.addEventListener('mousedown', onMouseDown);
  editorCanvas.addEventListener('mousemove', onMouseMove);
  document.body.addEventListener('mouseup', onMouseUp);
}

const init = () => {
  setCanvasSize(
    editorCanvas,
    VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT,
    SCALE
  );
  setCanvasSize(
    exportCanvas,
    VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT,
    SCALE
  );
  setupButtons();
  updateButtons();

  initCropAreaInteraction();
  render();
};

const setCursor = (el, cursorStyle = 'default') => {
  if (el && typeof el.style !== 'undefined') {
    el.style.cursor = cursorStyle;
  }
};

const render = () => {
  if (hasSource) {
    debug(`activeCropCorner: "${activeCropCorner}"\ncropDragging: ${cropDragging}\ncropAreaActive: ${cropAreaActive}`);
  }

  requestAnimationFrame(render);
};

const debug = (text) => {
  debugLog.innerHTML = `\n${text}`;
  debugLog.scrollTop = debugLog.scrollHeight;
};

init();
