// ==========================================================================
// LUMINA EDITORIAL BLOG - ADMIN CMS & MARKDOWN EDITOR (admin.js)
// ==========================================================================

import { showToast } from './main.js';

let editingPostId = null;
let isSlugManual = false;

// Sample Curated Unsplash Cover Presets
const PRESET_COVERS = [
  { label: 'Minimalist Desk', url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Books & Library', url: 'https://images.unsplash.com/photo-1507842229451-7f01be7fe616?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Code & Tech', url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Typewriter / Prose', url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Kyoto / Architecture', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Abstract Design', url: 'https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?auto=format&fit=crop&w=1200&q=80' }
];

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initAuthForm();
  initEditorTabs();
  initViewModes();
  initToolbar();
  initSlugSync();
  initPresetCovers();
  initSaveAction();
  initNewPostButton();
  initLogout();
  setupLivePreview();
});

// 1. Authentication Status Check
async function checkAuth() {
  try {
    const res = await fetch('/api/admin/check');
    const data = await res.json();
    const overlay = document.getElementById('auth-overlay');

    if (data.authenticated) {
      if (overlay) overlay.style.display = 'none';
      loadPostsTable();
    } else {
      if (overlay) overlay.style.display = 'flex';
    }
  } catch (err) {
    console.error('Auth check error:', err);
  }
}

// 2. Auth Login Form
function initAuthForm() {
  const form = document.getElementById('admin-login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passwordInput = document.getElementById('admin-password-input');
    const password = passwordInput.value.trim();
    if (!password) return;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (res.ok) {
        document.getElementById('auth-overlay').style.display = 'none';
        showToast('Welcome back, Editor!', 'success');
        passwordInput.value = '';
        loadPostsTable();
      } else {
        showToast(data.error || 'Invalid password', 'error');
        passwordInput.focus();
      }
    } catch (err) {
      showToast('Error communicating with server', 'error');
    }
  });
}

// 3. Navigation Tabs (Write Story vs Manage Stories)
function initEditorTabs() {
  const tabEditor = document.getElementById('tab-btn-editor');
  const tabManage = document.getElementById('tab-btn-manage');
  const workspaceSection = document.getElementById('editor-workspace');
  const manageSection = document.getElementById('posts-management-section');

  if (tabEditor && tabManage) {
    tabEditor.addEventListener('click', () => {
      tabEditor.classList.add('active');
      tabManage.classList.remove('active');
      workspaceSection.style.display = 'grid';
      manageSection.style.display = 'none';
    });

    tabManage.addEventListener('click', () => {
      tabManage.classList.add('active');
      tabEditor.classList.remove('active');
      workspaceSection.style.display = 'none';
      manageSection.style.display = 'block';
      loadPostsTable();
    });
  }
}

// 4. View Mode Toggles (Edit / Split / Preview)
function initViewModes() {
  const paneContainer = document.querySelector('.editor-pane-container');
  const buttons = document.querySelectorAll('.view-mode-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode; // 'split', 'edit', 'preview'

      paneContainer.classList.remove('view-edit', 'view-preview');
      if (mode === 'edit') paneContainer.classList.add('view-edit');
      if (mode === 'preview') paneContainer.classList.add('view-preview');
    });
  });
}

