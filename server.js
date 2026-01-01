const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG = { storeName: 'Taj Sons' };

// Basic Authentication Middleware
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Authentication required');
    }

    const auth = new Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    // Default credentials: admin / taj123
    // Use environment variables in production preferably
    const validUser = process.env.ADMIN_USER || 'admin';
    const validPass = process.env.ADMIN_PASSWORD || 'taj123';

    if (user === validUser && pass === validPass) {
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Access denied');
    }
};

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Protect Admin Panel (MUST be before express.static)
app.get('/admin', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Protect Sensitive APIs (Moved to specific routes below)
// app.use('/api/orders', authMiddleware); 

app.use(express.static(path.join(__dirname, '.')));
app.use('/products', express.static(path.join(__dirname, 'Products')));

console.log("💎 Gemini AI Model set to: gemini-1.5-flash"); // Debug log

// Image Upload Configuration
const storage = multer.memoryStorage(); // Use memory storage for Vercel
const upload = multer({ storage: storage });

// Data File Path
// Attempt to locate data files robustly
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const INTERESTS_FILE = path.join(DATA_DIR, 'interests.json');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://awaisgillani1996_db_user:9JQtjvl0GqTeIWGT@cluster0.dxbpuuw.mongodb.net/tajstudio?retryWrites=true&w=majority&appName=Cluster0";

let cachedDb = null;
let mongoError = null;
let mongoStatus = "Initializing";

async function connectDB() {
    if (cachedDb && mongoose.connection.readyState === 1) {
        return cachedDb;
    }

    if (!cachedDb || mongoose.connection.readyState === 0) {
        console.log("🔌 Connecting to MongoDB...");
        mongoStatus = "Connecting...";

        cachedDb = mongoose.connect(MONGODB_URI, {
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 5000, // Fast fail in 5s
            socketTimeoutMS: 45000,
        }).then(m => {
            mongoStatus = "Connected";
            mongoError = null;
            console.log("✅ MongoDB Connected Successfully");
            // Only migrate if we just connected
            migrateData();
            return m;
        }).catch(err => {
            mongoStatus = "Error: " + err.message;
            mongoError = err.message;
            console.error("❌ MongoDB Connection failed:", err.message);
            cachedDb = null; // Reset for retry
            throw err;
        });
    }

    return cachedDb;
}

// Initial connection attempt (Non-blocking)
connectDB().catch(() => { });

mongoose.connection.on('disconnected', () => {
    console.log("🔌 MongoDB Disconnected");
    mongoStatus = "Disconnected";
    cachedDb = null;
});

const productSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    name: String,
    price: Number,
    category: String,
    image: String,
    images: [String],
    description: String,
    inStock: { type: Boolean, default: true },
    tags: [String],
    dateAdded: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    date: { type: Date, default: Date.now },
    cart: Array,
    total: Number,
    status: { type: String, default: 'Pending (WhatsApp Confirmation)' }
});
const Order = mongoose.model('Order', orderSchema);

const interestSchema = new mongoose.Schema({
    productId: String,
    name: String,
    phone: String,
    date: { type: Date, default: Date.now }
});
const Interest = mongoose.model('Interest', interestSchema);

// Data Migration Helper
const migrateData = async () => {
    try {
        const productCount = await Product.countDocuments();
        if (productCount === 0 && fs.existsSync(PRODUCTS_FILE)) {
            console.log("📦 Migrating products from JSON to MongoDB...");
            const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
            if (Array.isArray(data) && data.length > 0) {
                await Product.insertMany(data);
                console.log(`✅ Successfully migrated ${data.length} products.`);
            }
        }

        const orderCount = await Order.countDocuments();
        if (orderCount === 0 && fs.existsSync(ORDERS_FILE)) {
            console.log("📦 Migrating orders from JSON to MongoDB...");
            const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
            if (Array.isArray(data) && data.length > 0) {
                await Order.insertMany(data);
                console.log(`✅ Successfully migrated ${data.length} orders.`);
            }
        }
    } catch (err) {
        console.error("Migration Error:", err.message);
    }
};

// --- Helpers (Modified for DB) ---
// Note: We'll keep the function names but make them internal use or just use models directly in routes.

const writeInterests = (interests) => {
    // Legacy helper - no longer needed with MongoDB but keeping to avoid breaking 
    // some local calls if any remain. Ideally refactor later.
    console.log("Legacy writeInterests called (No-op)");
};

