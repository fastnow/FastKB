// ==UserScript==
// @name         FastKB 网页虚拟键盘插件
// @namespace    https://github.com/fastnow
// @version      1.2.4
// @description   可自由布局、双击编辑的网页虚拟键盘。支持宏、连发、手势、多配置等20+功能，完美适配触摸屏与桌面
// @author       FastNow Studio
// @match        *://*/*
// @icon         https://fastly.jsdelivr.net/gh/fastnow/FastKB@main/assets/icon.jpg
// @updateURL    https://gh-proxy.org/https://raw.githubusercontent.com/fastnow/FastKB/main/userscript/fastkb.user.js
// @downloadURL  https://gh-proxy.org/https://raw.githubusercontent.com/fastnow/FastKB/main/userscript/fastkb.user.js
// @license      MIT
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'gamepad_final_v15';
    const DEFAULT_PROFILE = {
        buttons: [
            { id: 'w', text: 'W', key: 'w', code: 'KeyW', type: 'action', left: 50, top: 150, width: 65, height: 65, bg: 'rgba(255,255,255,0.15)', pressedBg: 'rgba(255,255,255,0.4)', opacity: 1.0, locked: false },
            { id: 'a', text: 'A', key: 'a', code: 'KeyA', type: 'action', left: 0, top: 220, width: 65, height: 65, bg: 'rgba(255,255,255,0.15)', pressedBg: 'rgba(255,255,255,0.4)', opacity: 1.0, locked: false },
            { id: 's', text: 'S', key: 's', code: 'KeyS', type: 'action', left: 70, top: 220, width: 65, height: 65, bg: 'rgba(255,255,255,0.15)', pressedBg: 'rgba(255,255,255,0.4)', opacity: 1.0, locked: false },
            { id: 'd', text: 'D', key: 'd', code: 'KeyD', type: 'action', left: 140, top: 220, width: 65, height: 65, bg: 'rgba(255,255,255,0.15)', pressedBg: 'rgba(255,255,255,0.4)', opacity: 1.0, locked: false },
            { id: 'up', text: '↑', key: 'ArrowUp', code: 'ArrowUp', type: 'dpad', left: 400, top: 150, width: 65, height: 65, bg: 'rgba(255,255,255,0.15)', pressedBg: 'rgba(255,255,255,0.4)', opacity: 1.0, locked: false },
            { id: 'left', text: '←', key: 'ArrowLeft', code: 'ArrowLeft', type: 'dpad', left: 330, top: 220, width: 65, height: 65, bg: 'rgba(255,255,255,0.15)', pressedBg: 'rgba(255,255,255,0.4)', opacity: 1.0, locked: false },
            { id: 'down', text: '↓', key: 'ArrowDown', code: 'ArrowDown', type: 'dpad', left: 400, top: 220, width: 65, height: 65, bg: 'rgba(255,255,255,0.15)', pressedBg: 'rgba(255,255,255,0.4)', opacity: 1.0, locked: false },
            { id: 'right', text: '→', key: 'ArrowRight', code: 'ArrowRight', type: 'dpad', left: 470, top: 220, width: 65, height: 65, bg: 'rgba(255,255,255,0.15)', pressedBg: 'rgba(255,255,255,0.4)', opacity: 1.0, locked: false },
            { id: 'space', text: '␣', key: ' ', code: 'Space', type: 'action', left: 600, top: 180, width: 65, height: 65, bg: 'rgba(255,255,255,0.15)', pressedBg: 'rgba(255,255,255,0.4)', opacity: 1.0, locked: false },
            { id: 'esc', text: '⎋', key: 'Escape', code: 'Escape', type: 'action', left: 680, top: 180, width: 65, height: 65, bg: 'rgba(255,255,255,0.15)', pressedBg: 'rgba(255,255,255,0.4)', opacity: 1.0, locked: false }
        ],
        barColor: '#ff4444',
        barWidth: 100,
        barHeight: 12,
        barPosition: 50,
        barOffset: 0,
        editMode: false,
        soundEnabled: true,
        turboEnabled: false,
        turboCPS: 10,
        turboRandom: 30,
        snapToEdge: false,
        snapAlign: false,
        alignThreshold: 20,
        macroPlayInterval: 100,
        macroLoopEnabled: false,
        blockKeys: false,
        quickSwitchKey: 'F5',
        doubleClickSpeed: 300,
        longPressTime: 500,
        gameMode: false,
        theme: 'dark'
    };

    let config = {
        activeProfile: '默认',
        profiles: { '默认': JSON.parse(JSON.stringify(DEFAULT_PROFILE)) }
    };

    try {
        const saved = GM_getValue(STORAGE_KEY, '{}');
        if (saved && saved !== '{}') {
            const loaded = JSON.parse(saved);
            if (loaded.profiles) config = loaded;
            else config.profiles['默认'] = loaded;
        }
    } catch(e) { console.warn('配置加载失败', e); }

    let activeConfig = config.profiles[config.activeProfile] || config.profiles['默认'];

    const pressCount = {};
    let activeMouseKey = null;
    let settingsVisible = false;
    let animationFrame = null;
    let turboIntervals = {};
    let currentEditingButtonId = null;
    let buttonEditor = null;
    let connectorLine = null;
    let lastClickTime = 0;
    let lastClickButtonId = null;
    let macroRecording = false;
    let macroSteps = [];
    let macroPlaying = false;
    let macroLoop = false;
    let longPressTimer = null;
    let macroPlayTimer = null;
    let editorOpen = false; // 全局标志：编辑栏是否打开

    function saveConfig() { GM_setValue(STORAGE_KEY, JSON.stringify(config)); }
    function saveActiveProfile() {
        config.profiles[config.activeProfile] = JSON.parse(JSON.stringify(activeConfig));
        saveConfig();
    }

    function getKeyCode(key) {
        if (key.length === 1 && key.match(/[a-zA-Z]/)) {
            return 'Key' + key.toUpperCase();
        }
        const map = {
            ' ': 'Space',
            'ArrowUp': 'ArrowUp',
            'ArrowDown': 'ArrowDown',
            'ArrowLeft': 'ArrowLeft',
            'ArrowRight': 'ArrowRight',
            'Escape': 'Escape',
            'Shift': 'ShiftLeft',
            'Control': 'ControlLeft',
            'Alt': 'AltLeft',
            'Enter': 'Enter',
            'Tab': 'Tab',
            'Backspace': 'Backspace',
            'Delete': 'Delete',
            'Insert': 'Insert',
            'Home': 'Home',
            'End': 'End',
            'PageUp': 'PageUp',
            'PageDown': 'PageDown'
        };
        return map[key] || key;
    }

    function sendKey(eventType, key, code) {
        const keyCodeMap = { 'ArrowUp':38,'ArrowDown':40,'ArrowLeft':37,'ArrowRight':39,' ':32,'Escape':27 };
        const keyCode = keyCodeMap[key] || (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
        document.dispatchEvent(new KeyboardEvent(eventType, {
            key, code, keyCode, which: keyCode, bubbles: true, cancelable: true
        }));
    }

    function beep() {
        if (!activeConfig.soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContext();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().then(() => playBeep(audioCtx));
            } else playBeep(audioCtx);
        } catch(e) {}
    }
    function playBeep(audioCtx) {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    }

    function getRandomTurboInterval() {
        const base = 1000 / activeConfig.turboCPS;
        if (!activeConfig.turboRandom) return base;
        const range = activeConfig.turboRandom;
        return base + Math.floor(Math.random() * range * 2) - range;
    }

    function alignButtonPosition(btnConfig, newLeft, newTop, excludeId) {
        if (!activeConfig.snapAlign) return { left: newLeft, top: newTop };
        const threshold = activeConfig.alignThreshold;
        let alignedLeft = newLeft;
        let alignedTop = newTop;

        activeConfig.buttons.forEach(other => {
            if (other.id === excludeId) return;
            if (Math.abs(newLeft - other.left) < threshold) alignedLeft = other.left;
            if (Math.abs(newLeft - (other.left + other.width)) < threshold) alignedLeft = other.left + other.width;
            if (Math.abs((newLeft + btnConfig.width) - other.left) < threshold) alignedLeft = other.left - btnConfig.width;
            if (Math.abs((newLeft + btnConfig.width) - (other.left + other.width)) < threshold) alignedLeft = other.left + other.width - btnConfig.width;

            if (Math.abs(newTop - other.top) < threshold) alignedTop = other.top;
            if (Math.abs(newTop - (other.top + other.height)) < threshold) alignedTop = other.top + other.height;
            if (Math.abs((newTop + btnConfig.height) - other.top) < threshold) alignedTop = other.top - btnConfig.height;
            if (Math.abs((newTop + btnConfig.height) - (other.top + other.height)) < threshold) alignedTop = other.top + other.height - btnConfig.height;
        });

        if (activeConfig.snapToEdge) {
            const snap = 20;
            if (alignedLeft < snap) alignedLeft = 0;
            if (alignedTop < snap) alignedTop = 0;
            if (alignedLeft > window.innerWidth - btnConfig.width - snap) alignedLeft = window.innerWidth - btnConfig.width;
            if (alignedTop > window.innerHeight - btnConfig.height - snap) alignedTop = window.innerHeight - btnConfig.height;
        }

        return { left: alignedLeft, top: alignedTop };
    }

    function createButtonElement(btnConfig) {
        const btn = document.createElement('div');
        btn.className = 'gamepad-btn';
        btn.dataset.id = btnConfig.id;
        btn.dataset.key = btnConfig.key;
        btn.dataset.code = btnConfig.code;
        btn.dataset.locked = btnConfig.locked ? 'true' : 'false';
        btn.dataset.editing = 'false';
        btn.textContent = btnConfig.text;
        btn.style.cssText = `
            position: fixed;
            left: ${btnConfig.left}px;
            top: ${btnConfig.top}px;
            width: ${btnConfig.width}px;
            height: ${btnConfig.height}px;
            background: ${btnConfig.bg};
            border-radius: ${btnConfig.type === 'action' ? '12px' : '50%'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${Math.min(btnConfig.width, btnConfig.height) * 0.4}px;
            font-weight: 600;
            color: white;
            text-shadow: 0 2px 4px black;
            box-shadow: 0 4px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4);
            transition: transform 0.05s ease, background 0.05s ease;
            border: 1px solid rgba(255,255,255,0.15);
            cursor: ${activeConfig.editMode && !btnConfig.locked ? 'move' : 'pointer'};
            user-select: none;
            touch-action: none;
            opacity: ${btnConfig.opacity};
            pointer-events: auto;
            z-index: 10000;
        `;

        let dragging = false;
        let startX, startY, startLeft, startTop;

        function startDrag(e) {
            // 如果编辑栏打开，禁止所有按钮拖拽
            if (editorOpen) return;
            if (!activeConfig.editMode || btnConfig.locked) return;
            e.preventDefault();
            e.stopPropagation();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX; startY = clientY;
            startLeft = btnConfig.left; startTop = btnConfig.top;
            dragging = true;
            btn.style.cursor = 'grabbing';
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('touchmove', onDrag, { passive: false });
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchend', stopDrag);
        }

        function onDrag(e) {
            if (!dragging) return;
            // 如果编辑栏在拖拽过程中突然打开（极罕见），则停止
            if (editorOpen) {
                stopDrag();
                return;
            }
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            requestAnimationFrame(() => {
                let newLeft = startLeft + clientX - startX;
                let newTop = startTop + clientY - startY;
                const aligned = alignButtonPosition(btnConfig, newLeft, newTop, btnConfig.id);
                newLeft = aligned.left;
                newTop = aligned.top;

                btn.style.left = newLeft + 'px';
                btn.style.top = newTop + 'px';
                btnConfig.left = newLeft;
                btnConfig.top = newTop;
            });
        }

        function stopDrag() {
            if (dragging) {
                dragging = false;
                btn.style.cursor = activeConfig.editMode ? 'move' : 'pointer';
                saveActiveProfile();
            }
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('touchmove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchend', stopDrag);
        }

        btn.addEventListener('mousedown', startDrag);
        btn.addEventListener('touchstart', startDrag, { passive: false });

        function handleDoubleClick(e) {
            if (!activeConfig.editMode) return;
            e.preventDefault();
            e.stopPropagation();
            if (currentEditingButtonId === btnConfig.id) {
                hideButtonEditor();
            } else {
                showButtonEditor(btnConfig.id);
            }
        }
        btn.addEventListener('dblclick', handleDoubleClick);
        btn.addEventListener('touchend', (e) => {
            if (!activeConfig.editMode) return;
            const now = Date.now();
            if (lastClickButtonId === btnConfig.id && now - lastClickTime < activeConfig.doubleClickSpeed) {
                handleDoubleClick(e);
            }
            lastClickTime = now;
            lastClickButtonId = btnConfig.id;
        });

        function handleLongPress(e) {
            if (activeConfig.editMode || btnConfig.locked) return;
            e.preventDefault();
            beep();
        }
        btn.addEventListener('touchstart', (e) => {
            if (activeConfig.editMode) return;
            longPressTimer = setTimeout(() => handleLongPress(e), activeConfig.longPressTime);
        });
        btn.addEventListener('touchend', () => clearTimeout(longPressTimer));
        btn.addEventListener('touchcancel', () => clearTimeout(longPressTimer));

        function pressHandler(e) {
            if (activeConfig.editMode || btnConfig.locked) return;
            e.preventDefault();
            const key = btn.dataset.key, code = btn.dataset.code;
            if (!key) return;
            const current = pressCount[key] || 0;
            if (current === 0) {
                sendKey('keydown', key, code);
                btn.style.transform = 'scale(0.9)';
                btn.style.background = btnConfig.pressedBg;
                beep();

                if (activeConfig.turboEnabled) {
                    if (turboIntervals[key]) clearInterval(turboIntervals[key]);
                    const turbo = () => {
                        sendKey('keydown', key, code);
                        sendKey('keyup', key, code);
                    };
                    turbo();
                    const next = () => {
                        if (pressCount[key] > 0) {
                            turbo();
                            turboIntervals[key] = setTimeout(next, getRandomTurboInterval());
                        }
                    };
                    turboIntervals[key] = setTimeout(next, getRandomTurboInterval());
                }
            }
            pressCount[key] = current + 1;
        }

        function releaseHandler(e) {
            if (activeConfig.editMode || btnConfig.locked) return;
            e.preventDefault();
            const key = btn.dataset.key;
            if (!key || !(key in pressCount)) return;
            const newCount = pressCount[key] - 1;
            if (newCount <= 0) {
                delete pressCount[key];
                sendKey('keyup', key, btn.dataset.code);
                btn.style.transform = 'scale(1)';
                btn.style.background = btnConfig.bg;
                if (turboIntervals[key]) {
                    clearTimeout(turboIntervals[key]);
                    delete turboIntervals[key];
                }
            } else pressCount[key] = newCount;
        }

        btn.addEventListener('touchstart', pressHandler, { passive: false });
        btn.addEventListener('touchend', releaseHandler);
        btn.addEventListener('touchcancel', releaseHandler);
        btn.addEventListener('mousedown', (e) => {
            if (activeConfig.editMode || btnConfig.locked) return;
            e.preventDefault();
            if (activeMouseKey) {
                const old = document.querySelector(`[data-key="${activeMouseKey}"]`);
                if (old) { old.style.transform = 'scale(1)'; old.style.background = btnConfig.bg; }
                delete pressCount[activeMouseKey];
                sendKey('keyup', activeMouseKey, activeMouseKey === ' ' ? 'Space' : activeMouseKey);
            }
            pressHandler(e);
            activeMouseKey = btn.dataset.key;
            document.addEventListener('mouseup', () => {
                if (activeMouseKey) {
                    const b = document.querySelector(`[data-key="${activeMouseKey}"]`);
                    if (b) { b.style.transform = 'scale(1)'; b.style.background = btnConfig.bg; }
                    delete pressCount[activeMouseKey];
                    sendKey('keyup', activeMouseKey, activeMouseKey === ' ' ? 'Space' : activeMouseKey);
                    activeMouseKey = null;
                }
            }, { once: true });
        });

        return btn;
    }

    function showButtonEditor(buttonId) {
        hideButtonEditor();
        const btnConfig = activeConfig.buttons.find(b => b.id === buttonId);
        if (!btnConfig) return;
        currentEditingButtonId = buttonId;
        editorOpen = true; // 设置全局标志

        document.querySelectorAll('.gamepad-btn').forEach(btn => {
            btn.dataset.editing = 'true';
        });

        const editor = document.createElement('div');
        editor.id = 'button-editor';
        editor.style.cssText = `
            position: fixed;
            background: #333;
            color: white;
            padding: 16px;
            border-radius: 16px;
            box-shadow: 0 10px 20px black;
            border: 1px solid #555;
            z-index: 20001;
            min-width: 260px;
            font-family: system-ui;
            backdrop-filter: blur(8px);
            touch-action: none;
        `;

        editor.addEventListener('mousedown', (e) => e.stopPropagation());
        editor.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
        editor.addEventListener('keydown', (e) => e.stopPropagation(), true);
        editor.addEventListener('keyup', (e) => e.stopPropagation(), true);

        const titleBar = document.createElement('div');
        titleBar.style.cssText = `
            background: #444;
            margin: -16px -16px 12px -16px;
            padding: 8px 16px;
            border-radius: 16px 16px 0 0;
            font-weight: bold;
            text-align: center;
            cursor: move;
        `;
        titleBar.textContent = '编辑按钮';
        editor.appendChild(titleBar);

        let dragStartX, dragStartY, dragStartLeft, dragStartTop, dragging = false;
        function startDragEditor(e) {
            e.preventDefault();
            e.stopPropagation();
            const rect = editor.getBoundingClientRect();
            dragStartLeft = rect.left; dragStartTop = rect.top;
            dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
            dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
            dragging = true;
            document.addEventListener('mousemove', onDragEditor);
            document.addEventListener('touchmove', onDragEditor, { passive: false });
            document.addEventListener('mouseup', stopDragEditor);
            document.addEventListener('touchend', stopDragEditor);
        }
        function onDragEditor(e) {
            if (!dragging) return;
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            requestAnimationFrame(() => {
                editor.style.left = (dragStartLeft + clientX - dragStartX) + 'px';
                editor.style.top = (dragStartTop + clientY - dragStartY) + 'px';
                if (connectorLine) updateConnectorLine(buttonId, editor);
            });
        }
        function stopDragEditor() {
            dragging = false;
            document.removeEventListener('mousemove', onDragEditor);
            document.removeEventListener('touchmove', onDragEditor);
            document.removeEventListener('mouseup', stopDragEditor);
            document.removeEventListener('touchend', stopDragEditor);
        }
        titleBar.addEventListener('mousedown', startDragEditor);
        titleBar.addEventListener('touchstart', startDragEditor, { passive: false });

        const content = document.createElement('div');
        content.style.cssText = 'display:flex; flex-direction:column; gap:12px;';

        content.innerHTML = `
            <div style="border-bottom:1px solid #555; margin:4px 0; padding-bottom:4px;"><b>尺寸</b></div>
            <div style="display:flex; gap:8px;">
                <label>宽: <input type="range" min="30" max="200" value="${btnConfig.width}" id="editor-width" style="width:80px;"></label>
                <label>高: <input type="range" min="30" max="200" value="${btnConfig.height}" id="editor-height" style="width:80px;"></label>
            </div>
            <div style="border-bottom:1px solid #555; margin:4px 0; padding-bottom:4px;"><b>颜色</b></div>
            <div><label>背景色: <input type="color" id="editor-bg" value="${btnConfig.bg.startsWith('#') ? btnConfig.bg : '#ffffff'}"></label></div>
            <div><label>按下色: <input type="color" id="editor-pressedBg" value="${btnConfig.pressedBg.startsWith('#') ? btnConfig.pressedBg : '#ffffff'}"></label></div>
            <div><label>透明度: <input type="range" min="0.1" max="1" step="0.1" value="${btnConfig.opacity}" id="editor-opacity" style="width:100%;"></label></div>
            <div style="border-bottom:1px solid #555; margin:4px 0; padding-bottom:4px;"><b>外观</b></div>
            <div><label>圆角: <input type="range" min="0" max="50" value="${btnConfig.type === 'action' ? 12 : 50}" id="editor-radius" style="width:100%;"></label></div>
            <div style="border-bottom:1px solid #555; margin:4px 0; padding-bottom:4px;"><b>映射</b></div>
            <div><label>按键: <input type="text" id="editor-key" value="${btnConfig.key}" style="width:100%; background:#222; color:white; border:1px solid #555; padding:4px;"></label></div>
            <div><label>显示: <input type="text" id="editor-text" value="${btnConfig.text}" style="width:100%; background:#222; color:white; border:1px solid #555; padding:4px;"></label></div>
            <div style="border-bottom:1px solid #555; margin:4px 0; padding-bottom:4px;"><b>其他</b></div>
            <div><label><input type="checkbox" id="editor-locked" ${btnConfig.locked ? 'checked' : ''}> 锁定位置</label></div>
            <div style="display:flex; gap:8px; margin-top:8px;">
                <button id="editor-reset" style="flex:1; background:#FF9800; border:none; border-radius:8px; color:white; padding:6px;">恢复默认</button>
                <button id="editor-delete" style="flex:1; background:#f44336; border:none; border-radius:8px; color:white; padding:6px;">删除</button>
            </div>
            <div style="display:flex; gap:8px;">
                <button id="editor-close" style="flex:2; background:#2196F3; border:none; border-radius:8px; color:white; padding:8px;">关闭</button>
            </div>
        `;
        editor.appendChild(content);
        document.body.appendChild(editor);

        const btnElement = document.querySelector(`.gamepad-btn[data-id="${buttonId}"]`);
        if (btnElement) {
            const btnRect = btnElement.getBoundingClientRect();
            let left = btnRect.right + 20;
            let top = btnRect.top;
            if (left + editor.offsetWidth > window.innerWidth) left = btnRect.left - editor.offsetWidth - 20;
            if (top + editor.offsetHeight > window.innerHeight) top = window.innerHeight - editor.offsetHeight - 10;
            editor.style.left = left + 'px';
            editor.style.top = top + 'px';
        }

        const line = document.createElement('div');
        line.id = 'connector-line';
        line.style.cssText = `
            position: fixed;
            height: 2px;
            background: #ffaa00;
            transform-origin: left center;
            z-index: 20000;
            pointer-events: none;
            box-shadow: 0 0 4px #ffaa00;
        `;
        document.body.appendChild(line);
        connectorLine = line;
        updateConnectorLine(buttonId, editor);

        const inputs = editor.querySelectorAll('input, button');
        inputs.forEach(inp => inp.addEventListener('mousedown', (e) => e.stopPropagation()));
        inputs.forEach(inp => inp.addEventListener('touchstart', (e) => e.stopPropagation()));

        editor.querySelector('#editor-width').addEventListener('input', (e) => {
            btnConfig.width = +e.target.value;
            updateButtonElement(buttonId, { width: btnConfig.width });
            updateConnectorLine(buttonId, editor);
        });
        editor.querySelector('#editor-height').addEventListener('input', (e) => {
            btnConfig.height = +e.target.value;
            updateButtonElement(buttonId, { height: btnConfig.height });
            updateConnectorLine(buttonId, editor);
        });
        editor.querySelector('#editor-bg').addEventListener('input', (e) => {
            btnConfig.bg = e.target.value;
            updateButtonElement(buttonId, { bg: btnConfig.bg });
        });
        editor.querySelector('#editor-pressedBg').addEventListener('input', (e) => {
            btnConfig.pressedBg = e.target.value;
        });
        editor.querySelector('#editor-opacity').addEventListener('input', (e) => {
            btnConfig.opacity = +e.target.value;
            updateButtonElement(buttonId, { opacity: btnConfig.opacity });
        });
        editor.querySelector('#editor-radius').addEventListener('input', (e) => {
            const btnEl = document.querySelector(`.gamepad-btn[data-id="${buttonId}"]`);
            if (btnEl) btnEl.style.borderRadius = e.target.value + 'px';
        });
        editor.querySelector('#editor-key').addEventListener('input', (e) => {
            btnConfig.key = e.target.value;
            btnConfig.code = getKeyCode(btnConfig.key);
            updateButtonElement(buttonId, { key: btnConfig.key });
        });
        editor.querySelector('#editor-text').addEventListener('input', (e) => {
            btnConfig.text = e.target.value;
            const btnEl = document.querySelector(`.gamepad-btn[data-id="${buttonId}"]`);
            if (btnEl) btnEl.textContent = e.target.value;
        });
        editor.querySelector('#editor-locked').addEventListener('change', (e) => {
            btnConfig.locked = e.target.checked;
            updateButtonElement(buttonId, { locked: btnConfig.locked });
        });
        editor.querySelector('#editor-reset').addEventListener('click', (e) => {
            e.stopPropagation();
            const defaultBtn = DEFAULT_PROFILE.buttons.find(b => b.id === btnConfig.id);
            if (defaultBtn) {
                Object.assign(btnConfig, JSON.parse(JSON.stringify(defaultBtn)));
                updateButtonElement(buttonId, { width: btnConfig.width, height: btnConfig.height, bg: btnConfig.bg, key: btnConfig.key, locked: btnConfig.locked, opacity: btnConfig.opacity });
                const btnEl = document.querySelector(`.gamepad-btn[data-id="${buttonId}"]`);
                if (btnEl) {
                    btnEl.textContent = btnConfig.text;
                    btnEl.style.borderRadius = btnConfig.type === 'action' ? '12px' : '50%';
                }
                editor.querySelector('#editor-width').value = btnConfig.width;
                editor.querySelector('#editor-height').value = btnConfig.height;
                editor.querySelector('#editor-bg').value = btnConfig.bg.startsWith('#') ? btnConfig.bg : '#ffffff';
                editor.querySelector('#editor-pressedBg').value = btnConfig.pressedBg.startsWith('#') ? btnConfig.pressedBg : '#ffffff';
                editor.querySelector('#editor-opacity').value = btnConfig.opacity;
                editor.querySelector('#editor-radius').value = btnConfig.type === 'action' ? 12 : 50;
                editor.querySelector('#editor-key').value = btnConfig.key;
                editor.querySelector('#editor-text').value = btnConfig.text;
                editor.querySelector('#editor-locked').checked = btnConfig.locked;
            }
        });
        editor.querySelector('#editor-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            activeConfig.buttons = activeConfig.buttons.filter(b => b.id !== buttonId);
            saveActiveProfile();
            rebuildButtons();
            hideButtonEditor();
        });
        editor.querySelector('#editor-close').addEventListener('click', (e) => {
            e.stopPropagation();
            hideButtonEditor();
        });

        buttonEditor = editor;
    }

    function updateButtonElement(buttonId, props) {
        const btnEl = document.querySelector(`.gamepad-btn[data-id="${buttonId}"]`);
        if (!btnEl) return;
        if (props.width !== undefined) {
            btnEl.style.width = props.width + 'px';
            btnEl.style.fontSize = Math.min(props.width, props.height || props.width) * 0.4 + 'px';
        }
        if (props.height !== undefined) {
            btnEl.style.height = props.height + 'px';
            btnEl.style.fontSize = Math.min(props.width || props.height, props.height) * 0.4 + 'px';
        }
        if (props.bg !== undefined) btnEl.style.background = props.bg;
        if (props.key !== undefined) btnEl.dataset.key = props.key;
        if (props.opacity !== undefined) btnEl.style.opacity = props.opacity;
        if (props.locked !== undefined) {
            btnEl.dataset.locked = props.locked ? 'true' : 'false';
            btnEl.style.cursor = activeConfig.editMode && !props.locked ? 'move' : 'pointer';
        }
    }

    function updateConnectorLine(buttonId, editor) {
        if (!connectorLine) return;
        const btnEl = document.querySelector(`.gamepad-btn[data-id="${buttonId}"]`);
        if (!btnEl || !editor) return;
        const btnRect = btnEl.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        const btnCenter = { x: btnRect.left + btnRect.width/2, y: btnRect.top + btnRect.height/2 };
        const editorCenter = { x: editorRect.left + editorRect.width/2, y: editorRect.top + editorRect.height/2 };
        const dx = editorCenter.x - btnCenter.x;
        const dy = editorCenter.y - btnCenter.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        connectorLine.style.width = distance + 'px';
        connectorLine.style.left = btnCenter.x + 'px';
        connectorLine.style.top = btnCenter.y + 'px';
        connectorLine.style.transform = `rotate(${angle}deg)`;
    }

    function hideButtonEditor() {
        if (buttonEditor) buttonEditor.remove();
        if (connectorLine) connectorLine.remove();
        buttonEditor = null;
        connectorLine = null;
        document.querySelectorAll('.gamepad-btn').forEach(btn => {
            btn.dataset.editing = 'false';
        });
        currentEditingButtonId = null;
        editorOpen = false; // 重置全局标志
    }

    function rebuildButtons() {
        document.getElementById('gamepad-button-container')?.remove();
        const container = document.createElement('div');
        container.id = 'gamepad-button-container';
        activeConfig.buttons.forEach(btnConfig => {
            container.appendChild(createButtonElement(btnConfig));
        });
        document.body.appendChild(container);
    }

    function createControlBar() {
        const oldBar = document.getElementById('gamepad-control-bar');
        if (oldBar) oldBar.remove();

        const bar = document.createElement('div');
        bar.id = 'gamepad-control-bar';
        bar.style.cssText = `
            position: fixed; top: ${activeConfig.barOffset}px; left: ${activeConfig.barPosition}%;
            transform: translateX(-50%);
            width: ${activeConfig.barWidth}px; height: ${activeConfig.barHeight}px;
            background: ${activeConfig.barColor}; border-radius: 0 0 8px 8px;
            z-index: 10001; cursor: pointer; opacity: 0.7; transition: opacity 0.2s;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        `;
        bar.addEventListener('mouseenter', () => bar.style.opacity = '1');
        bar.addEventListener('mouseleave', () => bar.style.opacity = '0.7');
        bar.addEventListener('click', toggleSettings);
        document.body.appendChild(bar);
    }

    function toggleSettings() {
        if (settingsVisible) {
            document.getElementById('gamepad-settings')?.remove();
            settingsVisible = false;
        } else {
            showSettings();
        }
    }

    function showSettings() {
        if (settingsVisible) return;
        settingsVisible = true;
        hideButtonEditor();

        const panel = document.createElement('div');
        panel.id = 'gamepad-settings';
        panel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #2a2a2a; color: white;
            border-radius: 28px;
            z-index: 20000; width: 460px; max-height: 80vh;
            display: flex; flex-direction: column;
            box-shadow: 0 20px 40px black; border: 1px solid #444;
            font-family: system-ui; backdrop-filter: blur(10px);
            padding: 0;
        `;

        panel.addEventListener('keydown', (e) => e.stopPropagation(), true);
        panel.addEventListener('keyup', (e) => e.stopPropagation(), true);
        panel.addEventListener('mousedown', (e) => e.stopPropagation());
        panel.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });

        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'flex-shrink:0;';

        const titleBar = document.createElement('div');
        titleBar.style.cssText = `
            cursor: move;
            background: linear-gradient(145deg, #3a3a3a, #2a2a2a);
            padding: 16px 24px;
            border-radius: 28px 28px 0 0;
            font-weight: bold;
            text-align: center;
            user-select: none;
            color: #fff;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            box-shadow: inset 0 -1px 0 #555;
        `;
        titleBar.textContent = 'FastKB 设置';
        headerDiv.appendChild(titleBar);

        let dragStartX, dragStartY, dragStartLeft, dragStartTop, dragging = false;
        function startDrag(e) {
            e.preventDefault();
            e.stopPropagation();
            const rect = panel.getBoundingClientRect();
            dragStartLeft = rect.left; dragStartTop = rect.top;
            dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
            dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
            panel.style.transform = 'none';
            panel.style.left = dragStartLeft + 'px';
            panel.style.top = dragStartTop + 'px';
            dragging = true;
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('touchmove', onDrag, { passive: false });
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchend', stopDrag);
        }
        function onDrag(e) {
            if (!dragging) return;
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            requestAnimationFrame(() => {
                panel.style.left = (dragStartLeft + clientX - dragStartX) + 'px';
                panel.style.top = (dragStartTop + clientY - dragStartY) + 'px';
            });
        }
        function stopDrag() {
            dragging = false;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('touchmove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchend', stopDrag);
        }
        titleBar.addEventListener('mousedown', startDrag);
        titleBar.addEventListener('touchstart', startDrag, { passive: false });

        const tabs = ['常规', '按键', '连发', '宏', '高级', '配置', '帮助'];
        let currentTab = '常规';
        const tabContainer = document.createElement('div');
        tabContainer.style.cssText = 'display:flex; gap:6px; margin:16px 24px 20px 24px; flex-wrap:wrap;';
        tabs.forEach(tabName => {
            const tabBtn = document.createElement('button');
            tabBtn.textContent = tabName;
            tabBtn.dataset.tab = tabName;
            tabBtn.style.cssText = `
                flex:1; padding:8px 4px; background:${currentTab===tabName?'#4caf50':'#333'}; border:none;
                border-radius:20px; color:white; cursor:pointer; font-size:14px;
                box-shadow: ${currentTab===tabName?'0 2px 8px rgba(76,175,80,0.4)':'0 2px 4px rgba(0,0,0,0.3)'};
                transition: all 0.2s;
            `;
            tabBtn.addEventListener('click', () => {
                currentTab = tabName;
                tabContainer.querySelectorAll('button').forEach(btn => {
                    btn.style.background = btn.dataset.tab === currentTab ? '#4caf50' : '#333';
                    btn.style.boxShadow = btn.dataset.tab === currentTab ? '0 2px 8px rgba(76,175,80,0.4)' : '0 2px 4px rgba(0,0,0,0.3)';
                });
                renderContent();
            });
            tabContainer.appendChild(tabBtn);
        });
        headerDiv.appendChild(tabContainer);
        panel.appendChild(headerDiv);

        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = 'flex:1; overflow-y: auto; padding: 0 24px 24px 24px;';
        panel.appendChild(contentDiv);

        function renderContent() {
            contentDiv.innerHTML = '';
            if (currentTab === '常规') renderGeneral(contentDiv);
            else if (currentTab === '按键') renderKeySettings(contentDiv);
            else if (currentTab === '连发') renderTurbo(contentDiv);
            else if (currentTab === '宏') renderMacro(contentDiv);
            else if (currentTab === '高级') renderAdvanced(contentDiv);
            else if (currentTab === '配置') renderProfile(contentDiv);
            else if (currentTab === '帮助') renderHelp(contentDiv);
        }

        // ---------- 完整渲染函数 ----------
        function renderGeneral(container) {
            const group1 = document.createElement('div');
            group1.innerHTML = '<div style="font-size:14px; margin-bottom:8px; color:#aaa;">基础</div>';
            const items = [
                ['编辑模式', 'editMode'],
                ['按键声音', 'soundEnabled']
            ];
            items.forEach(([label, prop]) => {
                const div = document.createElement('div');
                div.style.marginBottom = '12px';
                div.innerHTML = `<label style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" id="${prop}" ${activeConfig[prop] ? 'checked' : ''}> <span>${label}</span>
                </label>`;
                group1.appendChild(div);
                div.querySelector('input').addEventListener('change', (e) => {
                    activeConfig[prop] = e.target.checked;
                    if (prop === 'editMode') {
                        document.querySelectorAll('.gamepad-btn').forEach(btn => {
                            const locked = btn.dataset.locked === 'true';
                            btn.style.cursor = activeConfig.editMode && !locked ? 'move' : 'pointer';
                        });
                        if (!activeConfig.editMode) hideButtonEditor();
                    }
                    saveActiveProfile();
                });
            });
            container.appendChild(group1);
            container.appendChild(document.createElement('hr')).style.cssText = 'border:0.5px solid #555; margin:16px 0;';

            const group2 = document.createElement('div');
            group2.innerHTML = '<div style="font-size:14px; margin-bottom:8px; color:#aaa;">对齐</div>';
            const alignItems = [
                ['边缘吸附', 'snapToEdge'],
                ['辅助对齐', 'snapAlign']
            ];
            alignItems.forEach(([label, prop]) => {
                const div = document.createElement('div');
                div.style.marginBottom = '12px';
                div.innerHTML = `<label style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" id="${prop}" ${activeConfig[prop] ? 'checked' : ''}> <span>${label}</span>
                </label>`;
                group2.appendChild(div);
                div.querySelector('input').addEventListener('change', (e) => {
                    activeConfig[prop] = e.target.checked;
                    saveActiveProfile();
                });
            });
            const alignSlider = document.createElement('div');
            alignSlider.style.marginBottom = '16px';
            alignSlider.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span>对齐阈值</span><span id="alignThreshold-val">${activeConfig.alignThreshold}px</span>
                </div>
                <input type="range" id="alignThreshold" min="5" max="50" value="${activeConfig.alignThreshold}" style="width:100%;">
            `;
            group2.appendChild(alignSlider);
            const alignInput = alignSlider.querySelector('input');
            const alignSpan = alignSlider.querySelector('span:last-child');
            alignInput.addEventListener('input', (e) => {
                activeConfig.alignThreshold = +e.target.value;
                alignSpan.textContent = activeConfig.alignThreshold + 'px';
                saveActiveProfile();
            });
            container.appendChild(group2);
            container.appendChild(document.createElement('hr')).style.cssText = 'border:0.5px solid #555; margin:16px 0;';

            const group3 = document.createElement('div');
            group3.innerHTML = '<div style="font-size:14px; margin-bottom:8px; color:#aaa;">控制条</div>';
            const sliders = [
                ['宽度', 'barWidth', 40, 200],
                ['高度', 'barHeight', 0, 30],
                ['垂直偏移', 'barOffset', 0, 50, 'px'],
                ['水平位置(%)', 'barPosition', 0, 100, '%']
            ];
            sliders.forEach(([label, prop, min, max, unit='px']) => {
                const div = document.createElement('div');
                div.style.marginBottom = '16px';
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <span>${label}</span><span id="${prop}-val">${activeConfig[prop]}${unit}</span>
                    </div>
                    <input type="range" id="${prop}" min="${min}" max="${max}" value="${activeConfig[prop]}" style="width:100%;">
                `;
                group3.appendChild(div);
                const input = div.querySelector('input');
                const span = div.querySelector('span:last-child');
                input.addEventListener('input', (e) => {
                    activeConfig[prop] = +e.target.value;
                    span.textContent = activeConfig[prop] + unit;
                    if (prop.startsWith('bar')) createControlBar();
                    saveActiveProfile();
                });
            });
            const colorDiv = document.createElement('div');
            colorDiv.style.marginBottom = '16px';
            colorDiv.innerHTML = `
                <div>颜色</div>
                <input type="color" id="barColor" value="${activeConfig.barColor}">
            `;
            group3.appendChild(colorDiv);
            colorDiv.querySelector('input').addEventListener('input', (e) => {
                activeConfig.barColor = e.target.value;
                createControlBar();
                saveActiveProfile();
            });
            container.appendChild(group3);
        }

        function renderKeySettings(container) {
            container.innerHTML = '';

            const addBtn = document.createElement('button');
            addBtn.textContent = '+ 添加按键';
            addBtn.style.cssText = 'width:100%; padding:8px; background:#4caf50; border:none; border-radius:12px; color:white; margin-bottom:12px;';
            addBtn.addEventListener('click', () => {
                const newId = 'custom'+Date.now();
                activeConfig.buttons.push({
                    id: newId, text: '新', key: '', code: '', type: 'action',
                    left: 100, top: 100, width: 65, height: 65, bg: 'rgba(255,255,255,0.15)', pressedBg: 'rgba(255,255,255,0.4)', opacity: 1.0, locked: false
                });
                saveActiveProfile();
                rebuildButtons();
                setTimeout(() => showButtonEditor(newId), 100);
            });
            container.appendChild(addBtn);

            container.appendChild(document.createElement('hr')).style.cssText = 'border:0.5px solid #555; margin:8px 0;';

            activeConfig.buttons.forEach((btn, idx) => {
                const row = document.createElement('div');
                row.style.cssText = 'background:#333; padding:8px; border-radius:8px; margin-bottom:8px;';
                row.innerHTML = `
                    <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                        <span style="width:30px;">${btn.text}</span>
                        <input type="text" class="key-input" value="${btn.key}" style="width:70px; background:#222; color:white; border:1px solid #555; padding:4px; border-radius:6px;">
                        <input type="number" class="width-input" value="${btn.width}" min="30" max="200" style="width:60px; background:#222; color:white; border:1px solid #555; padding:4px; border-radius:6px;" placeholder="宽">
                        <input type="number" class="height-input" value="${btn.height}" min="30" max="200" style="width:60px; background:#222; color:white; border:1px solid #555; padding:4px; border-radius:6px;" placeholder="高">
                        <input type="color" class="color-input" value="${btn.bg.startsWith('#') ? btn.bg : '#ffffff'}" style="width:40px; height:30px;">
                        <input type="number" class="opacity-input" value="${btn.opacity}" min="0.1" max="1" step="0.1" style="width:50px; background:#222; color:white; border:1px solid #555; padding:4px; border-radius:6px;">
                        <label style="color:#aaa;"><input type="checkbox" class="locked-check" ${btn.locked ? 'checked' : ''}>锁</label>
                        <button class="remove-btn" style="background:#f44336; border:none; border-radius:6px; color:white; padding:4px 8px;">✕</button>
                    </div>
                `;
                container.appendChild(row);

                const keyInput = row.querySelector('.key-input');
                const widthInput = row.querySelector('.width-input');
                const heightInput = row.querySelector('.height-input');
                const colorInput = row.querySelector('.color-input');
                const opacityInput = row.querySelector('.opacity-input');
                const lockedCheck = row.querySelector('.locked-check');
                const removeBtn = row.querySelector('.remove-btn');

                keyInput.addEventListener('input', (e) => {
                    btn.key = e.target.value;
                    btn.code = getKeyCode(btn.key);
                    updateButtonElement(btn.id, {key: btn.key});
                    saveActiveProfile();
                });
                widthInput.addEventListener('input', (e) => { btn.width = +e.target.value; updateButtonElement(btn.id, {width: btn.width}); saveActiveProfile(); });
                heightInput.addEventListener('input', (e) => { btn.height = +e.target.value; updateButtonElement(btn.id, {height: btn.height}); saveActiveProfile(); });
                colorInput.addEventListener('input', (e) => { btn.bg = e.target.value; updateButtonElement(btn.id, {bg: btn.bg}); saveActiveProfile(); });
                opacityInput.addEventListener('input', (e) => { btn.opacity = +e.target.value; updateButtonElement(btn.id, {opacity: btn.opacity}); saveActiveProfile(); });
                lockedCheck.addEventListener('change', (e) => { btn.locked = e.target.checked; updateButtonElement(btn.id, {locked: btn.locked}); saveActiveProfile(); });
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    activeConfig.buttons.splice(idx, 1);
                    saveActiveProfile();
                    rebuildButtons();
                    renderKeySettings(container);
                });
            });
        }

        function renderTurbo(container) {
            const div = document.createElement('div');
            div.innerHTML = `
                <label style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                    <input type="checkbox" id="turboEnabled" ${activeConfig.turboEnabled ? 'checked' : ''}> 启用连发
                </label>
                <div>CPS (每秒次数): <input type="number" id="turboCPS" value="${activeConfig.turboCPS}" min="1" max="50" style="width:80px; background:#222; color:white; border:1px solid #555; padding:4px;"></div>
                <div>随机偏移(ms): <input type="number" id="turboRandom" value="${activeConfig.turboRandom}" min="0" max="200" style="width:80px; background:#222; color:white; border:1px solid #555; padding:4px;"></div>
                <p style="font-size:12px; color:#aaa;">随机偏移使连发更自然，防检测。</p>
            `;
            container.appendChild(div);

            div.querySelector('#turboEnabled').addEventListener('change', (e) => { activeConfig.turboEnabled = e.target.checked; saveActiveProfile(); });
            div.querySelector('#turboCPS').addEventListener('input', (e) => { activeConfig.turboCPS = +e.target.value; saveActiveProfile(); });
            div.querySelector('#turboRandom').addEventListener('input', (e) => { activeConfig.turboRandom = +e.target.value; saveActiveProfile(); });
        }

        function renderMacro(container) {
            container.innerHTML = '';

            const recordBtn = document.createElement('button');
            recordBtn.id = 'macro-record';
            recordBtn.textContent = macroRecording ? '结束录制' : '录制宏';
            recordBtn.style.cssText = 'width:100%; padding:8px; background:#2196F3; border:none; border-radius:12px; color:white; margin-bottom:8px;';
            recordBtn.addEventListener('click', () => {
                if (!macroRecording) {
                    macroRecording = true;
                    macroSteps = [];
                    recordBtn.textContent = '结束录制';
                    document.addEventListener('keydown', macroRecordHandler);
                    document.addEventListener('keyup', macroRecordHandler);
                } else {
                    macroRecording = false;
                    recordBtn.textContent = '录制宏';
                    document.removeEventListener('keydown', macroRecordHandler);
                    document.removeEventListener('keyup', macroRecordHandler);
                    alert('录制结束，共 ' + macroSteps.length + ' 步');
                }
            });
            container.appendChild(recordBtn);

            const playRow = document.createElement('div');
            playRow.style.cssText = 'display:flex; gap:8px; margin:8px 0;';
            playRow.innerHTML = `
                <button id="macro-play" style="flex:2; background:#FF9800; border:none; border-radius:12px; color:white; padding:8px;">播放宏</button>
                <button id="macro-stop" style="flex:1; background:#f44336; border:none; border-radius:12px; color:white; padding:8px;">停止</button>
            `;
            container.appendChild(playRow);

            const loopDiv = document.createElement('div');
            loopDiv.style.margin = '12px 0';
            loopDiv.innerHTML = `
                <label style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" id="macro-loop" ${activeConfig.macroLoopEnabled ? 'checked' : ''}> 循环播放
                </label>
            `;
            container.appendChild(loopDiv);
            loopDiv.querySelector('#macro-loop').addEventListener('change', (e) => {
                activeConfig.macroLoopEnabled = e.target.checked;
                saveActiveProfile();
            });

            const intervalDiv = document.createElement('div');
            intervalDiv.style.marginBottom = '16px';
            intervalDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span>播放间隔(ms)</span><span id="macroPlayInterval-val">${activeConfig.macroPlayInterval}ms</span>
                </div>
                <input type="range" id="macroPlayInterval" min="50" max="500" value="${activeConfig.macroPlayInterval}" style="width:100%;">
            `;
            container.appendChild(intervalDiv);
            const intervalInput = intervalDiv.querySelector('#macroPlayInterval');
            const intervalSpan = intervalDiv.querySelector('#macroPlayInterval-val');
            intervalInput.addEventListener('input', (e) => {
                activeConfig.macroPlayInterval = +e.target.value;
                intervalSpan.textContent = activeConfig.macroPlayInterval + 'ms';
                saveActiveProfile();
            });

            const clearBtn = document.createElement('button');
            clearBtn.textContent = '清空宏';
            clearBtn.style.cssText = 'width:100%; padding:8px; background:#555; border:none; border-radius:12px; color:white; margin-top:12px;';
            clearBtn.addEventListener('click', () => {
                macroSteps = [];
                alert('宏已清空');
            });
            container.appendChild(clearBtn);

            playRow.querySelector('#macro-play').addEventListener('click', () => {
                if (macroSteps.length === 0) {
                    alert('没有录制的宏');
                    return;
                }
                if (macroPlaying) stopMacro();
                macroPlaying = true;
                macroLoop = activeConfig.macroLoopEnabled;
                let index = 0;
                function playStep() {
                    if (!macroPlaying) return;
                    if (index >= macroSteps.length) {
                        if (macroLoop) {
                            index = 0;
                            macroPlayTimer = setTimeout(playStep, activeConfig.macroPlayInterval);
                        } else {
                            macroPlaying = false;
                        }
                        return;
                    }
                    const step = macroSteps[index];
                    sendKey('keydown', step.key, step.code);
                    setTimeout(() => sendKey('keyup', step.key, step.code), 50);
                    index++;
                    macroPlayTimer = setTimeout(playStep, activeConfig.macroPlayInterval);
                }
                playStep();
            });

            playRow.querySelector('#macro-stop').addEventListener('click', stopMacro);
        }

        function stopMacro() {
            macroPlaying = false;
            if (macroPlayTimer) {
                clearTimeout(macroPlayTimer);
                macroPlayTimer = null;
            }
        }

        function macroRecordHandler(e) {
            if (!macroRecording) return;
            macroSteps.push({ key: e.key, code: e.code });
        }

        function renderAdvanced(container) {
            const group1 = document.createElement('div');
            group1.innerHTML = '<div style="font-size:14px; margin-bottom:8px; color:#aaa;">系统</div>';
            const advancedItems = [
                ['屏蔽系统按键', 'blockKeys', '阻止某些按键影响游戏'],
                ['游戏模式', 'gameMode', '优化性能，禁用页面滚动']
            ];
            advancedItems.forEach(([label, prop, desc]) => {
                const div = document.createElement('div');
                div.style.marginBottom = '16px';
                div.innerHTML = `
                    <label style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="${prop}" ${activeConfig[prop] ? 'checked' : ''}> <span>${label}</span>
                    </label>
                    <div style="font-size:12px; color:#aaa; margin-left:24px;">${desc}</div>
                `;
                group1.appendChild(div);
                div.querySelector('input').addEventListener('change', (e) => {
                    activeConfig[prop] = e.target.checked;
                    if (prop === 'gameMode') toggleGameMode(activeConfig[prop]);
                    saveActiveProfile();
                });
            });
            container.appendChild(group1);
            container.appendChild(document.createElement('hr')).style.cssText = 'border:0.5px solid #555; margin:16px 0;';

            const group2 = document.createElement('div');
            group2.innerHTML = '<div style="font-size:14px; margin-bottom:8px; color:#aaa;">手势</div>';
            const sliders = [
                ['长按触发(ms)', 'longPressTime', 200, 1000],
                ['双击间隔(ms)', 'doubleClickSpeed', 100, 800]
            ];
            sliders.forEach(([label, prop, min, max]) => {
                const div = document.createElement('div');
                div.style.marginBottom = '16px';
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <span>${label}</span><span id="${prop}-val">${activeConfig[prop]}ms</span>
                    </div>
                    <input type="range" id="${prop}" min="${min}" max="${max}" value="${activeConfig[prop]}" style="width:100%;">
                `;
                group2.appendChild(div);
                const input = div.querySelector('input');
                const span = div.querySelector('span:last-child');
                input.addEventListener('input', (e) => {
                    activeConfig[prop] = +e.target.value;
                    span.textContent = activeConfig[prop] + 'ms';
                    saveActiveProfile();
                });
            });
            container.appendChild(group2);
            container.appendChild(document.createElement('hr')).style.cssText = 'border:0.5px solid #555; margin:16px 0;';

            const group3 = document.createElement('div');
            group3.innerHTML = '<div style="font-size:14px; margin-bottom:8px; color:#aaa;">导入/导出</div>';
            const exportDiv = document.createElement('div');
            exportDiv.innerHTML = `
                <button id="export-config" style="background:#2196F3; border:none; border-radius:12px; color:white; padding:8px; width:48%;">导出配置</button>
                <button id="import-config" style="background:#FF9800; border:none; border-radius:12px; color:white; padding:8px; width:48%;">导入配置</button>
            `;
            group3.appendChild(exportDiv);
            exportDiv.querySelector('#export-config').addEventListener('click', () => {
                const data = JSON.stringify(config, null, 2);
                const blob = new Blob([data], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'gamepad_config.json'; a.click();
            });
            exportDiv.querySelector('#import-config').addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = '.json';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const imported = JSON.parse(e.target.result);
                            if (imported.profiles) config = imported;
                            else config.profiles[config.activeProfile] = imported;
                            saveConfig();
                            rebuildAll();
                            panel.remove(); settingsVisible = false;
                        } catch(ex) { alert('导入失败'); }
                    };
                    reader.readAsText(file);
                };
                input.click();
            });
            container.appendChild(group3);
        }

        function renderProfile(container) {
            const selectDiv = document.createElement('div');
            selectDiv.style.marginBottom = '16px';
            selectDiv.innerHTML = `
                <select id="profile-select" style="width:100%; background:#333; color:white; border:1px solid #555; padding:8px; border-radius:8px;">
                    ${Object.keys(config.profiles).map(name => `<option value="${name}" ${name===config.activeProfile?'selected':''}>${name}</option>`).join('')}
                </select>
            `;
            container.appendChild(selectDiv);

            const btnDiv = document.createElement('div');
            btnDiv.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap;';
            btnDiv.innerHTML = `
                <button id="profile-save" style="flex:1; background:#4caf50; border:none; border-radius:8px; color:white; padding:6px;">保存</button>
                <button id="profile-new" style="flex:1; background:#2196F3; border:none; border-radius:8px; color:white; padding:6px;">新建</button>
                <button id="profile-rename" style="flex:1; background:#FF9800; border:none; border-radius:8px; color:white; padding:6px;">重命名</button>
                <button id="profile-delete" style="flex:1; background:#f44336; border:none; border-radius:8px; color:white; padding:6px;">删除</button>
            `;
            container.appendChild(btnDiv);

            const quickDiv = document.createElement('div');
            quickDiv.style.marginTop = '20px';
            quickDiv.innerHTML = `
                <hr style="border:0.5px solid #555; margin:16px 0;">
                <div style="font-size:14px; margin-bottom:8px; color:#aaa;">快速切换</div>
                <div>快捷键: <input type="text" id="quickSwitchKey" value="${activeConfig.quickSwitchKey}" style="width:80px; background:#222; color:white; border:1px solid #555; padding:4px;"></div>
                <p style="font-size:12px; color:#aaa;">按下此键循环切换配置文件</p>
            `;
            container.appendChild(quickDiv);
            quickDiv.querySelector('#quickSwitchKey').addEventListener('input', (e) => { activeConfig.quickSwitchKey = e.target.value; saveActiveProfile(); });

            selectDiv.querySelector('#profile-select').addEventListener('change', (e) => {
                switchProfile(e.target.value);
                panel.remove(); settingsVisible = false;
            });
            btnDiv.querySelector('#profile-save').addEventListener('click', () => { saveActiveProfile(); alert('已保存'); });
            btnDiv.querySelector('#profile-new').addEventListener('click', () => {
                const name = prompt('新配置文件名称');
                if (name && !config.profiles[name]) {
                    config.profiles[name] = JSON.parse(JSON.stringify(activeConfig));
                    switchProfile(name);
                    panel.remove(); settingsVisible = false;
                } else alert('无效名称');
            });
            btnDiv.querySelector('#profile-rename').addEventListener('click', () => {
                if (config.activeProfile === '默认') { alert('不能重命名默认'); return; }
                const newName = prompt('新名称', config.activeProfile);
                if (newName && newName !== config.activeProfile && !config.profiles[newName]) {
                    config.profiles[newName] = config.profiles[config.activeProfile];
                    delete config.profiles[config.activeProfile];
                    config.activeProfile = newName;
                    saveConfig();
                    panel.remove(); settingsVisible = false;
                } else alert('名称无效');
            });
            btnDiv.querySelector('#profile-delete').addEventListener('click', () => {
                if (config.activeProfile === '默认') { alert('不能删除默认'); return; }
                if (confirm('删除配置?')) {
                    delete config.profiles[config.activeProfile];
                    config.activeProfile = '默认';
                    activeConfig = config.profiles['默认'];
                    saveConfig();
                    rebuildAll();
                    panel.remove(); settingsVisible = false;
                }
            });

            container.appendChild(document.createElement('hr')).style.cssText = 'border:0.5px solid #555; margin:16px 0;';

            const resetBtn = document.createElement('button');
            resetBtn.textContent = '重置当前配置为默认';
            resetBtn.style.cssText = 'width:100%; padding:12px; background:#f44336; border:none; border-radius:16px; color:white; margin-top:20px;';
            resetBtn.addEventListener('click', () => {
                if (confirm('重置当前配置文件？')) {
                    activeConfig = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
                    config.profiles[config.activeProfile] = activeConfig;
                    saveConfig();
                    rebuildAll();
                    panel.remove(); settingsVisible = false;
                }
            });
            container.appendChild(resetBtn);
        }

        function renderHelp(container) {
            container.innerHTML = `
                <div style="background:#333; border-radius:12px; padding:16px;">
                    <h4 style="margin:0 0 12px;">功能指南</h4>
                    <ul style="list-style:none; padding:0; margin:0;">
                        <li><b>• 编辑模式</b>：开启后可拖拽按钮位置，双击按钮打开编辑栏。</li>
                        <li><b>• 双击编辑</b>：编辑模式下双击按钮弹出浮动工具栏，可调整宽高、颜色、透明度、按键映射等。</li>
                        <li><b>• 辅助对齐</b>：拖拽按钮时自动对齐其他按钮，阈值可调。</li>
                        <li><b>• 连发CPS</b>：设置每秒点击次数，随机偏移防检测。</li>
                        <li><b>• 宏录制</b>：点击“录制宏”开始记录按键，再次点击停止；可循环播放、自定义间隔。</li>
                        <li><b>• 游戏模式</b>：禁用页面滚动，提升游戏体验。</li>
                        <li><b>• 配置文件</b>：可创建多个配置，快速切换，导出/导入。</li>
                        <li><b>• 快捷键</b>：按F5（可自定义）循环切换配置文件。</li>
                    </ul>
                    <hr style="border:0.5px solid #555; margin:16px 0;">
                    <p style="margin:8px 0 0; text-align:center; color:#aaa;">当前版本：v1.2.4</p>
                    <p style="margin:0; text-align:center; color:#aaa;">© ${new Date().getFullYear()} FastNow Studio | BSD 3-Clause</p>
                </div>
            `;
        }
        // ---------- 渲染函数结束 ----------

        renderContent();

        document.body.appendChild(panel);
    }

    function toggleGameMode(enable) {
        if (enable) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }
    }

    function rebuildAll() {
        rebuildButtons();
        createControlBar();
        hideButtonEditor();
    }

    function switchProfile(name) {
        if (!config.profiles[name]) return;
        config.activeProfile = name;
        activeConfig = config.profiles[name];
        saveConfig();
        rebuildAll();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === activeConfig.quickSwitchKey) {
            const keys = Object.keys(config.profiles);
            const idx = keys.indexOf(config.activeProfile);
            const next = keys[(idx + 1) % keys.length];
            switchProfile(next);
            e.preventDefault();
        }
    });

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => { rebuildButtons(); createControlBar(); });
    else { rebuildButtons(); createControlBar(); }
})();