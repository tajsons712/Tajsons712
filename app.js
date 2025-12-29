// App Logic

// State
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('taj_cart')) || [];

// Helpers
const getImageUrl = (image) => `products/${image}`;
const formatCurrency = (amount) => `Rs. ${amount.toLocaleString()}`;
const goToProduct = (id) => window.location.href = `product-details.html?id=${id}`;

// Skeleton Render
function renderSkeleton() {
    const grid = document.getElementById('featured-products');
    if (!grid) return;

    grid.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        grid.innerHTML += `
            <div class="product-card skeleton-card">
                <div class="product-image-wrapper skeleton"></div>
                <div class="product-info">
                    <div class="skeleton-text skeleton" style="width: 50%;"></div>
                    <div class="skeleton-title skeleton"></div>
                    <div class="skeleton-text skeleton" style="width: 30%;"></div>
                </div>
            </div>
        `;
    }
}

// Fetch with Retry Helper
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (err) {
        if (retries <= 0) throw err;
        console.warn(`Fetch failed, retrying in ${backoff}ms... (${retries} retries left)`, err);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
}

// Fetch Products
async function fetchProducts() {
    const grid = document.getElementById('featured-products') || document.getElementById('product-list');
    if (!grid) return;

    renderSkeleton(); // Show loading state

    try {
        // Use retry logic for stability
        allProducts = await fetchWithRetry('/api/products', {}, 3, 1000);
        renderProducts(allProducts);
    } catch (err) {
        console.error("Error fetching products", err);
        grid.innerHTML = `
            <div style="text-align:center; padding: 2rem; width: 100%;">
                <p style="color:#ff4757; margin-bottom: 1rem;">Unable to load products. Connection to server seems unstable.</p>
                <button onclick="fetchProducts()" class="btn" style="padding: 8px 20px; font-size: 0.9rem;">
                    <i class="fas fa-sync-alt"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Render Products (kept for potential other uses, though loadProducts now handles initial render)
function renderProducts(products) {
    const container = document.getElementById('featured-products') || document.getElementById('product-list');
    if (!container) return;

    container.innerHTML = products.map(product => `
        <div class="product-card ${!product.inStock ? 'out-of-stock' : ''}">
            ${!product.inStock ? '<span class="badge sold-out">Sold Out</span>' : ''}
            <div class="product-image-wrapper" onclick="goToProduct('${product.id}')" style="cursor:pointer">
                <img src="${getImageUrl(product.image)}" alt="${product.name}" class="product-image">
            </div>
            <div class="product-info">
                <span class="product-category">${product.category}</span>
                <h3 class="product-title" onclick="goToProduct('${product.id}')" style="cursor:pointer">${product.name}</h3>
                <p class="product-desc" style="display:none">${product.description}</p>
                <div class="card-footer">
                    <span class="product-price">${formatCurrency(product.price)}</span>
                    <div style="display:flex; gap: 8px;">
                        ${!product.inStock ? `
                            <button onclick="logInterest('${product.id}', '${product.name}')" 
                                class="btn btn-interest" 
                                ${sessionStorage.getItem(`notified_${product.id}`) ? 'disabled' : ''}
                                style="padding: 8px 12px; font-size: 0.8rem; background: ${sessionStorage.getItem(`notified_${product.id}`) ? '#1fb468' : '#333'}; color: ${sessionStorage.getItem(`notified_${product.id}`) ? '#fff' : 'var(--accent-color)'}; border: 1px solid var(--accent-color); border-radius: 50px; cursor: ${sessionStorage.getItem(`notified_${product.id}`) ? 'default' : 'pointer'};">
                                ${sessionStorage.getItem(`notified_${product.id}`) ? 'Notified! ✅' : 'Notify Me'}
                            </button>
                        ` : `
                            <button onclick="addToCart('${product.id}')" class="add-btn">
                                <i class="fas fa-plus"></i>
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    if (window.triggerAnimations) triggerAnimations();
}

// Cart Functions
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    updateCart();
    showToast(`${product.name} added to cart!`);
}

async function logInterest(productId, productName) {
    // Check if already clicked in this session
    if (sessionStorage.getItem(`notified_${productId}`)) {
        showToast("You're already on the list! ✅");
        return;
    }

    // Show the notify modal
    showNotifyModal(productId, productName);
}

function showNotifyModal(productId, productName) {
    const modal = document.getElementById('notify-modal');
    if (!modal) {
        createNotifyModal();
        setTimeout(() => showNotifyModal(productId, productName), 100);
        return;
    }

    document.getElementById('notify-product-name').textContent = productName;
    document.getElementById('notify-modal').style.display = 'flex';

    // Reset form
    document.getElementById('notify-form').reset();

    // Handle form submission
    document.getElementById('notify-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('notify-name').value.trim() || 'Valued Customer';
        const phone = document.getElementById('notify-phone').value.trim();

        if (!phone) {
            alert('Please enter your WhatsApp number');
            return;
        }

        try {
            const res = await fetch('/api/interests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, name, phone })
            });
            const data = await res.json();

            if (data.success) {
                sessionStorage.setItem(`notified_${productId}`, 'true');
                closeNotifyModal();
                showToast(`Thank you ${name}! We'll notify you on WhatsApp when ${productName} is back.`);

                // Update button text and state visually
                const btn = document.querySelector(`button[onclick*="${productId}"]`);
                if (btn) {
                    btn.innerHTML = 'Notified! ✅';
                    btn.disabled = true;
                    btn.style.background = '#1fb468';
                    btn.style.borderColor = '#1fb468';
                    btn.style.color = '#fff';
                    btn.style.cursor = 'default';
                }
            }
        } catch (err) {
            console.error("Interest logging failed", err);
            alert('Failed to save. Please try again.');
        }
    };
}

