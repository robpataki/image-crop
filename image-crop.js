// TODO - Set minimum crop dimensions based on source and export image dimensions
// TODO - Display if source photo meets the print dimensions

const DEBUG = false;

const ASPECT_RATIO = 35/45; // Use the printed passport photo size in mm
const PRINT_WIDTH = 430; // in pixels
const PRINT_HEIGHT = Math.round(PRINT_WIDTH / ASPECT_RATIO); // in pixels
const EDITOR_WIDTH = 400 // in pixels
const EDITOR_HEIGHT = EDITOR_WIDTH / ASPECT_RATIO;// in pixels

const SCALE = window.devicePixelRatio;
const VIEWPORT_WIDTH = EDITOR_WIDTH;
const VIEWPORT_HEIGHT = EDITOR_HEIGHT;
const BORDER_WIDTH = 4;
const CROP_BORDER_WIDTH = 2;
const CROP_CORNER_SIZE = 10;
const BORDER_COLOUR = '#b1b4b6';
const CROP_AREA_COLOUR = '#ffdd00';
const ANCHOR_POINT_COLOUR = 'lime';
const EDITOR_BACKGROUND_COLOUR = '#ffffff';
const EDITOR_OVERLAY_COLOUR = 'rgb(0, 0, 0, 50%)';
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
let anchorPoint = {x: -1, y: -1};
let anchorDistance = {x: -1, y: -1};
let activeCropCorner = '';
let pointerPos = {
  x: -1,
  y: -1,
};
let cropData = {
  x: -1,
  y: -1,
  width: -1,
  height: -1,
  scaled: {
    x: -1,
    y: -1,
    width: -1,
    height: -1,
  }
};
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
let hasSource = false;
let rotationCounter = 0;
let ratioX = 0;
let scaledImageWidth = 0;
let scaledImageHeight = 0;

// Cache DOM elements
const previewImage = document.querySelector('#preview-image');
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
const img = new Image();
const reader = new FileReader();


/* QUICK MATHS */
const getAnchorPoint = (scaledCropData) => {
  let point = {x: -1, y: -1};

  if (typeof scaledCropData !== 'undefined') {
    switch(activeCropCorner) {
      case CORNER.TOP_LEFT:
        point = {
          x: cropData.scaled.x + cropData.scaled.width,
          y: cropData.scaled.y + cropData.scaled.height
        };
        break;
      case CORNER.TOP_RIGHT:
        point = {
          x: cropData.scaled.x,
          y: cropData.scaled.y + cropData.scaled.height
        };
        break;
      case CORNER.BOTTOM_RIGHT:
        point = {
          x: cropData.scaled.x,
          y: cropData.scaled.y
        };
        break;
      case CORNER.BOTTOM_LEFT:
        point = {
          x: cropData.scaled.x + cropData.scaled.width,
          y: cropData.scaled.y
        };
        break;
    }
  }

  return point;
}

const getAnchorDistance = () => {
  let width = 0;
  let height = 0;

  switch(activeCropCorner) {
    case CORNER.TOP_LEFT:
      width = anchorPoint.x - cropData.scaled.x - dragOffsetX;
      height = anchorPoint.y - cropData.scaled.y - dragOffsetY;
    break;
    case CORNER.TOP_RIGHT:
      width = anchorPoint.x - cropData.scaled.x + cropData.scaled.width + dragOffsetX;
      height = anchorPoint.y - cropData.scaled.y - dragOffsetY;
    break;
    case CORNER.BOTTOM_RIGHT:
      width = anchorPoint.x + cropData.width + dragOffsetX;
      height = anchorPoint.y + cropData.height + dragOffsetY;
    break;
    case CORNER.BOTTOM_LEFT:
      width = anchorPoint.x / SCALE - cropData.scaled.x - dragOffsetX / SCALE;
      height = anchorPoint.y / SCALE - cropData.scaled.y + cropData.scaled.height + dragOffsetY / SCALE;
    break;
  }

  return {
    width,
    height
  }
}

