// Types
/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} Stroke
 * @property {string} color
 * @property {number} brushSize
 * @property {string} tool
 * @property {Point[]} points
 */

/**
 * @typedef {Object} WebSocketMessage
 * @property {string} type
 * @property {Object} data
 * @property {string} roomId
 * @property {string} playerId
 * @property {number} timestamp
 */

// Message Types
const MESSAGE_TYPES = {
    // Drawing
    DRAW_START: 'DRAW_START',
    DRAW_MOVE: 'DRAW_MOVE',
    DRAW_END: 'DRAW_END',
    CLEAR_CANVAS: 'CLEAR_CANVAS',
    UNDO_STROKE: 'UNDO_STROKE',

    // Room
    JOIN_ROOM: 'JOIN_ROOM',
    LEAVE_ROOM: 'LEAVE_ROOM',

    // Chat
    CHAT_MESSAGE: 'CHAT_MESSAGE'
};

// Canvas Manager
class CanvasManager {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.strokes = [];
        this.currentStroke = null;
        this.setupCanvas();
    }

    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * ratio;
        this.canvas.height = rect.height * ratio;
        this.ctx.scale(ratio, ratio);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    /**
     * @param {Point} pos
     * @param {boolean} isStart
     * @param {Stroke} [stroke]
     */
    drawOnCanvas(pos, isStart, stroke) {
        const color = stroke ? (stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color) : '#000000';
        const brushSize = stroke ? stroke.brushSize : 5;

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = brushSize;
        this.ctx.strokeStyle = color;

        if (isStart) {
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, pos.y);
        } else {
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        }
    }

    /**
     * @param {Point} pos
     * @param {string} color
     * @param {number} brushSize
     * @param {string} tool
     */
    startDrawing(pos, color, brushSize, tool) {
        this.currentStroke = {
            color,
            brushSize,
            tool,
            points: [pos]
        };
        this.strokes.push(this.currentStroke);
        this.drawOnCanvas(pos, true, this.currentStroke);
    }

    /**
     * @param {Point} pos
     */
    continueDrawing(pos) {
        if (this.currentStroke) {
            this.currentStroke.points.push(pos);
            this.drawOnCanvas(pos, false, this.currentStroke);
        }
    }

    endDrawing() {
        this.currentStroke = null;
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    redrawAllStrokes() {
        this.clearCanvas();
        for (const stroke of this.strokes) {
            if (!stroke.points.length) continue;
            for (let i = 0; i < stroke.points.length; i++) {
                const pt = stroke.points[i];
                this.drawOnCanvas(pt, i === 0, stroke);
            }
            this.ctx.closePath();
        }
    }

    undoLastStroke() {
        if (this.strokes.length > 0) {
            this.strokes.pop();
            this.redrawAllStrokes();
        }
    }
}

// WebSocket Manager
class WebSocketManager {
    /**
     * @param {string} url
     * @param {string} roomId
     * @param {string} playerId
     * @param {Function} onMessage
     */
    constructor(url, roomId, playerId, onMessage) {
        this.url = url;
        this.roomId = roomId;
        this.playerId = playerId;
        this.onMessage = onMessage;
        this.ws = null;
        this.connect();
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('Connected to server');
            // this.joinRoom();
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.onMessage(message);
        };