// 5. Formatting Toolbar Actions
function initToolbar() {
  const textarea = document.getElementById('post-content');
  if (!textarea) return;

  const insertFormatting = (prefix, suffix = '', defaultText = '') => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end) || defaultText;
    const replacement = prefix + selected + suffix;

    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    renderLivePreview();
  };

  document.getElementById('tb-bold')?.addEventListener('click', () => insertFormatting('**', '**', 'bold text'));
  document.getElementById('tb-italic')?.addEventListener('click', () => insertFormatting('*', '*', 'italic text'));
  document.getElementById('tb-h2')?.addEventListener('click', () => insertFormatting('\n## ', '\n', 'Subheading'));
  document.getElementById('tb-h3')?.addEventListener('click', () => insertFormatting('\n### ', '\n', 'Small Heading'));
  document.getElementById('tb-quote')?.addEventListener('click', () => insertFormatting('\n> ', '\n', 'Quote text here'));
  document.getElementById('tb-pullquote')?.addEventListener('click', () => insertFormatting('\n> [!PULLQUOTE]\n> ', '\n', 'A memorable, standout thought that captures the essence of this idea.'));
  document.getElementById('tb-callout')?.addEventListener('click', () => insertFormatting('\n> [!NOTE]\n> ', '\n', 'An important takeaway or contextual insight for the reader.'));
  document.getElementById('tb-code')?.addEventListener('click', () => insertFormatting('\n```javascript\n', '\n```\n', '// code here'));
  document.getElementById('tb-link')?.addEventListener('click', () => insertFormatting('[', '](https://example.com)', 'Link text'));
  document.getElementById('tb-image')?.addEventListener('click', () => insertFormatting('![', '](https://images.unsplash.com/photo-1507842229451-7f01be7fe616)', 'Image caption description'));
  document.getElementById('tb-list')?.addEventListener('click', () => insertFormatting('\n- ', '', 'List item'));
  document.getElementById('tb-ad')?.addEventListener('click', () => {
    insertFormatting('\n\n<!-- ad-slot-in-article -->\n\n', '', '');
    showToast('In-Article Ad Slot placeholder inserted');
  });
}

// 6. Live Markdown Preview
function setupLivePreview() {
  const textarea = document.getElementById('post-content');
  const titleInput = document.getElementById('post-title');

  if (textarea) textarea.addEventListener('input', renderLivePreview);
  if (titleInput) titleInput.addEventListener('input', renderLivePreview);
}

function renderLivePreview() {
  const textarea = document.getElementById('post-content');
  const titleInput = document.getElementById('post-title');
  const preview = document.getElementById('preview-content');
  if (!preview) return;

  const title = titleInput?.value || 'Untitled Story';
  const content = textarea?.value || '';

  // Use window.marked if loaded, otherwise fallback
  let html = '';
  if (window.marked && typeof window.marked.parse === 'function') {
    // Configure image renderer for figures
    const renderer = {
      image({ href, title, text }) {
        const caption = title || text;
        if (caption && caption.trim()) {
          return `
            <figure class="article-figure">
              <img src="${href}" alt="${text || ''}" loading="lazy" class="article-inline-img">
              <figcaption class="article-figcaption">${caption}</figcaption>
            </figure>
          `;
        }
        return `<img src="${href}" alt="${text || ''}" loading="lazy" class="article-inline-img">`;
      }
    };
    window.marked.use({ renderer });
    html = window.marked.parse(content);
  } else {
    // Simple fallback preview
    html = content
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n\n/gim, '</p><p>');
    html = `<p>${html}</p>`;
  }

  // Handle callouts and pull quotes
  html = html.replace(/<blockquote>\s*<p>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|PULLQUOTE)\]\s*(?:<br>)?([\s\S]*?)<\/blockquote>/gi, (match, type, content) => {
    const alertType = type.toLowerCase();
    let cleanContent = content.trim();
    if (cleanContent.endsWith('</p>')) {
      cleanContent = cleanContent.slice(0, -4).trim();
    }
    
    if (alertType === 'pullquote') {
      return `
        <blockquote class="pull-quote">
          <span class="pull-quote-symbol">“</span>
          <div class="pull-quote-content"><p>${cleanContent}</p></div>
        </blockquote>
      `;
    }

    const configs = {
      note: { icon: '💡', title: 'Editorial Note' },
      tip: { icon: '✨', title: 'Key Insight' },
      warning: { icon: '⚠️', title: 'Caution' },
      important: { icon: '📌', title: 'Important' }
    };
    const cfg = configs[alertType] || configs.note;

    return `
      <div class="callout callout-${alertType}">
        <div class="callout-header">
          <span class="callout-icon">${cfg.icon}</span>
          <span class="callout-title">${cfg.title}</span>
        </div>
        <div class="callout-body">
          <p>${cleanContent}</p>
        </div>
      </div>
    `;
  });

  // Handle ad-slot-in-article comment helper
  html = html.replace(/<!-- ad-slot-in-article -->/g, `
    <div class="ad-wrapper" style="margin: 2rem 0;">
      <div class="ad-slot-box" style="border-style: solid;">
        <span class="ad-disclaimer">Advertisement Slot (In-Article)</span>
        <div class="ad-placeholder-content">
          <span>Ad display zone (#ad-slot-in-article)</span>
        </div>
      </div>
    </div>
  `);

  preview.innerHTML = `
    <h1 class="article-title" style="font-size: 2.2rem; margin-bottom: 1.5rem;">${title}</h1>
    <div class="article-prose">${html}</div>
  `;
}