/* DRAWING FUNCTIONS */
const drawExportImage = (renderWidth, renderHeight) => {
  const canvas = exportCanvas;
  const context = exportCanvas.getContext('2d');

  // Calculate the offset of the crop area from te relative editor image's TL edge
  const imageRatioX = renderWidth / sourceCanvas.width;
  const cropOffsetX = Math.round(cropData.x.toFixed(2) - ((editorCanvas.width - renderWidth) * 0.5).toFixed(2));
  const cropOffsetY = Math.round(cropData.y.toFixed(2) - ((editorCanvas.height - renderHeight) * 0.5).toFixed(2));

  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.drawImage(sourceCanvas, cropOffsetX / imageRatioX, cropOffsetY / imageRatioX, cropData.width / imageRatioX, cropData.height / imageRatioX, 0, 0, canvas.width / SCALE, canvas.height / SCALE);

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
  context.fillRect((editorCenterPosX - BORDER_WIDTH) / SCALE, (editorCenterPosY - BORDER_WIDTH) / SCALE, borderBoxWidth / SCALE, borderBoxHeight / SCALE);

  // Draw image
  context.drawImage(sourceCanvas, 0, 0, sourceWidth, sourceHeight, editorCenterPosX / SCALE, editorCenterPosY / SCALE, renderWidth / SCALE, renderHeight / SCALE);

  // Draw dark overlay
  context.fillStyle = EDITOR_OVERLAY_COLOUR;
  context.fillRect(editorCenterPosX / SCALE, editorCenterPosY / SCALE, renderWidth / SCALE, renderHeight / SCALE);

  // Cache crop area maths
  setupCropArea({imageWidth: renderWidth, imageHeight: renderHeight});

  // Draw image inside crop area
  const cropImageRatioX = renderWidth / sourceCanvas.width;
  const cropImagePosX = (cropData.x - editorCenterPosX) / cropImageRatioX;
  const cropImagePosY = (cropData.y - editorCenterPosY) / cropImageRatioX;
  context.drawImage(sourceCanvas, cropImagePosX, cropImagePosY, cropData.width / cropImageRatioX, cropData.height / cropImageRatioX, cropData.scaled.x, cropData.scaled.y, cropData.scaled.width, cropData.scaled.height);

  // Draw crop area
  drawCropArea();

  context.restore();

  drawExportImage(renderWidth, renderHeight);
};

const setupCropArea = ({imageWidth, imageHeight}) => {
  const canvas = editorCanvas;
  const maxWidth = imgOrientation === ORIENTATION.LANDSCAPE ? imageHeight * ASPECT_RATIO : imageWidth;
  const maxHeight = maxWidth / ASPECT_RATIO;

   const minWidth = 100;
   const minHeight = minWidth / ASPECT_RATIO;
 
   // Set the initial positions
   if (cachedCropPosX < 0 && cachedCropPosY < 0) {
     cachedCropPosX = (canvas.width - maxWidth) * 0.5;
     cachedCropPosY = (canvas.height - maxHeight) * 0.5;
   }
   
   // Default position
   let newCropPosX = cachedCropPosX;
   let newCropPosY = cachedCropPosY;
 
   // Default dimensions
   let cropWidth = cropData.width > 0 ? cropData.width : maxWidth;
   let cropHeight = cropData.height > 0 ? cropData.height : maxHeight;
 
   // Drag
   if (cropDragging) {
     // Resize
     if (activeCropCorner) {
       cropWidth = activeCropCorner === CORNER.BOTTOM_RIGHT || activeCropCorner === CORNER.TOP_RIGHT ? (pointerPos.x - anchorPoint.x) * SCALE : (anchorPoint.x - pointerPos.x) * SCALE;
       cropHeight = cropWidth / ASPECT_RATIO;

      //  Lock width and height to anchor point
      /* if (activeCropCorner === CORNER.BOTTOM_LEFT || activeCropCorner === CORNER.BOTTOM_RIGHT) {
        if (anchorPoint.y - (canvas.height - maxHeight) * 0.5 + cropHeight >= maxHeight) {
          cropHeight = maxHeight - (anchorPoint.y - (canvas.height - maxHeight) * 0.5);
          cropWidth = cropHeight * ASPECT_RATIO;
        }
      } else {
        if (anchorPoint.y - (canvas.height - maxHeight) * 0.5 - cropHeight <= 0) { 
          cropHeight = anchorPoint.y - (canvas.height - maxHeight) * 0.5;
          cropWidth = cropHeight * ASPECT_RATIO;
        }
      } */
 
       // Enforce min/max crop dimensions
       if (cropWidth >= maxWidth || cropHeight >= maxHeight) {
         cropWidth = maxWidth;
         cropHeight = maxHeight;
       } else if (cropWidth <= minWidth || cropHeight <= minHeight) {
         cropWidth = minWidth;
         cropHeight = minHeight;
       }
 
       switch(activeCropCorner) {
         case CORNER.TOP_LEFT:
           newCropPosX = anchorPoint.x * SCALE - cropWidth;
           newCropPosY = anchorPoint.y * SCALE - cropHeight;
           break;
         case CORNER.TOP_RIGHT:
           newCropPosX = anchorPoint.x * SCALE;
           newCropPosY = anchorPoint.y * SCALE - cropHeight;
           break;
         case CORNER.BOTTOM_RIGHT:
           newCropPosX = anchorPoint.x * SCALE;
           newCropPosY = anchorPoint.y * SCALE;
           break;
         case CORNER.BOTTOM_LEFT:
           newCropPosX = anchorPoint.x * SCALE - cropWidth;
           newCropPosY = anchorPoint.y * SCALE;
           break;
       }
     } else {
       // Move
       newCropPosX = cachedCropPosX + dragOffsetX;
       newCropPosY = cachedCropPosY + dragOffsetY;
     }


    const canvasTopEdge = (canvas.height - imageHeight) * 0.5;
    const canvasLeftEdge = (canvas.width - imageWidth) * 0.5;
    const canvasBottomEdge = (canvas.height + imageHeight) * 0.5;
    const canvasRightEdge = (canvas.width + imageWidth) * 0.5;

     // Lock the sizing within the vertical boundaries
     if (newCropPosY <= canvasTopEdge) {
      newCropPosY = canvasTopEdge;
     } else if (newCropPosY >= canvasBottomEdge - cropHeight) {
      newCropPosY = canvasBottomEdge - cropHeight;
     }
     if (newCropPosX <= canvasLeftEdge) {
      newCropPosX = canvasLeftEdge;
     } else if (newCropPosX >= canvasRightEdge - cropWidth) {
      newCropPosX = canvasRightEdge - cropWidth;
     }
   }
   
   cropData = {
     x: newCropPosX,
     y: newCropPosY,
     width: cropWidth,
     height: cropHeight, 
     scaled: {
      x: newCropPosX / SCALE,
      y: newCropPosY / SCALE,
      width: cropWidth / SCALE,
      height: cropHeight / SCALE, 
     }
   };
};

