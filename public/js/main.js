// ==========================================================================
// LUMINA EDITORIAL BLOG - CLIENT LOGIC (main.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initMobileMenu();
  initNewsletter();
  initFilterAndSearch();
  initPopularPosts();
});
// Toast Notification System
export function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
  toast.innerHTML = `<span style="color: ${type === 'success' ? '#22c55e' : (type === 'error' ? '#ef4444' : '#38bdf8')}; font-weight:bold;">${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Dark/Light Mode Theme Toggle
function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (!toggleBtn) return;

  const savedTheme = localStorage.getItem('lumina_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcon(true);
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    updateThemeIcon(false);
  }

  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('lumina_theme', newTheme);
    updateThemeIcon(newTheme === 'dark');
    showToast(`Switched to ${newTheme} theme`);
  });
}

function updateThemeIcon(isDark) {
  const iconSpan = document.getElementById('theme-icon');
  if (iconSpan) {
    iconSpan.innerHTML = isDark 
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
}

// Mobile Menu Navigation Toggle
function initMobileMenu() {
  const toggle = document.getElementById('mobile-menu-toggle');
  const nav = document.getElementById('main-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    nav.classList.toggle('open');
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !nav.contains(e.target) && nav.classList.contains('open')) {
      nav.classList.remove('open');
    }
  });
}

// Newsletter Subscription Handler
function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    const email = input.value.trim();
    if (!email) return;

    const btn = form.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Subscribing...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Subscribed successfully!', 'success');
        input.value = '';
      } else {
        showToast(data.error || 'Subscription failed', 'error');
      }
    } catch (err) {
      showToast('Network error, please try again.', 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
}

// Homepage Filtering & Search Logic
function initFilterAndSearch() {
  const gridContainer = document.getElementById('posts-grid');
  if (!gridContainer) return; // Not on homepage

  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const pillsContainer = document.getElementById('category-pills');
  
  let currentCategory = 'all';
  let searchQuery = '';

  // Check URL query parameters for initial state
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('category')) {
    currentCategory = urlParams.get('category');
  }

  // Check URL path for /category/:name routes
  const pathMatch = window.location.pathname.match(/^\/category\/([^/]+)/);
  if (pathMatch) {
    currentCategory = decodeURIComponent(pathMatch[1]);
  }
  if (urlParams.has('q')) {
    searchQuery = urlParams.get('q');
    if (searchInput) searchInput.value = searchQuery;
  }

  // Load Categories & Counts
  async function loadCategories() {
    if (!pillsContainer) return;
    try {
      const res = await fetch('/api/categories');
      const categories = await res.json();
      
      const allCount = categories.reduce((sum, c) => sum + c.count, 0);

      let html = `
        <button class="pill-btn ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">
          All Stories <span class="pill-count">${allCount}</span>
        </button>
      `;

      categories.forEach(cat => {
        const isActive = currentCategory.toLowerCase() === cat.name.toLowerCase();
        html += `
          <button class="pill-btn ${isActive ? 'active' : ''}" data-cat="${cat.name}">
            ${cat.name} <span class="pill-count">${cat.count}</span>
          </button>
        `;
      });

      pillsContainer.innerHTML = html;

      // Attach click events
      pillsContainer.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          pillsContainer.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentCategory = btn.dataset.cat;
          fetchAndRenderPosts();
        });
      });
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }

  // Fetch and Render Posts
  async function fetchAndRenderPosts() {
    try {
      gridContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
          Loading essays...
        </div>
      `;

      let url = `/api/posts?`;
      if (currentCategory && currentCategory !== 'all') {
        url += `category=${encodeURIComponent(currentCategory)}&`;
      }
      if (searchQuery) {
        url += `search=${encodeURIComponent(searchQuery)}&`;
      }

      const res = await fetch(url);
      const data = await res.json();
      const posts = data.posts || [];

      if (posts.length === 0) {
        gridContainer.innerHTML = `
          <div class="empty-state">
            <h3>No stories found</h3>
            <p>We couldn't find any articles matching your search or category filter.</p>
            <button class="btn-primary" id="reset-filter-btn">Clear Filters</button>
          </div>
        `;
        document.getElementById('reset-filter-btn')?.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          searchQuery = '';
          currentCategory = 'all';
          loadCategories();
          fetchAndRenderPosts();
        });
        return;
      }

      gridContainer.innerHTML = posts.map(post => {
        const dateStr = new Date(post.publishedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        return `
          <article class="post-card">
            <a href="/post/${post.slug}" class="card-img-wrap">
              <img src="${post.coverImage}" alt="${post.title}" class="card-img" loading="lazy">
            </a>
            <div class="card-content">
              <div class="post-meta-top">
                <span class="category-tag">${post.category}</span>
                <span class="meta-divider">•</span>
                <span class="meta-text">${dateStr}</span>
              </div>
              <h3 class="card-title">
                <a href="/post/${post.slug}">${post.title}</a>
              </h3>
              <p class="card-excerpt">${post.excerpt}</p>
              <div class="card-footer">
                <div class="card-author">
                  <img src="${post.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80'}" alt="${post.author?.name}" class="card-avatar">
                  <span class="card-author-name">${post.author?.name || 'Aria Thorne'}</span>
                </div>
                <span class="card-read-time">${post.readingTime || '4 min read'}</span>
              </div>
            </div>
          </article>
        `;
      }).join('');
    } catch (err) {
      console.error('Error fetching posts:', err);
      gridContainer.innerHTML = `
        <div class="empty-state">
          <h3>Unable to load posts</h3>
          <p>Please check your connection and try again.</p>
        </div>
      `;
    }
  }

  // Search input events (with debounce)
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      if (searchClear) {
        searchClear.style.display = searchQuery ? 'block' : 'none';
      }
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        fetchAndRenderPosts();
      }, 300);
    });

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClear.style.display = 'none';
        fetchAndRenderPosts();
      });
    }
  }

  loadCategories();
  fetchAndRenderPosts();
}
// Popular This Week Sidebar Widget
async function initPopularPosts() {
  const container = document.getElementById('popular-posts-list');
  if (!container) return;

  try {
    const res = await fetch('/api/popular?limit=5');
    const data = await res.json();
    const posts = data.posts || [];

    if (posts.length === 0) {
      container.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted);">No popular posts yet.</p>`;
      return;
    }

    container.innerHTML = posts.map((post, index) => `
      <a href="/post/${post.slug}" class="popular-post-item">
        <span class="popular-post-rank">${index + 1}</span>
        <div class="popular-post-info">
          <span class="popular-post-title">${post.title}</span>
          <span class="popular-post-meta">${post.category} · ${post.readingTime || '4 min read'}</span>
        </div>
      </a>
    `).join('');
  } catch (err) {
    console.error('Error loading popular posts:', err);
    container.innerHTML = '';
  }
}
// Make showToast available globally
window.showToast = showToast;
