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

// Message Types cho việc vẽ
const DRAW_MESSAGES = {
    START: 'DRAW_START',    // Bắt đầu vẽ
    MOVE: 'DRAW_MOVE',      // Di chuyển bút vẽ
    END: 'DRAW_END',        // Kết thúc vẽ
    CLEAR: 'CLEAR_CANVAS'   // Xóa canvas
};

// Cấu trúc message đơn giản
const createDrawMessage = (type, data) => ({
    type,
    data: {
        ...data,
        timestamp: Date.now()
    }
});

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

        // Khởi tạo WebSocket
        this.ws = new DrawingWebSocket('ws://localhost:8080/ws');

        // Gán các callback functions
        this.ws.onDrawStart = this.handleRemoteDrawStart.bind(this);
        this.ws.onDrawMove = this.handleRemoteDrawMove.bind(this);
        this.ws.onDrawEnd = this.handleRemoteDrawEnd.bind(this);
        this.ws.onClearCanvas = this.handleRemoteClearCanvas.bind(this);

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

        // Gửi message bắt đầu vẽ
        this.ws.sendDrawStart(pos.x, pos.y, color, brushSize);
    }

    /**
     * @param {Point} pos
     */
    continueDrawing(pos) {
        if (this.currentStroke) {
            this.currentStroke.points.push(pos);
            this.drawOnCanvas(pos, false, this.currentStroke);

            // Gửi message di chuyển bút vẽ
            // Throttle để tránh gửi quá nhiều message
            if (!this.drawThrottleTimeout) {
                this.drawThrottleTimeout = setTimeout(() => {
                    this.ws.sendDrawMove(this.currentStroke.points.slice(-5));
                    this.drawThrottleTimeout = null;
                }, 16); // ~60fps
            }
        }
    }

    endDrawing() {
        if (this.currentStroke) {
            this.currentStroke = null;
            // Gửi message kết thúc vẽ
            this.ws.sendDrawEnd();
        }
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

    // Xử lý vẽ remote
    handleRemoteDrawStart(data) {
        this.currentStroke = {
            color: data.color,
            brushSize: data.brushSize,
            points: [{ x: data.x, y: data.y }]
        };
        this.strokes.push(this.currentStroke);
        this.drawOnCanvas(data.x, data.y, true, this.currentStroke);
    }

    handleRemoteDrawMove(data) {
        if (this.currentStroke) {
            data.points.forEach(point => {
                this.currentStroke.points.push(point);
                this.drawOnCanvas(point.x, point.y, false, this.currentStroke);
            });
        }
    }

    handleRemoteDrawEnd() {
        this.currentStroke = null;
    }

    handleRemoteClearCanvas() {
        this.clearCanvas();
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
            this.joinRoom();
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
    sendWebSocketMessage(message) {
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
        this.sendWebSocketMessage({
            type: 'JOIN_ROOM',
            data: {
                playerName: 'Player_' + this.playerId.substr(-4),
                avatar: '🎨'
            }
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
        this.timerInterval = null;
    }

    /**
     * @param {WebSocketMessage} message
     */
    handleMessage(message) {
        switch (message.type) {
            case 'ROUND_START':
                this.isDrawer = (message.data.drawerId === this.wsManager.playerId);
                this.updateGameInfo(message.data);
                break;
            case 'DRAWER_WORD':
                if (this.isDrawer) {
                    this.showWordSelection(message.data.alternatives);
                }
                break;
            case 'DRAW_START':
                if (message.playerId !== this.wsManager.playerId) {
                    this.remoteDrawStart(message.data);
                }
                break;
            case 'DRAW_PATH':
                if (message.playerId !== this.wsManager.playerId) {
                    this.remoteDrawPath(message.data.points);
                }
                break;
            case 'CLEAR_CANVAS':
                this.canvasManager.clearCanvas();
                break;
            case 'CHAT_MESSAGE':
                this.addChatMessage(message.data, message.playerId);
                break;
            case 'CORRECT_GUESS':
                this.showCorrectGuess(message.data);
                break;
        }
    }

    /**
     * @param {Point} pos
     */
    startDrawing(pos) {
        if (!this.isDrawer) return;
        this.canvasManager.startDrawing(pos, this.currentColor, this.currentBrushSize, this.currentTool);
    }

    /**
     * @param {Point} pos
     */
    continueDrawing(pos) {
        if (!this.isDrawer) return;
        this.canvasManager.continueDrawing(pos);
    }

    stopDrawing() {
        if (!this.isDrawer) return;
        this.canvasManager.endDrawing();
    }

    /**
     * @param {string} text
     */
    sendChatMessage(text) {
        this.wsManager.sendWebSocketMessage({
            type: 'CHAT_MESSAGE',
            data: {
                message: text,
                isGuess: this.isLikelyGuess(text)
            }
        });
    }

    /**
     * @param {string} text
     * @returns {boolean}
     */
    isLikelyGuess(text) {
        return text.length <= 20 && !/[. !?]/.test(text);
    }

    /**
     * @param {Object} data
     */
    updateGameInfo(data) {
        document.getElementById('wordDisplay').textContent = data.wordHint || '_ _ _ _ _';
        this.startTimer(data.timeLimit || 80);
    }

    /**
     * @param {number} seconds
     */
    startTimer(seconds) {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        const timerEl = document.getElementById('timer');
        this.timerInterval = setInterval(() => {
            timerEl.textContent = seconds + 's';
            seconds--;
            if (seconds < 0) {
                clearInterval(this.timerInterval);
                timerEl.textContent = '0s';
            }
        }, 1000);
    }

    /**
     * @param {string[]} words
     */
    showWordSelection(words) {
        const modal = document.getElementById('wordSelection');
        const options = modal.querySelector('.word-options');
        options.innerHTML = '';
        words.forEach(word => {
            const btn = document.createElement('button');
            btn.className = 'word-option';
            btn.textContent = word;
            btn.onclick = () => this.selectWord(word);
            options.appendChild(btn);
        });
        modal.style.display = 'block';
    }

    /**
     * @param {string} word
     */
    selectWord(word) {
        document.getElementById('wordSelection').style.display = 'none';
        this.wsManager.sendWebSocketMessage({
            type: 'WORD_SELECTED',
            data: {
                selectedWord: word
            }
        });
    }

    /**
     * @param {Object} data
     * @param {string} playerId
     */
    addChatMessage(data, playerId) {
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

    /**
     * @param {Object} data
     */
    showCorrectGuess(data) {
        const chatMessages = document.getElementById('chatMessages');
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-message correct-guess';
        msgEl.innerHTML = `<strong>${data.playerName}</strong> guessed correctly!`;
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * @param {Object} data
     */
    remoteDrawStart(data) {
        this.canvasManager.startDrawing(
            { x: data.x, y: data.y },
            data.color,
            data.brushSize,
            data.tool
        );
    }

    /**
     * @param {Point[]} points
     */
    remoteDrawPath(points) {
        points.forEach(point => {
            this.canvasManager.continueDrawing(point);
        });
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
        btnUndo.addEventListener('click', () => this.gameManager.canvasManager.undoLastStroke());

        const btnClear = document.querySelector("#button-clear");
        btnClear.addEventListener('click', () => this.gameManager.canvasManager.clearCanvas());
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