const drawCropArea = () => {
  const canvas = editorCanvas;
  const context = canvas.getContext('2d');

  // Draw main crop area
  context.strokeStyle = CROP_AREA_COLOUR;
  context.setLineDash([4, 2]);
  context.lineWidth = CROP_BORDER_WIDTH;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 2;
  context.shadowColor = '	#0b0c0c';
  context.strokeRect(cropData.scaled.x, cropData.scaled.y, cropData.scaled.width, cropData.scaled.height);

  // Draw crop corners
  /* context.setLineDash([]); */
  context.fillStyle = CROP_AREA_COLOUR;
  context.fillRect(cropData.scaled.x - CROP_CORNER_SIZE * 0.5, cropData.scaled.y - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.scaled.x + cropData.scaled.width - CROP_CORNER_SIZE * 0.5, cropData.scaled.y - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.scaled.x + cropData.scaled.width - CROP_CORNER_SIZE * 0.5, cropData.scaled.y + cropData.scaled.height - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);
  context.fillRect(cropData.scaled.x - CROP_CORNER_SIZE * 0.5, cropData.scaled.y + cropData.scaled.height - CROP_CORNER_SIZE * 0.5, CROP_CORNER_SIZE, CROP_CORNER_SIZE);

  // Draw the anchor point
  if (DEBUG && anchorPoint.x >= 0 && anchorPoint.y >= 0) {
    context.strokeStyle = ANCHOR_POINT_COLOUR;
    context.setLineDash([]);
    context.shadowBlur = 0;
    context.shadowColor = null;
    context.beginPath();
    context.arc(anchorPoint.x, anchorPoint.y, CROP_CORNER_SIZE * 1.2, 0, Math.PI * 2);
    context.stroke();
  }
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
    PRINT_WIDTH,
    PRINT_HEIGHT,
    SCALE
  );

  if (logicalWidth < PRINT_WIDTH || logicalHeight < PRINT_HEIGHT) {
    showSizeStatus(true);
  } else {
    showSizeStatus();
  }
};

const showSizeStatus = (showWarning = false) => {
  statusMessage.innerHTML = showWarning ? '&#10060; The source image is smaller than the minimum print size' : '&#9989; The source photo can be used to produce the print photo';
};

const redrawCanvases = () => {
  resizeCanvases();
  drawSourceImage();
  drawEditorImage();
};