// Debug Endpoint for Vercel (Advanced)
app.get('/api/debug', (req, res) => {
    const debugInfo = {
        cwd: process.cwd(),
        dirname: __dirname,
        dataDir: DATA_DIR,
        productsFile: PRODUCTS_FILE,
        envPort: process.env.PORT,
        dataDirExists: fs.existsSync(DATA_DIR),
        productsFileExists: fs.existsSync(PRODUCTS_FILE),
    };

    try {
        if (fs.existsSync(DATA_DIR)) {
            debugInfo.filesInData = fs.readdirSync(DATA_DIR);
        }

        if (fs.existsSync(PRODUCTS_FILE)) {
            const rawData = fs.readFileSync(PRODUCTS_FILE, 'utf8');
            debugInfo.fileReadSuccess = true;
            debugInfo.fileLength = rawData.length;
            debugInfo.fileContentPreview = rawData.substring(0, 500); // Show first 500 chars

            try {
                const json = JSON.parse(rawData);
                debugInfo.jsonParseSuccess = true;
                debugInfo.productsCount = json.length;
            } catch (err) {
                debugInfo.jsonParseError = err.message;
            }
        }

        debugInfo.dbState = mongoose.connection.readyState;
        debugInfo.mongoStatus = mongoStatus;
        debugInfo.mongoError = mongoError;
    } catch (err) {
        debugInfo.fatalError = err.message;
    }

    res.json(debugInfo);
});

// API Routes

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        await connectDB();
        const products = await Product.find({}).sort({ dateAdded: -1 });
        res.json(products);
    } catch (err) {
        console.error("❌ MongoDB Fail, Falling back to JSON:", err.message);
        try {
            if (fs.existsSync(PRODUCTS_FILE)) {
                const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
                res.json(data);
            } else {
                res.status(500).json({ error: "Data unavailable" });
            }
        } catch (fileErr) {
            res.status(500).json({ error: "Critical data failure" });
        }
    }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
    try {
        await connectDB();
        const product = await Product.findOne({ id: req.params.id });
        if (product) res.json(product);
        else throw new Error("Not found in DB");
    } catch (err) {
        console.error("❌ MongoDB Fail, Falling back to JSON for single item:", err.message);
        try {
            if (fs.existsSync(PRODUCTS_FILE)) {
                const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
                const product = data.find(p => p.id === req.params.id);
                if (product) res.json(product);
                else res.status(404).json({ message: 'Product not found' });
            } else {
                res.status(404).json({ message: 'Product not found' });
            }
        } catch (fileErr) {
            res.status(500).json({ error: "Critical data failure" });
        }
    }
});

