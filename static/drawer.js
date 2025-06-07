let isDrawing = false;
let drawWidth = 5;
let drawColor = "black";
let restoreDraw = [];
let restoreIndex = -1;

const defaultColor = "white";

// Get room key from URL
const urlParams = new URLSearchParams(window.location.search);
const roomKey = urlParams.get("key");

if (!roomKey) {
  alert("Không tìm thấy mã phòng!");
  window.location.href = "index.html";
}

const ws = new WebSocket(
  `ws://localhost:8080/ws?key=${encodeURIComponent(roomKey)}`
);

ws.onopen = function () {
  console.log("WebSocket connection established");
};
ws.onclose = function () {
  console.log("WebSocket connection closed");
};
ws.onerror = function (error) {
  console.error("WebSocket error:", error);
  alert("Không thể kết nối đến phòng. Phòng có thể không tồn tại.");
  window.location.href = "index.html";
};

const canvas = document.getElementById("drawingCanvas");
const rect = canvas.getBoundingClientRect();
const ratio = window.devicePixelRatio || 1;
canvas.width = rect.width * ratio;
canvas.height = rect.height * ratio;
canvas.style.width = rect.width + "px";
canvas.style.height = rect.height + "px";

const ctx = canvas.getContext("2d", { willReadFrequently: true });
ctx.scale(ratio, ratio);
ctx.fillStyle = defaultColor;
ctx.fillRect(0, 0, canvas.width, canvas.height);

let last_mouse = { x: 0, y: 0 };

function getMouseX(e) {
  return e.clientX - rect.left;
}
function getMouseY(e) {
  return e.clientY - rect.top;
}

canvas.addEventListener(
  "mousedown",
  function (e) {
    isDrawing = true;
    last_mouse.x = getMouseX(e);
    last_mouse.y = getMouseY(e);
  },
  false
);

canvas.addEventListener(
  "mousemove",
  function (e) {
    if (!isDrawing) return;
    const mouse = {
      x: getMouseX(e),
      y: getMouseY(e),
    };
    onDraw(last_mouse, mouse, drawColor, drawWidth);
    ws.send(
      JSON.stringify({
        type: "draw",
        data: {
          from: { ...last_mouse },
          to: { ...mouse },
          color: drawColor,
          width: drawWidth,
        },
      })
    );
    last_mouse = { ...mouse };
  },
  false
);

function saveState() {
  restoreDraw.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  restoreIndex += 1;
}

canvas.addEventListener(
  "mouseup",
  function (e) {
    isDrawing = false;
    saveState();
    ws.send(
      JSON.stringify({
        type: "mouseup",
        data: {},
      })
    );
  },
  false
);

canvas.addEventListener(
  "mouseout",
  function (e) {
    isDrawing = false;
    saveState();
    ws.send(
      JSON.stringify({
        type: "mouseout",
        data: {},
      })
    );
  },
  false
);

function onDraw(from, to, color, width) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.closePath();
}

function clearCanvas() {
  ctx.fillStyle = defaultColor;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  restoreDraw = [];
  restoreIndex = -1;
}

const clearButton = document.getElementById("button-clear");
if (clearButton) {
  clearButton.addEventListener("click", () => {
    clearCanvas();
    ws.send(
      JSON.stringify({
        type: "clear",
        data: {},
      })
    );
  });
}

const undoButton = document.getElementById("button-undo");
if (undoButton) {
  undoButton.addEventListener("click", () => {
    if (restoreIndex <= 0) {
      clearCanvas();
      ws.send(
        JSON.stringify({
          type: "clear",
          data: {},
        })
      );
    } else {
      restoreIndex -= 1;
      restoreDraw.pop();
      ctx.putImageData(restoreDraw[restoreIndex], 0, 0);
      ws.send(
        JSON.stringify({
          type: "undo",
          data: {},
        })
      );
    }
  });
}

ws.onmessage = function (event) {
  const message = JSON.parse(event.data);
  if (message.type === "draw") {
    const { from, to, color, width } = message.data;
    onDraw(from, to, color, width);
  } else if (message.type === "clear") {
    clearCanvas();
  } else if (message.type === "undo") {
    restoreIndex -= 1;
    restoreDraw.pop();
    ctx.putImageData(restoreDraw[restoreIndex], 0, 0);
  } else if (message.type === "mouseup" || message.type === "mouseout") {
    saveState();
  }
};

const colorButtons = document.querySelectorAll(".color-btn");
colorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".color-btn.active").classList.remove("active");
    button.classList.add("active");
    drawColor = button.dataset.color;
  });
});

const brushSize = document.getElementById("brushSize");
const sizeDisplay = document.getElementById("sizeDisplay");
if (brushSize && sizeDisplay) {
  brushSize.addEventListener("input", (e) => {
    drawWidth = parseInt(e.target.value);
    sizeDisplay.textContent = drawWidth + "px";
  });
}