        this.ws.onclose = () => {
            console.log('Disconnected from server');
            setTimeout(() => this.connect(), 3000);
        };
    }

    /**
     * @param {WebSocketMessage} message
     */
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const fullMessage = {
                ...message,
                roomId: this.roomId,
                playerId: this.playerId,
                timestamp: Date.now()
            };
            this.ws.send(JSON.stringify(fullMessage));
        }
    }

    joinRoom() {
        // Temporarily disabled due to backend issues
        /*
        this.sendMessage({
            type: MESSAGE_TYPES.JOIN_ROOM,
            data: {
                playerName: 'Player_' + this.playerId.substr(-4),
                avatar: '🎨'
            }
        });
        */
    }

    sendDrawStart(x, y, color, brushSize, tool) {
        this.sendMessage({
            type: MESSAGE_TYPES.DRAW_START,
            data: { x, y, color, brushSize, tool }
        });
    }

    sendDrawMove(points) {
        this.sendMessage({
            type: MESSAGE_TYPES.DRAW_MOVE,
            data: { points }
        });
    }

    sendDrawEnd() {
        this.sendMessage({
            type: MESSAGE_TYPES.DRAW_END,
            data: {}
        });
    }

    sendClearCanvas() {
        this.sendMessage({
            type: MESSAGE_TYPES.CLEAR_CANVAS,
            data: {}
        });
    }

    sendChatMessage(text, isGuess) {
        this.sendMessage({
            type: MESSAGE_TYPES.CHAT_MESSAGE,
            data: { message: text, isGuess }
        });
    }

    sendUndoStroke() {
        this.sendMessage({
            type: MESSAGE_TYPES.UNDO_STROKE,
            data: {}
        });
    }
}

// Game Manager
class GameManager {
    /**
     * @param {CanvasManager} canvasManager
     * @param {WebSocketManager} wsManager
     */
    constructor(canvasManager, wsManager) {
        this.canvasManager = canvasManager;
        this.wsManager = wsManager;
        this.isDrawer = true;
        this.currentTool = 'pen';
        this.currentColor = '#000000';
        this.currentBrushSize = 5;
    }

    /**
     * @param {WebSocketMessage} message
     */
    handleMessage(message) {
        switch (message.type) {
            case MESSAGE_TYPES.DRAW_START:
                if (message.playerId !== this.wsManager.playerId) {
                    this.handleRemoteDrawStart(message.data);
                }
                break;
            case MESSAGE_TYPES.DRAW_MOVE:
                if (message.playerId !== this.wsManager.playerId) {
                    this.handleRemoteDrawMove(message.data.points);
                }
                break;
            case MESSAGE_TYPES.DRAW_END:
                if (message.playerId !== this.wsManager.playerId) {
                    this.handleRemoteDrawEnd();
                }
                break;
            case MESSAGE_TYPES.CLEAR_CANVAS:
                this.canvasManager.clearCanvas();
                break;
            case MESSAGE_TYPES.UNDO_STROKE:
                console.log('Remote undo stroke');
                this.canvasManager.undoLastStroke();
                break;
            case MESSAGE_TYPES.CHAT_MESSAGE:
                this.handleChatMessage(message.data, message.playerId);
                break;
        }
    }

    /**
     * @param {Point} pos
     */
    startDrawing(pos) {
        if (!this.isDrawer) return;
        this.canvasManager.startDrawing(pos, this.currentColor, this.currentBrushSize, this.currentTool);
        this.wsManager.sendDrawStart(pos.x, pos.y, this.currentColor, this.currentBrushSize, this.currentTool);
    }

    /**
     * @param {Point} pos
     */
    continueDrawing(pos) {
        if (!this.isDrawer) return;
        this.canvasManager.continueDrawing(pos);

        // Throttle sending points
        if (!this.drawThrottleTimeout) {
            this.drawThrottleTimeout = setTimeout(() => {
                if (this.canvasManager.currentStroke) {
                    this.wsManager.sendDrawMove(this.canvasManager.currentStroke.points.slice(-5));
                }
                this.drawThrottleTimeout = null;
            }, 16); // ~60fps
        }
    }

    stopDrawing() {
        if (!this.isDrawer) return;
        this.canvasManager.endDrawing();
        this.wsManager.sendDrawEnd();
    }

    handleRemoteDrawStart(data) {
        console.log('Remote draw start:', {
            position: { x: data.x, y: data.y },
            color: data.color,
            brushSize: data.brushSize,
            tool: data.tool
        });
        this.canvasManager.startDrawing(
            { x: data.x, y: data.y },
            data.color,
            data.brushSize,
            data.tool
        );
    }

    handleRemoteDrawMove(points) {
        console.log('Remote draw move:', {
            points: points,
            numberOfPoints: points.length
        });
        points.forEach(point => {
            this.canvasManager.continueDrawing(point);
        });
    }

    handleRemoteDrawEnd() {
        console.log('Remote draw end');
        this.canvasManager.endDrawing();
    }

