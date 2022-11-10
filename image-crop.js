
const ASPECT_RATIO = 0.8;
const EDITOR_HEIGHT = 375;
const EDITOR_WIDTH = EDITOR_HEIGHT * ASPECT_RATIO;

const CANVAS_SCALE = 1;//window.devicePixelRatio;
const VIEWPORT_WIDTH = EDITOR_WIDTH;
const VIEWPORT_HEIGHT = EDITOR_HEIGHT;
const BORDER_WIDTH = 4;
const CROP_BORDER_WIDTH = 4;
const CROP_CORNER_SIZE = 12;
const BORDER_COLOUR = '#d53880';
const CROP_AREA_COLOUR = 'lime';
const EDITOR_BACKGROUND_COLOUR = '#D3F2F1';
const CORNER = {
  TOP_LEFT: 'TL',
  TOP_RIGHT: 'TR',
  BOTTOM_RIGHT: 'TR',
  BOTTOM_LEFT: 'TL'
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

const drawExportImage = ({renderWidth, renderHeight}) => {
  const canvas = exportCanvas;
  const context = exportCanvas.getContext('2d');
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);

  const ratioX = renderWidth / sourceCanvas.width;

  // TODO - Landscape works, make PORTRAIT work next!
  context.drawImage(sourceCanvas, cropData.x / ratioX, ((editorCanvas.height - cropHeight) * 0.5 - cropData.y) / ratioX, cropWidth / ratioX, cropHeight / ratioX, 0, 0, canvas.width, canvas.height);

  // console.log(ratioX, cropData.x / ratioX);

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

  drawCropArea({renderWidth, renderHeight, offsetX: dragOffsetX, offsetY: dragOffsetY});

  context.restore();

  drawExportImage({renderWidth, renderHeight});
};

const drawCropArea = ({renderWidth, renderHeight, offsetX = 0, offsetY = 0}) => {
  const canvas = editorCanvas;
  const context = canvas.getContext('2d');

  cropWidth = imgOrientation === ORIENTATION.LANDSCAPE ? renderHeight * ASPECT_RATIO : renderWidth;
  cropHeight = cropWidth / ASPECT_RATIO;
  if (cachedCropPosX < 0 && cachedCropPosY < 0) {
    cachedCropPosX = canvas.width * 0.5 - cropWidth * 0.5;
    cachedCropPosY = canvas.height * 0.5 - cropHeight * 0.5;
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
  context.lineWidth = CROP_BORDER_WIDTH;
  context.strokeRect(cropData.x, cropData.y, cropData.width, cropData.height);

  // Draw crop corners
  context.fillStyle = CROP_AREA_COLOUR;
  context.fillRect(cropData.x - CROP_CORNER_SIZE * 0.5, cropData.y - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.x + cropData.width - CROP_CORNER_SIZE * 0.5, cropData.y - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.x + cropData.width - CROP_CORNER_SIZE * 0.5, cropData.y + cropData.height - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.x - CROP_CORNER_SIZE * 0.5, cropData.y + cropData.height - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
}

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
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.getContext('2d').scale(scale, scale);
  console.log(scale);
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
  setCanvasSize(
    exportCanvas,
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
    const imageData = exportCanvas.toDataURL();
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

const onMouseMove = (e) => {
  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Hit detection - main area = MOVE
  if (!cropDragging) {
    if (x >= cropData.x && x <= cropData.x + cropData.width && y >= cropData.y && y <= cropData.y + cropData.height) {
      setCursor(editorCanvas, 'move');
    } else {
      setCursor(editorCanvas, 'default');
    }

    // Corner detection
    activeCropCorner = '';
    if (x >= cropData.x - CROP_CORNER_SIZE * 0.5 && x <= cropData.x + CROP_CORNER_SIZE * 0.5 && y >= cropData.y - CROP_CORNER_SIZE * 0.5 && y <= cropData.y + CROP_CORNER_SIZE * 0.5) {
      activeCropCorner = CORNER.TOP_LEFT;
    } else if (x >= cropData.x - CROP_CORNER_SIZE * 0.5 && x <= cropData.x + CROP_CORNER_SIZE * 0.5 && y >= cropData.y + cropData.height - CROP_CORNER_SIZE * 0.5 && y <= cropData.y + cropData.height + CROP_CORNER_SIZE * 0.5) {
      activeCropCorner = CORNER.BOTTOM_LEFT;
    } else if (x >= cropData.x + cropData.width - CROP_CORNER_SIZE * 0.5 && x <= cropData.x + cropData.width + CROP_CORNER_SIZE * 0.5 && y >= cropData.y - CROP_CORNER_SIZE * 0.5 && y <= cropData.y + CROP_CORNER_SIZE * 0.5) {
      activeCropCorner = CORNER.TOP_RIGHT;
    } else if (x >= cropData.x + cropData.width - CROP_CORNER_SIZE * 0.5 && x <= cropData.x + cropData.width + CROP_CORNER_SIZE * 0.5 && y >= cropData.y + cropData.height - CROP_CORNER_SIZE * 0.5 && y <= cropData.y + cropData.height + CROP_CORNER_SIZE * 0.5) {
      activeCropCorner = CORNER.BOTTOM_RIGHT;
    }

    if (activeCropCorner) {
      setCursor(editorCanvas, 'grab');
    }
  } else {
    dragPosX = x;
    dragPosY = y;

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
  cropDragging = true;
  if (activeCropCorner) {
    setCursor(editorCanvas, 'grabbing');
  }
};

const onMouseUp = (e) => {
  cachedCropPosX = cropData.x;
  cachedCropPosY = cropData.y;
  cropDragging = false;
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
    CANVAS_SCALE
  );
  setCanvasSize(
    exportCanvas,
    VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT,
    CANVAS_SCALE
  );
  setupButtons();
  updateButtons();

  initCropAreaInteraction();
};

const setCursor = (el, cursorStyle = 'default') => {
  if (el && typeof el.style !== 'undefined') {
    el.style.cursor = cursorStyle;
  }
}

init();