// Update product SEO
app.post('/api/products/:id/seo', authMiddleware, async (req, res) => {
    const { description, tags } = req.body;
    try {
        await connectDB();
        const product = await Product.findOneAndUpdate(
            { id: req.params.id },
            { description, tags },
            { new: true }
        );
        if (product) {
            res.json({ success: true });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update product stock
app.post('/api/products/:id/stock', authMiddleware, async (req, res) => {
    const { inStock } = req.body;
    try {
        await connectDB();
        const product = await Product.findOneAndUpdate(
            { id: req.params.id },
            { inStock },
            { new: true }
        );
        if (product) {
            res.json({ success: true });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new product
app.post('/api/products', authMiddleware, upload.array('images', 5), async (req, res) => {
    const { name, price, category, description } = req.body;
    const imageFiles = req.files ? req.files.map(f => f.filename) : [];
    const mainImage = imageFiles.length > 0 ? imageFiles[0] : 'placeholder.jpg';

    try {
        await connectDB();
        const newProduct = new Product({
            id: 'prod_' + Date.now(),
            name: name || 'New Item',
            price: parseInt(price) || 0,
            category: category || 'General',
            image: mainImage,
            images: imageFiles,
            description: description || '',
            inStock: true
        });

        await newProduct.save();
        res.json({ success: true, product: newProduct });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit product
app.put('/api/products/:id', upload.array('images', 5), async (req, res) => {
    const { name, price, category, description } = req.body;
    try {
        await connectDB();
        const updateData = {
            name,
            price: price ? parseInt(price) : undefined,
            category,
            description
        };

        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(f => f.filename);
            updateData.images = newImages;
            updateData.image = newImages[0];
        }

        const product = await Product.findOneAndUpdate(
            { id: req.params.id },
            { $set: updateData },
            { new: true }
        );

        if (!product) return res.status(404).json({ error: "Product not found" });
        res.json({ success: true, product });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// End of PUT handler

// Delete product
app.delete('/api/products/:id', async (req, res) => {
    try {
        await connectDB();
        const product = await Product.findOneAndDelete({ id: req.params.id });

        if (!product) return res.status(404).json({ error: "Product not found" });

        // Delete all linked image files (Optional: only if you really want to clean disk)
        const imagesToDelete = product.images && product.images.length > 0 ? product.images : [product.image];
        imagesToDelete.forEach(imgName => {
            if (!imgName || imgName === 'placeholder.jpg') return;
            const imagePath = path.join(__dirname, 'Products', imgName);
            if (fs.existsSync(imagePath)) {
                try { fs.unlinkSync(imagePath); } catch (e) { console.error("Error deleting image", imgName, e); }
            }
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Orders API ---

// Log New Order
app.post('/api/orders', async (req, res) => {
    const { cart, total, customerName } = req.body;
    try {
        await connectDB();
        const newOrder = new Order({
            id: 'ord_' + Date.now(),
            customerName,
            cart,
            total,
            status: 'Pending (WhatsApp Confirmation)'
        });
        await newOrder.save();
        res.json({ success: true, orderId: newOrder.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all orders (Protected)
app.get('/api/orders', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const orders = await Order.find({}).sort({ date: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update order status (Protected)
app.post('/api/orders/:id/status', authMiddleware, async (req, res) => {
    const { status } = req.body;
    try {
        const order = await Order.findOneAndUpdate(
            { id: req.params.id },
            { status },
            { new: true }
        );
        if (!order) return res.status(404).json({ error: "Order not found" });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Interests API ---

// Log interest in out-of-stock product with customer contact
app.post('/api/interests', async (req, res) => {
    const { productId, name, phone } = req.body;
    if (!productId) return res.status(400).json({ error: "Product ID required" });

    try {
        const newInterest = new Interest({
            productId,
            name: name || 'Anonymous',
            phone: phone || 'No Phone'
        });
        await newInterest.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all interests (for Admin Panel) - Protected
app.get('/api/interests', authMiddleware, async (req, res) => {
    try {
        const interests = await Interest.find({}).sort({ date: -1 });
        // Format to match expected frontend structure if needed, or update frontend
        // Frontend expects Object: { productId: [leads] }
        const formatted = {};
        interests.forEach(i => {
            if (!formatted[i.productId]) formatted[i.productId] = [];
            formatted[i.productId].push(i);
        });
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear interests for a product
app.post('/api/interests/clear', async (req, res) => {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: "Product ID required" });

    try {
        await connectDB();
        await Interest.deleteMany({ productId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/scan-products', async (req, res) => {
    const productsDir = path.join(__dirname, 'Products');
    if (!fs.existsSync(productsDir)) {
        return res.status(404).json({ message: 'Products folder not found' });
    }

    try {
        await connectDB();
        const files = fs.readdirSync(productsDir);
        const productsInDb = await Product.find({}, 'image images');
        const newProducts = [];

        files.forEach((file, index) => {
            const isDuplicate = productsInDb.some(p =>
                p.image === file || (p.images && p.images.includes(file))
            );

            // Exclude fixed assets and background images (regex for robustness)
            const isAsset = /bg|logo|placeholder|icon|banner/i.test(file);

            if (isDuplicate || isAsset) return;

            const priceMatch = file.match(/(\d+)/);
            let price = 0;
            let name = file.replace(/\.[^/.]+$/, "");

            if (priceMatch) {
                const potentialPrice = parseInt(priceMatch[0]);
                if (potentialPrice < 1000000) {
                    price = potentialPrice;
                    name = name.replace(priceMatch[0], '').trim();
                }
                name = name.replace(/[()]/g, '').trim();
            }

            if (price === 0) price = 1500;

            newProducts.push({
                id: 'prod_' + Date.now() + '_' + index,
                name: name || 'Home Organizer Item',
                price: price,
                category: 'Organizers',
                image: file,
                description: 'Premium home organization solution.',
                inStock: true
            });
        });

        if (newProducts.length > 0) {
            await Product.insertMany(newProducts);
        }
        const total = await Product.countDocuments();
        res.json({ message: 'Scanned components', added: newProducts.length, total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Gemini AI
const { GoogleGenerativeAI } = require("@google/generative-ai");

app.post('/api/chat', async (req, res) => {
    let { message, history, apiKey, useLocalAI } = req.body;

    // Check for Local AI preference
    if (useLocalAI) {
        try {
            // Ollama API (Llama 3)
            const response = await fetch('http://127.0.0.1:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "llama3.2",
                    messages: [{ role: "user", content: message }],
                    stream: false
                })
            });
            const data = await response.json();
            return res.json({ reply: data.message.content });
        } catch (error) {
            console.error("Local AI (Ollama) Error:", error.message);
            return res.status(500).json({ reply: "Ollama is not running. Please run 'ollama serve'." });
        }
    }

    // Fallback to hardcoded key if not provided
    if (!apiKey) apiKey = "AIzaSyDwmuuxdVmwIk6nX5dJK-rx4BRzpCLtFX4";

    if (!apiKey) {
        return res.status(400).json({ reply: "Please configure your Gemini API Key in config.js or provide it." });
    }

    try {
        await connectDB();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Context for the AI
        const products = await Product.find({}, 'name price');
        const context = `You are the intelligent assistant for 'Taj Sons', a premium home organization store. 
        Your goal is to help customers find products, answer questions about home organization, and assist with orders.
        Be polite, professional, and concise. Use Roman Urdu or English as the user prefers.
        Current Store Products: ${JSON.stringify(products.map(p => p.name + " (" + p.price + ")"))}.
        If asked about order status, ask for Order ID.`;

        const chat = model.startChat({
            history: history || [],
            generationConfig: {
                maxOutputTokens: 200,
            },
        });

        const result = await chat.sendMessage(context + "\nUser: " + message);
        const response = result.response;
        const text = response.text();

        res.json({ reply: text });
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ reply: "Sorry, I am having trouble connecting to AI right now. Please try again." });
    }
});

// Auto-SEO Generator
app.post('/api/generate-seo', async (req, res) => {
    let { productName, category, apiKey } = req.body;

    // Fallback to hardcoded key
    if (!apiKey) apiKey = "AIzaSyDwmuuxdVmwIk6nX5dJK-rx4BRzpCLtFX4";

    if (!apiKey) return res.status(400).json({ error: "API Key required" });

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Write a premium, high-end, and luxury product description for a "${productName}" in the category "${category}". 
        Make it catchy, search-engine optimized, and persuasive for luxury buyers. 
        Also provide 8 relevant comma-separated SEO tags. 
        Format strictly as JSON: { "description": "...", "tags": "..." }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean markdown if present
        const jsonStr = text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(jsonStr);

        res.json(data);
    } catch (error) {
        console.error("SEO Gen Error:", error);
        res.status(500).json({ error: "Failed to generate SEO" });
    }
});

// Facebook/Instagram Product Feed (CSV)
app.get('/api/fb-catalog', async (req, res) => {
    try {
        await connectDB();
        const products = await Product.find({});
        const host = req.get('host');
        const protocol = req.protocol;
        const baseUrl = `${protocol}://${host}`;

        // CSV Headers required by Meta
        let csv = 'id,title,description,availability,condition,price,link,image_link,brand\n';

        products.forEach(p => {
            const link = `${baseUrl}/products.html?id=${p.id}`; // Direct link to product (conceptual)
            const imageLink = `${baseUrl}/products/${p.image}`;

            // CSV cleanup: remove commas from text to prevent breaking columns
            const cleanTitle = p.name.replace(/,/g, ' ');
            const cleanDesc = p.description.replace(/,/g, ' ');

            csv += `${p.id},${cleanTitle},${cleanDesc},in stock,new,${p.price} PKR,${link},${imageLink},${CONFIG.storeName}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="products_feed.csv"');
        res.send(csv);

    } catch (error) {
        console.error("Feed Error:", error);
        res.status(500).send("Error generating feed");
    }
});

// SEO Sitemap
app.get('/sitemap.xml', async (req, res) => {
    try {
        await connectDB();
        const products = await Product.find({});
        const host = req.get('host');
        const protocol = req.protocol;
        const baseUrl = `${protocol}://${host}`;

        let xml = '<?xml version="1.0" encoding="UTF-8"?>';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        // Static Pages
        const pages = ['index.html', 'products.html', 'cart.html', 'policy.html'];
        pages.forEach(page => {
            xml += `
        <url>
            <loc>${baseUrl}/${page}</loc>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
        </url>`;
        });

        // Dynamic Products
        products.forEach(p => {
            xml += `
        <url>
            <loc>${baseUrl}/products.html?id=${p.id}</loc>
            <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.6</priority>
        </url>`;
        });

        xml += '</urlset>';
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        res.status(500).send("Error generating sitemap");
    }
});

// Star
// Explicit root route for Vercel
app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
});t Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} to view the website`);
    console.log(`Open http://localhost:${PORT}/admin to view the admin panel`);
    // AI Initialization is now lazy/on-demand in the chat endpoint
});