// 7. Auto-Generate Slug from Title
function initSlugSync() {
  const titleInput = document.getElementById('post-title');
  const slugInput = document.getElementById('post-slug');

  if (titleInput && slugInput) {
    titleInput.addEventListener('input', () => {
      if (!isSlugManual && !editingPostId) {
        slugInput.value = titleInput.value
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }
    });

    slugInput.addEventListener('input', () => {
      isSlugManual = true;
    });
  }
}

// 8. Preset Cover Images
function initPresetCovers() {
  const container = document.getElementById('preset-covers-wrap');
  const coverInput = document.getElementById('post-cover');
  const previewImg = document.getElementById('cover-preview-img');

  if (!container || !coverInput) return;

  container.innerHTML = PRESET_COVERS.map((preset, idx) => `
    <img src="${preset.url}" alt="${preset.label}" title="${preset.label}" class="preset-thumb ${idx === 0 ? 'active' : ''}" data-url="${preset.url}">
  `).join('');

  container.querySelectorAll('.preset-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      container.querySelectorAll('.preset-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      coverInput.value = thumb.dataset.url;
      if (previewImg) previewImg.src = thumb.dataset.url;
    });
  });

  coverInput.addEventListener('input', () => {
    if (previewImg) {
      previewImg.src = coverInput.value || PRESET_COVERS[0].url;
    }
  });
}

// 9. Save / Publish Post Action
function initSaveAction() {
  const saveBtn = document.getElementById('btn-save-post');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const category = document.getElementById('post-category').value.trim() || 'General';
    const tags = document.getElementById('post-tags').value.trim();
    const coverImage = document.getElementById('post-cover').value.trim();
    const excerpt = document.getElementById('post-excerpt').value.trim();
    const slug = document.getElementById('post-slug').value.trim();
    const featured = document.getElementById('post-featured').checked;

    if (!title) {
      showToast('Please enter an essay title', 'error');
      document.getElementById('post-title').focus();
      return;
    }
    if (!content) {
      showToast('Please write some content before publishing', 'error');
      document.getElementById('post-content').focus();
      return;
    }

    const payload = {
      title,
      content,
      category,
      tags,
      coverImage: coverImage || PRESET_COVERS[0].url,
      excerpt,
      slug,
      featured
    };

    saveBtn.disabled = true;
    saveBtn.innerHTML = 'Publishing...';

    try {
      const url = editingPostId ? `/api/admin/posts/${editingPostId}` : '/api/admin/posts';
      const method = editingPostId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        showToast(editingPostId ? 'Story updated successfully!' : 'Story published successfully!', 'success');
        resetEditor();
        loadPostsTable();
        // Switch to manage tab
        document.getElementById('tab-btn-manage').click();
      } else {
        showToast(data.error || 'Failed to save story', 'error');
      }
    } catch (err) {
      showToast('Network error, please try again.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Publish Story';
    }
  });
}

// 10. Reset Editor for New Post
function initNewPostButton() {
  const newBtn = document.getElementById('btn-new-post');
  if (!newBtn) return;

  newBtn.addEventListener('click', () => {
    resetEditor();
    document.getElementById('tab-btn-editor').click();
    showToast('Ready to draft a new story');
  });
}

