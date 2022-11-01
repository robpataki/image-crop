const CROP_WIDTH = 413;
const CROP_HEIGHT = 531;
const CANVAS_SCALE = 2;
const VIEWPORT_WIDTH = CROP_WIDTH * 0.5;
const VIEWPORT_HEIGHT = CROP_HEIGHT * 0.5;

// Cache DOM elements
const sourceCanvas = document.querySelector('#source-canvas');
const editorCanvas = document.querySelector('#editor-canvas');
const context = editorCanvas.getContext('2d');
const uploadButton = document.querySelector('#photo-upload');
const rotateButton = document.querySelector('#rotate-button');
const saveButton = document.querySelector('#save-button');

const img = new Image();
img.src =
  'https://assets1.ignimgs.com/2019/06/09/donkey-kong-country-1---button-v1-1560099410346.jpg';
const reader = new FileReader();
let hasSource = false;
let rotationCounter = 0;
let ratioX = 0;
let scaledImageWidth = 0;
let scaledImageHeight = 0;

const drawEditorImage = () => {
  const canvas = editorCanvas;
  const context = editorCanvas.getContext('2d');
  const ratioX = sourceCanvas.width / canvas.width;
  
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width / CANVAS_SCALE, canvas.height / CANVAS_SCALE);
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
}

const redrawCanvases = () => {
  resizeCanvases();
  drawSourceImage();
  drawEditorImage();
};

const onLoadImage = () => {
  rotationCounter = 0;
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
    const imageData = canvas.toDataURL();
    console.log(imageData);
  });
};

const updateButtons = () => {
  if (!hasSource) {
    rotateButton.setAttribute('disabled', 'disabled');
    saveButton.setAttribute('disabled', 'disabled');
  } else {
    rotateButton.removeAttribute('disabled');
    saveButton.removeAttribute('disabled');
  }
};

const init = () => {
  setupButtons();
  //   Debug only
  hasSource = true;
  onLoadImage();

  updateButtons();
};

init();
