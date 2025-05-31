// SCRIBBLE.IO CLIENT IMPLEMENTATION
// =============================================

class ScribbleClient {
    constructor() {
        this.ws = null;
        // s1
        this.canvas = document.querySelector('#drawingCanvas');
        // s2
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        // this.isDrawer = false;
        this.isDrawer = true;
        this.currentTool = 'pen';
        this.currentColor = '#000000';
        this.currentBrushSize = 5;
        this.roomId = 'room_demo';
        this.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
        this.drawingPath = [];
        this.strokes = []; // Thêm mảng lưu các strokes

        this.setupCanvas();
        this.setupUI();
        // this.connectWebSocket();
    }

    connectWebSocket() {
        // Replace with your Go WebSocket server URL
        this.ws = new WebSocket('ws://localhost:8080/ws');

        this.ws.onopen = () => {
            console.log('Connected to server');
            this.joinRoom();
        }

            ;

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        }

            ;

        this.ws.onclose = () => {
            console.log('Disconnected from server');
            setTimeout(() => this.connectWebSocket(), 3000);
        }

            ;
    }

    setupCanvas() {
        // High DPI support
        const rect = this.canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        // s1
        this.canvas.width = rect.width * ratio;
        this.canvas.height = rect.height * ratio;
        // s2
        this.ctx.scale(ratio, ratio);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        // Drawing event listeners
        // s3
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];

            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];

            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();

            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
    }

    setupUI() {

        // Tool selection
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.tool-btn.active').classList.remove('active');
                e.target.classList.add('active');
                this.currentTool = e.target.dataset.tool;
            });
        });

        // Color selection
        document.querySelectorAll('[data-color]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.color-btn.active').classList.remove('active');
                e.target.classList.add('active');
                this.currentColor = e.target.dataset.color;
            });
        });

        // Brush size
        const brushSize = document.getElementById('brushSize');
        const sizeDisplay = document.getElementById('sizeDisplay');

        brushSize.addEventListener('input', (e) => {
            this.currentBrushSize = parseInt(e.target.value);
            sizeDisplay.textContent = this.currentBrushSize + 'px';
        });

        // Chat input
        const chatInput = document.getElementById('chatInput');

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                this.sendMessage(e.target.value.trim());
                e.target.value = '';
            }
        });

        // s7
        const btnUndoE = document.querySelector("#button-undo")
        btnUndoE.addEventListener('click', (e) => {
            this.undoLastStroke();
        });

        const btnClearE = document.querySelector("#button-clear")
        btnClearE.addEventListener('click', (e) => this.clearCanvas());
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // const ratio = window.devicePixelRatio || 1

        return {
            x: (e.clientX - rect.left),
            y: (e.clientY - rect.top)
        };
    }

    startDrawing(e) {
        console.log(e)
        if (!this.isDrawer) return;

        // s4
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.drawingPath = [pos];

        // comment
        // this.sendWebSocketMessage({

        //     type: 'DRAW_START',
        //     data: {
        //         x: pos.x,
        //         y: pos.y,
        //         color: this.currentColor,
        //         brushSize: this.currentBrushSize,
        //         tool: this.currentTool
        //     }
        // });

        this.drawOnCanvas(pos.x, pos.y, true);
        // s4
        // Tạo stroke mới
        this.currentStroke = {
            color: this.currentColor,
            brushSize: this.currentBrushSize,
            tool: this.currentTool,
            points: [pos]
        };
        this.strokes.push(this.currentStroke);
        this.drawOnCanvas(pos.x, pos.y, true, this.currentStroke);
        e.preventDefault()
    }

    draw(e) {
        // s5
        if (!this.isDrawing || !this.isDrawer) return;

        const pos = this.getMousePos(e);
        this.drawingPath.push(pos);

        // Throttle sending to server (every 16ms ≈ 60fps)
        // if (!this.drawThrottleTimeout) {
        //     this.drawThrottleTimeout = setTimeout(() => {
        //         if (this.drawingPath.length > 1) {
        //             this.sendWebSocketMessage({

        //                 type: 'DRAW_PATH',
        //                 data: {
        //                     points: this.drawingPath.slice(-5) // Send last 5 points
        //                 }
        //             });
        //         }

        //         this.drawThrottleTimeout = null;
        //     }

        //         , 16);
        // }

        this.drawOnCanvas(pos.x, pos.y, false);
        // Thêm điểm vào stroke hiện tại
        if (this.currentStroke) {
            this.currentStroke.points.push(pos);
        }
        this.drawOnCanvas(pos.x, pos.y, false, this.currentStroke);
        e.preventDefault()
    }

    stopDrawing() {
        // s6
        if (!this.isDrawing || !this.isDrawer) return;

        this.isDrawing = false;

        // this.sendWebSocketMessage({

        //     type: 'DRAW_END',
        //     data: {}
        // });
        this.currentStroke = null;
    }

    drawOnCanvas(x, y, isStart, stroke) {
        // Nếu có stroke truyền vào thì dùng thuộc tính của stroke, không thì dùng thuộc tính hiện tại
        const color = stroke ? (stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color) : (this.currentTool === 'eraser' ? '#FFFFFF' : this.currentColor);
        const brushSize = stroke ? stroke.brushSize : this.currentBrushSize;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = brushSize;
        this.ctx.strokeStyle = color;

        if (isStart) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
        } else {
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
        }
    }

    // Handle incoming WebSocket messages
    handleMessage(message) {
        switch (message.type) {
            case 'ROUND_START':
                this.isDrawer = (message.data.drawerId === this.playerId);
                this.updateGameInfo(message.data);
                break;

            case 'DRAWER_WORD': if (this.isDrawer) {
                this.showWordSelection(message.data.alternatives);
            }

                break;

            case 'DRAW_START': if (message.playerId !== this.playerId) {
                this.remoteDrawStart(message.data);
            }

                break;

            case 'DRAW_PATH': if (message.playerId !== this.playerId) {
                this.remoteDrawPath(message.data.points);
            }

                break;

            case 'CLEAR_CANVAS': this.clearCanvas();
                break;

            case 'CHAT_MESSAGE': this.addChatMessage(message.data, message.playerId);
                break;

            case 'CORRECT_GUESS': this.showCorrectGuess(message.data);
                break;
        }
    }

    // Send messages to server
    sendWebSocketMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const fullMessage = {
                ...message,
                roomId: this.roomId,
                playerId: this.playerId,
                timestamp: Date.now()
            }

                ;
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

    sendMessage(text) {
        this.sendWebSocketMessage({

            type: 'CHAT_MESSAGE',
            data: {
                message: text,
                isGuess: this.isLikelyGuess(text)
            }
        });
    }

    isLikelyGuess(text) {
        // Simple heuristic to detect if message is a guess
        return text.length <= 20 && !/[. !?]/.test(text);
    }

    // UI update methods
    updateGameInfo(data) {
        document.getElementById('wordDisplay').textContent = data.wordHint || '_ _ _ _ _';
        this.startTimer(data.timeLimit || 80);
    }

    startTimer(seconds) {
        const timerEl = document.getElementById('timer');

        const interval = setInterval(() => {
            timerEl.textContent = seconds + 's';
            seconds--;

            if (seconds < 0) {
                clearInterval(interval);
                timerEl.textContent = '0s';
            }
        }

            , 1000);
    }

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

    selectWord(word) {
        document.getElementById('wordSelection').style.display = 'none';

        this.sendWebSocketMessage({

            type: 'WORD_SELECTED',
            data: {
                selectedWord: word
            }
        });
    }

    addChatMessage(data, playerId) {
        const chatMessages = document.getElementById('chatMessages');
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-message';

        if (data.isGuess) {
            msgEl.classList.add('guess');
        }

        msgEl.innerHTML = `<strong>Player:</strong>$ {
                data.message
            }

            `;
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    remoteDrawStart(data) {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = data.brushSize;
        this.ctx.strokeStyle = data.tool === 'eraser' ? '#FFFFFF' : data.color;
        this.ctx.beginPath();
        this.ctx.moveTo(data.x, data.y);
    }

    remoteDrawPath(points) {
        points.forEach(point => {
            this.ctx.lineTo(point.x, point.y);
            this.ctx.stroke();
        });
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Hàm vẽ lại toàn bộ strokes
    redrawAllStrokes() {
        this.clearCanvas();
        for (const stroke of this.strokes) {
            if (!stroke.points.length) continue;
            for (let i = 0; i < stroke.points.length; i++) {
                const pt = stroke.points[i];
                this.drawOnCanvas(pt.x, pt.y, i === 0, stroke);
            }
            this.ctx.closePath();
        }
    }

    // Hàm undo
    undoLastStroke() {
        if (this.strokes.length > 0) {
            this.strokes.pop();
            this.redrawAllStrokes();
        }
    }
}

// Global functions for UI buttons
function clearCanvas() {
    game.sendWebSocketMessage({
        type: 'CLEAR_CANVAS', data: {}
    });
}

function undoLast() {
    game.sendWebSocketMessage({
        type: 'UNDO_STROKE', data: {}
    });
}

function selectWord(word) {
    game.selectWord(word);
}

// Initialize game when page loads
let game;

window.addEventListener('load', () => {
    game = new ScribbleClient();
});