    handleChatMessage(data, playerId) {
        const chatMessages = document.getElementById('chatMessages');
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-message';
        if (data.isGuess) {
            msgEl.classList.add('guess');
        }
        msgEl.innerHTML = `<strong>Player:</strong>${data.message}`;
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    sendChatMessage(text) {
        const isGuess = text.length <= 20 && !/[. !?]/.test(text);
        this.wsManager.sendChatMessage(text, isGuess);
    }
}

// UI Manager
class UIManager {
    /**
     * @param {GameManager} gameManager
     */
    constructor(gameManager) {
        this.gameManager = gameManager;
        this.setupUI();
    }

    setupUI() {
        this.setupToolSelection();
        this.setupColorSelection();
        this.setupBrushSize();
        this.setupUndoClear();
        this.setupChat();
    }

    setupToolSelection() {
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.tool-btn.active').classList.remove('active');
                e.target.classList.add('active');
                this.gameManager.currentTool = e.target.dataset.tool;
            });
        });
    }

    setupColorSelection() {
        document.querySelectorAll('[data-color]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.color-btn.active').classList.remove('active');
                e.target.classList.add('active');
                this.gameManager.currentColor = e.target.dataset.color;
            });
        });
    }

    setupBrushSize() {
        const brushSize = document.getElementById('brushSize');
        const sizeDisplay = document.getElementById('sizeDisplay');
        brushSize.addEventListener('input', (e) => {
            this.gameManager.currentBrushSize = parseInt(e.target.value);
            sizeDisplay.textContent = this.gameManager.currentBrushSize + 'px';
        });
    }

    setupUndoClear() {
        const btnUndo = document.querySelector("#button-undo");
        btnUndo.addEventListener('click', () => {
            this.gameManager.canvasManager.undoLastStroke();
            this.gameManager.wsManager.sendUndoStroke();
        });

        const btnClear = document.querySelector("#button-clear");
        btnClear.addEventListener('click', () => {
            this.gameManager.canvasManager.clearCanvas();
            this.gameManager.wsManager.sendClearCanvas();
        });
    }

    setupChat() {
        const chatInput = document.getElementById('chatInput');
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                this.gameManager.sendChatMessage(e.target.value.trim());
                e.target.value = '';
            }
        });
    }
}

// Main Application
class ScribbleClient {
    constructor() {
        const canvas = document.querySelector('#drawingCanvas');
        this.canvasManager = new CanvasManager(canvas);
        this.wsManager = new WebSocketManager(
            'ws://localhost:8080/ws',
            'room_demo',
            'player_' + Math.random().toString(36).substr(2, 9),
            (message) => this.gameManager.handleMessage(message)
        );
        this.gameManager = new GameManager(this.canvasManager, this.wsManager);
        this.uiManager = new UIManager(this.gameManager);

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvasManager.canvas.addEventListener('mousedown', (e) => {
            const pos = this.getMousePos(e);
            this.gameManager.startDrawing(pos);
        });

        this.canvasManager.canvas.addEventListener('mousemove', (e) => {
            const pos = this.getMousePos(e);
            this.gameManager.continueDrawing(pos);
        });

        this.canvasManager.canvas.addEventListener('mouseup', () => {
            this.gameManager.stopDrawing();
        });

        this.canvasManager.canvas.addEventListener('mouseout', () => {
            this.gameManager.stopDrawing();
        });

        // Touch support
        this.setupTouchEvents();
    }

    setupTouchEvents() {
        const canvas = this.canvasManager.canvas;

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const pos = this.getMousePos(touch);
            this.gameManager.startDrawing(pos);
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const pos = this.getMousePos(touch);
            this.gameManager.continueDrawing(pos);
        });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.gameManager.stopDrawing();
        });
    }

    /**
     * @param {MouseEvent|Touch} e
     * @returns {Point}
     */
    getMousePos(e) {
        const rect = this.canvasManager.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left),
            y: (e.clientY - rect.top)
        };
    }
}

// Initialize application
let game;
window.addEventListener('load', () => {
    game = new ScribbleClient();
});
