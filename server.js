// Nhập các module cần thiết
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// Khởi tạo Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Lưu trữ lịch sử trò chuyện
const chatHistory = {};

// Route để lấy lịch sử trò chuyện
app.get('/api/history/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    if (!chatHistory[sessionId]) {
        chatHistory[sessionId] = [];
    }
    res.json(chatHistory[sessionId]);
});

// Route để gửi tin nhắn đến Gemini API
app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId, modelOption = 'gemini-pro' } = req.body;
        
        // Kiểm tra dữ liệu đầu vào
        if (!message) {
            return res.status(400).json({ error: 'Vui lòng cung cấp tin nhắn' });
        }
        
        // Khởi tạo lịch sử nếu chưa có
        if (!chatHistory[sessionId]) {
            chatHistory[sessionId] = [];
        }
        
        // Thêm tin nhắn của người dùng vào lịch sử
        chatHistory[sessionId].push({
            role: 'user',
            content: message,
            timestamp: new Date()
        });
        
        // Chuẩn bị context từ lịch sử trò chuyện (tối đa 10 tin nhắn gần nhất)
        const recentMessages = chatHistory[sessionId].slice(-10);
        
        // Chuẩn bị dữ liệu gửi đến Gemini API
        const contents = recentMessages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));
        
        // Gọi API Gemini
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/${modelOption}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            { contents }
        );
        
        // Xử lý phản hồi từ Gemini API
        const botResponse = response.data.candidates[0].content.parts[0].text;
        
        // Thêm phản hồi của bot vào lịch sử
        chatHistory[sessionId].push({
            role: 'assistant',
            content: botResponse,
            timestamp: new Date()
        });
        
        // Trả về phản hồi cho client
        res.json({ response: botResponse });
        
    } catch (error) {
        console.error('Lỗi khi gọi Gemini API:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn',
            details: error.response?.data || error.message
        });
    }
});

// Route để xóa lịch sử trò chuyện
app.delete('/api/history/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    if (chatHistory[sessionId]) {
        delete chatHistory[sessionId];
    }
    res.json({ success: true });
});

// Route để lấy danh sách các model có sẵn
app.get('/api/models', (req, res) => {
    // Danh sách các model Gemini hiện có
    const models = [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'imagen-3.0-generate-002', name: 'Imagen 3' },
        // { id: 'gemini-pro-vision', name: 'Gemini Pro Vision' },
        // { id: 'gemini-ultra', name: 'Gemini Ultra (Nếu có quyền truy cập)' }, 
        { id: 'gemini-2.0-flash-preview-image-generation', name: 'Gemini 2.0 Flash Preview Image Generation' },
    ];
    res.json(models);
});

// Catch-all route để phục vụ ứng dụng SPA
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Khởi động server
app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
});