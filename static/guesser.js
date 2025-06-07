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

let restoreDraw = [];
let restoreIndex = -1;
function saveState() {
  restoreDraw.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  restoreIndex += 1;
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
// Không cho phép vẽ trên canvas
canvas.style.pointerEvents = "none";