function resetEditor() {
  editingPostId = null;
  isSlugManual = false;
  document.getElementById('post-title').value = '';
  document.getElementById('post-content').value = '';
  document.getElementById('post-category').value = 'Technology';
  document.getElementById('post-tags').value = '';
  document.getElementById('post-cover').value = PRESET_COVERS[0].url;
  document.getElementById('cover-preview-img').src = PRESET_COVERS[0].url;
  document.getElementById('post-excerpt').value = '';
  document.getElementById('post-slug').value = '';
  document.getElementById('post-featured').checked = false;
  document.getElementById('editor-header-title').textContent = 'Drafting New Story';
  document.getElementById('btn-save-post').textContent = 'Publish Story';
  renderLivePreview();
}

// 11. Load Posts Table in Management Tab
async function loadPostsTable() {
  const tbody = document.getElementById('admin-posts-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/posts');
    const data = await res.json();
    const posts = data.posts || [];

    if (posts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">No posts published yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = posts.map(post => {
      const dateStr = new Date(post.publishedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      return `
        <tr>
          <td>
            <span class="table-post-title">${post.title}</span>
            <span class="table-post-slug">/post/${post.slug}</span>
          </td>
          <td><span class="category-tag">${post.category}</span></td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${dateStr}</td>
          <td>${post.featured ? '<span style="color:#d97706; font-weight:700;">★ Featured</span>' : '<span style="color:var(--text-muted)">Standard</span>'}</td>
          <td>
            <div class="table-actions">
              <a href="/post/${post.slug}" target="_blank" class="btn-sm" title="View Published Post">View</a>
              <button class="btn-sm btn-edit-post" data-id="${post.id}">Edit</button>
              <button class="btn-sm btn-sm-danger btn-delete-post" data-id="${post.id}" data-title="${post.title.replace(/"/g, '&quot;')}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach Edit button events
    tbody.querySelectorAll('.btn-edit-post').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        editPost(id);
      });
    });

    // Attach Delete button events
    tbody.querySelectorAll('.btn-delete-post').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const title = btn.dataset.title;
        deletePost(id, title);
      });
    });
  } catch (err) {
    console.error('Error loading posts table:', err);
  }
}

// 12. Edit Post Handler
async function editPost(id) {
  try {
    const res = await fetch(`/api/posts`);
    const data = await res.json();
    const post = (data.posts || []).find(p => p.id === id);
    if (!post) {
      showToast('Post not found', 'error');
      return;
    }

    editingPostId = post.id;
    isSlugManual = true;

    document.getElementById('post-title').value = post.title || '';
    document.getElementById('post-content').value = post.content || '';
    document.getElementById('post-category').value = post.category || 'General';
    document.getElementById('post-tags').value = (post.tags || []).join(', ');
    document.getElementById('post-cover').value = post.coverImage || '';
    document.getElementById('cover-preview-img').src = post.coverImage || PRESET_COVERS[0].url;
    document.getElementById('post-excerpt').value = post.excerpt || '';
    document.getElementById('post-slug').value = post.slug || '';
    document.getElementById('post-featured').checked = Boolean(post.featured);

    document.getElementById('editor-header-title').textContent = `Editing: ${post.title.substring(0, 32)}...`;
    document.getElementById('btn-save-post').textContent = 'Update Story';

    renderLivePreview();
    document.getElementById('tab-btn-editor').click();
    showToast('Loaded story into editor');
  } catch (err) {
    showToast('Failed to load post for editing', 'error');
  }
}

// 13. Delete Post Handler
async function deletePost(id, title) {
  const confirmed = window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok) {
      showToast('Story deleted', 'success');
      loadPostsTable();
    } else {
      showToast(data.error || 'Failed to delete story', 'error');
    }
  } catch (err) {
    showToast('Error deleting story', 'error');
  }
}

// 14. Admin Logout
function initLogout() {
  const logoutBtn = document.getElementById('btn-admin-logout');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      document.getElementById('auth-overlay').style.display = 'flex';
      showToast('Logged out of admin session');
    } catch (err) {
      console.error(err);
    }
  });
}