const onLoadImage = () => {
  resetData();
  rotationCounter = 0;
  cachedCropPosX = -1;
  cachedCropPosY = -1;
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
    const imageData = exportCanvas.toDataURL('image/jpeg', 1);
    setPreviewImage(imageData);
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

const setPreviewImage = (imageSource) => {
  previewImage.setAttribute('src', imageSource);
  previewImage.style.display = 'block';
}

const resetData = () => {
  previewImage.style.display = 'none';
  anchorPoint = getAnchorPoint();
  anchorDistance = getAnchorDistance();
  cropData = {
    x: -1,
    y: -1,
    width: -1,
    height: -1,
    scaled: {
      x: -1,
      y: -1,
      width: -1,
      height: -1,
    }
  };
  cachedCropPosX = -1;
  cachedCropPosY = -1;
  imgOrientation = '';
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
  pointerPos = {
    x,
    y,
  };

  const halfCornerSize = CROP_CORNER_SIZE * 0.5;

  if (!cropDragging) {
    if (x >= cropData.scaled.x && x <= cropData.scaled.x + cropData.scaled.width && y >= cropData.scaled.y && y <= cropData.scaled.y + cropData.scaled.height) {
      setCursor(editorCanvas, 'move');
      cropAreaActive = true;
    } else {
      setCursor(editorCanvas, 'default');
      cropAreaActive = false;
    }

    // Corner detection
    activeCropCorner = '';
    if (x >= cropData.scaled.x - halfCornerSize && x <= cropData.scaled.x + halfCornerSize && y >= cropData.scaled.y - halfCornerSize && y <= cropData.scaled.y + halfCornerSize) {
      activeCropCorner = CORNER.TOP_LEFT;
    } else if (x >= cropData.scaled.x - halfCornerSize && x <= cropData.scaled.x + halfCornerSize && y >= cropData.scaled.y + cropData.scaled.height - halfCornerSize && y <= cropData.scaled.y + cropData.scaled.height + halfCornerSize) {
      activeCropCorner = CORNER.BOTTOM_LEFT;
    } else if (x >= cropData.scaled.x + cropData.scaled.width - halfCornerSize && x <= cropData.scaled.x + cropData.scaled.width + halfCornerSize && y >= cropData.scaled.y - halfCornerSize && y <= cropData.scaled.y + halfCornerSize) {
      activeCropCorner = CORNER.TOP_RIGHT;
    } else if (x >= cropData.scaled.x + cropData.scaled.width - halfCornerSize && x <= cropData.scaled.x + cropData.scaled.width + halfCornerSize && y >= cropData.scaled.y + cropData.scaled.height - halfCornerSize && y <= cropData.scaled.y + cropData.scaled.height + halfCornerSize) {
      activeCropCorner = CORNER.BOTTOM_RIGHT;
    }

    // Determine anchor point
    anchorPoint = getAnchorPoint(cropData.scaled);
  }

  anchorDistance = getAnchorDistance();
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

    if (dragStartPosX < 0 && dragStartPosY < 0) {
      dragStartPosX = dragPosX;
      dragStartPosY = dragPosY;
    }

    dragOffsetX = dragPosX - dragStartPosX;
    dragOffsetY = dragPosY - dragStartPosY;

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
        drawEditorImage();
      }
    }
  }
};

const onMouseUp = (e) => {
  cropDragging = false;
  anchorPoint = getAnchorPoint();
  anchorDistance = getAnchorDistance();
  
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
    PRINT_WIDTH,
    PRINT_HEIGHT,
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
    let debugText = `\nPrint dimensions: ${PRINT_WIDTH}px/${PRINT_HEIGHT}px`;
    if (imgOrientation === ORIENTATION.LANDSCAPE) {
      debugText+= `\nSource dimensions: ${img.naturalWidth}px/${img.naturalHeight}px`;
    } else {
      debugText+= `\nSource dimensions: ${img.naturalHeight}px/${img.naturalWidth}px`;
    }
    /* debugText += `\nCrop area active: ${cropAreaActive}`;
    debugText += `\nActive corner: "${activeCropCorner}"`;
    debugText += `\nDragging: ${cropDragging}`; */
    debugText += `\nAnchor point: ${anchorPoint.x.toFixed(2)}/${anchorPoint.y.toFixed(2)}`;
    debugText += `\nCrop TL: ${cropData.x.toFixed(2)}/${cropData.y.toFixed(2)}`;
    /* debugText += `\nDrag offset: ${dragOffsetX}/${dragOffsetY}`; */
    debugText += `\nCrop dimensions: ${(cropData.scaled.width).toFixed(2)}/${(cropData.scaled.height).toFixed(2)}`;
    debugText += `\nG/A point distance: ${(anchorDistance.width).toFixed(2)}/${(anchorDistance.height).toFixed(2)}`;
    /* debugText += `\nCached  pos: ${cachedCropPosX.toFixed(2)}/${cachedCropPosY.toFixed(2)}`; */
    debug(debugText);
  }

  requestAnimationFrame(render);
};

const debug = (text) => {
  debugLog.innerHTML = `${text}`;
  debugLog.scrollTop = debugLog.scrollHeight;
};

init();
