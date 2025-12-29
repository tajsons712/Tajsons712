// Gemini AI Assistant Client
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('chat-widget-container');
    if (!container) return;

    // Inject Widget HTML
    container.innerHTML = `
        <div id="chat-widget" style="display: none; position: fixed; bottom: 90px; right: 20px; width: 300px; height: 400px; background: white; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); flex-direction: column; overflow: hidden; z-index: 1000;">
            <div style="background: var(--primary-color); color: white; padding: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span>Taj Sons Assistant</span>
                <span onclick="toggleChat()" style="cursor: pointer;">&times;</span>
            </div>
            <div id="chat-messages" style="flex: 1; padding: 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #f9f9f9;">
                    Hello! Welcome to Taj Sons. How can I help you organize your home today? 🏡
                </div>
            </div>
            <div style="padding: 10px; border-top: 1px solid #eee; display: flex; gap: 5px;">
                <input type="text" id="chat-input" placeholder="Type a message..." style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <button onclick="sendMessage()" style="background: var(--accent-color); color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
        <div class="chat-widget-btn" onclick="toggleChat()">
            <i class="fas fa-comment-alt" style="font-size: 24px;"></i>
        </div>
    `;

    // Enter Key Support
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});

let chatHistory = [];

function toggleChat() {
    const widget = document.getElementById('chat-widget');
    if (widget.style.display === 'none') {
        widget.style.display = 'flex';
    } else {
        widget.style.display = 'none';
    }
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    // Add User Message
    addMessage(message, 'user');
    input.value = '';

    // Show Typing Indicator
    const typingId = addMessage('Typing...', 'ai', true);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 180 seconds timeout for local AI

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history: chatHistory,
                apiKey: CONFIG.geminiApiKey, // Sending key from config (client-side)
                useLocalAI: CONFIG.useLocalAI
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();

        // Remove Typing Indicator
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        // Add AI Message
        addMessage(data.reply, 'ai');

        // Update History
        chatHistory.push({ role: "user", parts: message });
        chatHistory.push({ role: "model", parts: data.reply });

    } catch (error) {
        console.error("Chat Error:", error);
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove(); // Ensure typing is removed

        if (error.name === 'AbortError') {
            addMessage("Network timeout. The server took too long to respond.", 'ai');
        } else {
            addMessage("Sorry, I'm having trouble connecting. Please check your internet or API key.", 'ai');
        }
    }
}

function addMessage(text, sender, isTyping = false) {
    const messages = document.getElementById('chat-messages');
    const div = document.createElement('div');
    const id = 'msg-' + Date.now();
    div.id = id;

    div.style.padding = '8px';
    div.style.borderRadius = '8px';
    div.style.maxWidth = '80%';
    div.style.wordWrap = 'break-word';

    if (sender === 'user') {
        div.style.alignSelf = 'flex-end';
        div.style.background = '#c9a227'; // Accent color
        div.style.color = 'white';
    } else {
        div.style.alignSelf = 'flex-start';
        div.style.background = '#eee';
        div.style.color = '#333';
    }

    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return id;
}