function closeNotifyModal() {
    document.getElementById('notify-modal').style.display = 'none';
}

function createNotifyModal() {
    const modalHTML = `
        <div id="notify-modal" class="notify-modal" onclick="if(event.target === this) closeNotifyModal()">
            <div class="notify-modal-content">
                <div class="notify-modal-header">
                    <h2>🔔 Get Notified</h2>
                    <button class="notify-close-btn" onclick="closeNotifyModal()">&times;</button>
                </div>
                <p class="notify-subtitle">We'll message you on WhatsApp when <strong id="notify-product-name"></strong> is back in stock!</p>
                
                <form id="notify-form">
                    <div class="notify-input-group">
                        <label for="notify-name">
                            <i class="fas fa-user"></i> Your Name
                        </label>
                        <input type="text" id="notify-name" placeholder="Enter your name" required>
                    </div>
                    
                    <div class="notify-input-group">
                        <label for="notify-phone">
                            <i class="fab fa-whatsapp"></i> WhatsApp Number
                        </label>
                        <input type="tel" id="notify-phone" placeholder="03XX XXXXXXX" required>
                    </div>
                    
                    <button type="submit" class="notify-submit-btn">
                        <i class="fas fa-bell"></i> Notify Me
                    </button>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function showToast(message) {
    const x = document.getElementById("toast");
    if (!x) {
        console.log("Toast:", message);
        return;
    }
    x.textContent = message;
    x.className = "toast show";
    setTimeout(function () { x.className = x.className.replace("show", ""); }, 3000);
}

function updateCart() {
    localStorage.setItem('taj_cart', JSON.stringify(cart));
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) cartCountEl.textContent = count;
}

// Render Cart Page
function renderCartPage() {
    const container = document.getElementById('cart-content');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align: center;">Your cart is empty.</p>';
        document.getElementById('checkout-section').style.display = 'none';
        return;
    }

    container.innerHTML = `
        <table class="cart-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Total</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${cart.map(item => `
                    <tr>
                        <td style="display: flex; align-items: center; gap: 10px;">
                            <img src="${getImageUrl(item.image)}" class="cart-img">
                            ${item.name}
                        </td>
                        <td>${formatCurrency(item.price)}</td>
                        <td>
                            <div class="qty-controls">
                                <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
                                ${item.quantity}
                                <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
                            </div>
                        </td>
                        <td>${formatCurrency(item.price * item.quantity)}</td>
                        <td><i class="fas fa-trash remove-btn" onclick="removeItem('${item.id}')"></i></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('cart-total').textContent = formatCurrency(total);
    document.getElementById('checkout-section').style.display = 'block';
}

function updateQty(id, change) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) removeItem(id);
        else updateCart();
    }
    renderCartPage();
}

function removeItem(id) {
    cart = cart.filter(i => i.id !== id);
    updateCart();
    renderCartPage();
}

async function checkoutWhatsApp() {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderId = 'ord_' + Date.now();
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Log Order to Admin Panel
    try {
        await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: orderId,
                cart: cart,
                total: total
            })
        });
    } catch (err) {
        console.error("Order Logging Failed:", err);
    }

    // Build Premium Invoice Message
    const line = "=========================";
    let messageText = `${line}\n📦 *Taj Sons - ORDER INVOICE*\n${line}\n`;
    messageText += `*Order ID:* #${orderId}\n`;
    messageText += `*Date:* ${dateStr}\n\n`;

    messageText += `*Items Ordered:*\n`;
    cart.forEach(item => {
        messageText += `• ${item.name} (x${item.quantity}) — Rs. ${(item.price * item.quantity).toLocaleString()}\n`;
    });

    messageText += `\n*Total Amount:* Rs. ${total.toLocaleString()}\n`;
    messageText += `*Payment:* Cash on Delivery\n`;
    messageText += `${line}\n`;
    messageText += `_Thank you for choosing luxury!_ ✨`;

    const number = CONFIG.whatsappNumber || "923078265535";
    const encodedMessage = encodeURIComponent(messageText);
    window.open(`https://wa.me/${number}?text=${encodedMessage}`, '_blank');
}

// Search
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allProducts.filter(p => p.name.toLowerCase().includes(term));
        renderProducts(filtered);
    });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    updateCart();
    if (window.location.pathname.includes('cart.html')) {
        renderCartPage();
    }
    initAnimations();
});

// Animations
function initAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });

    // Wait slightly for dynamic content
    setTimeout(() => {
        document.querySelectorAll('.product-card').forEach(el => {
            el.classList.add('reveal');
            observer.observe(el);
        });
        document.querySelectorAll('.section-title').forEach(el => {
            el.classList.add('reveal');
            observer.observe(el);
        });
    }, 1000);
}

// Re-run animations after rendering
function triggerAnimations() {
    setTimeout(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.product-card').forEach(el => {
            if (!el.classList.contains('reveal')) {
                el.classList.add('reveal');
                observer.observe(el);
            }
        });
    }, 100);
}

// Product Details Page Logic
async function loadProductDetails(id) {
    try {
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) throw new Error('Product not found');

        const product = await res.json();

        // Sync with global state so addToCart works
        if (!allProducts.find(p => p.id === product.id)) {
            allProducts.push(product);
        }

        // Update Metadata
        document.title = `${product.name} | Taj Sons`;
        document.querySelector('meta[name="description"]').setAttribute("content", product.description || `Buy ${product.name} at Taj Sons. Premium quality home decor.`);

        // Update OG Tags (Note: Most scrapers won't see this, but it's good for SPA-like feel)
        document.getElementById('og-title').setAttribute('content', product.name);
        document.getElementById('og-image').setAttribute('content', getImageUrl(product.image));

        document.getElementById('breadcrumb-name').textContent = product.name;

        // Render Content
        // Initialize Main Image
        const mainImg = document.getElementById('detail-image');
        mainImg.src = getImageUrl(product.image);

        // Render Thumbnails
        const thumbContainer = document.getElementById('image-thumbnails');
        if (thumbContainer) thumbContainer.remove(); // Clear prev if any

        if (product.images && product.images.length > 1) {
            const thumbsDiv = document.createElement('div');
            thumbsDiv.id = 'image-thumbnails';
            thumbsDiv.className = 'thumbnails-grid';

            product.images.forEach(img => {
                const thumb = document.createElement('img');
                thumb.src = getImageUrl(img);
                thumb.className = `thumbnail ${img === product.image ? 'active' : ''}`;
                thumb.onclick = () => {
                    // Update Main Image
                    mainImg.style.opacity = '0';
                    setTimeout(() => {
                        mainImg.src = getImageUrl(img);
                        mainImg.style.opacity = '1';
                    }, 200);

                    // Update Active State
                    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                };
                thumbsDiv.appendChild(thumb);
            });

            const gallerySection = document.querySelector('.product-gallery-section');
            if (gallerySection) {
                gallerySection.appendChild(thumbsDiv);
            }
        }
        document.getElementById('detail-category').textContent = product.category;
        document.getElementById('detail-name').textContent = product.name;
        document.getElementById('detail-price').textContent = formatCurrency(product.price);

        let desc = product.description;
        if (!desc || desc === 'undefined') {
            desc = "Experience premium quality with this exclusive item from Taj Sons. Crafted for elegance and durability, it's the perfect addition to your collection.";
        }
        document.getElementById('detail-desc').textContent = desc;

        // Render Actions (Add to Cart / Notify Me)
        const actionsContainer = document.getElementById('detail-actions');
        if (product.inStock) {
            actionsContainer.innerHTML = `
                <button onclick="addToCart('${product.id}')" class="btn" style="flex: 1; display: flex; justify-content: center; align-items: center; gap: 10px;">
                    <i class="fas fa-shopping-bag"></i> Add to Cart
                </button>
            `;
        } else {
            const isNotified = sessionStorage.getItem(`notified_${product.id}`);
            actionsContainer.innerHTML = `
                <button onclick="logInterest('${product.id}', '${product.name}')" 
                    id="detail-notify-btn"
                    class="btn" 
                    ${isNotified ? 'disabled' : ''}
                    style="flex: 1; background: ${isNotified ? '#1fb468' : '#333'}; color: ${isNotified ? '#fff' : 'var(--accent-color)'}; border: 1px solid var(--accent-color); cursor: ${isNotified ? 'default' : 'pointer'};">
                    ${isNotified ? 'Notified! ✅' : '🔔 Notify Me'}
                </button>
            `;
        }

        // Show Content
        document.getElementById('loading').style.display = 'none';
        document.getElementById('product-detail-container').style.display = 'grid';

    } catch (err) {
        console.error(err);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error-msg').style.display = 'block';
    }
}
