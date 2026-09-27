import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, generateSlug, calculateReadingTime } from './lib/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;
const BLOG_TITLE = process.env.BLOG_TITLE || 'Lumina';
const BLOG_TAGLINE = process.env.BLOG_TAGLINE || 'Essays on Technology, Design & Intentional Living';

// Configure marked with custom figure image renderer
const markedRenderer = {
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

marked.use({ renderer: markedRenderer });
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Helper to render markdown and process pull quotes & callouts
export function renderArticleMarkdown(markdown) {
  let html = marked.parse(markdown || '');

  // Transform callouts and pull quotes
  html = html.replace(/<blockquote>\s*<p>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|PULLQUOTE)\]\s*(?:<br>)?([\s\S]*?)<\/blockquote>/gi, (match, type, content) => {
    const alertType = type.toLowerCase();
    let cleanContent = content.trim();
    if (cleanContent.endsWith('</p>')) {
      cleanContent = cleanContent.slice(0, -4).trim();
    }
    
    if (alertType === 'pullquote') {
      return `
        <blockquote class="pull-quote">
          <span class="pull-quote-symbol" aria-hidden="true">“</span>
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

  return html;
}


// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET || 'lumina-secret-key'));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB
await db.init();

// Simple Auth Middleware for Admin
const authenticateAdmin = (req, res, next) => {
  const token = req.cookies.admin_token || req.headers['x-admin-token'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing admin credentials' });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }
};

// ==========================================
// SSR PAGE ROUTES
// ==========================================

// Homepage
app.get('/', async (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// About Page
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'about.html'));
});

// Contact Page
app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'contact.html'));
});

// Admin Page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Category archive route
app.get('/category/:category', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Search route
app.get('/search', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Individual Blog Post Page (with SEO metadata and pre-rendered HTML)
app.get('/post/:slug', async (req, res) => {
  try {
    const post = await db.getPostBySlug(req.params.slug);
    if (!post) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Post Not Found - ${BLOG_TITLE}</title>
          <link rel="stylesheet" href="/css/style.css">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body class="editorial-theme">
          <div class="container not-found-wrapper">
            <h1>404</h1>
            <h2>Post Not Found</h2>
            <p>The essay you are looking for may have been moved or archived.</p>
            <a href="/" class="btn btn-primary">Return to Homepage</a>
          </div>
        </body>
        </html>
      `);
    }

    // Render markdown to HTML with figures, pull quotes, and callouts
    const contentHtml = renderArticleMarkdown(post.content || '');

    // Read post.html template and inject SEO meta & content
    const templatePath = path.join(__dirname, 'views', 'post.html');
    let html = await fs.readFile(templatePath, 'utf-8');

    const formattedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const fullUrl = `${req.protocol}://${req.get('host')}/post/${post.slug}`;
    const safeExcerpt = (post.excerpt || '').replace(/"/g, '&quot;');
    const safeTitle = `${post.title} — ${BLOG_TITLE}`;

    // Tag list HTML
    const tagsHtml = (post.tags || [])
      .map(tag => `<a href="/search?q=${encodeURIComponent(tag)}" class="post-tag">#${tag}</a>`)
      .join(' ');

    // Replacements for SEO and template variables
    html = html
      .replace(/{{PAGE_TITLE}}/g, safeTitle)
      .replace(/{{META_DESCRIPTION}}/g, safeExcerpt)
      .replace(/{{OG_TITLE}}/g, post.title.replace(/"/g, '&quot;'))
      .replace(/{{OG_DESCRIPTION}}/g, safeExcerpt)
      .replace(/{{OG_IMAGE}}/g, post.coverImage)
      .replace(/{{OG_URL}}/g, fullUrl)
      .replace(/{{POST_TITLE}}/g, post.title)
      .replace(/{{POST_CATEGORY}}/g, post.category)
      .replace(/{{POST_DATE}}/g, formattedDate)
      .replace(/{{POST_READ_TIME}}/g, post.readingTime || '4 min read')
      .replace(/{{POST_COVER_IMAGE}}/g, post.coverImage)
      .replace(/{{POST_AUTHOR_NAME}}/g, post.author?.name || 'Aria Thorne')
      .replace(/{{POST_AUTHOR_ROLE}}/g, post.author?.role || 'Author & Essayist')
      .replace(/{{POST_AUTHOR_AVATAR}}/g, post.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80')
      .replace(/{{POST_TAGS}}/g, tagsHtml)
      .replace(/{{POST_CONTENT}}/g, contentHtml)
      .replace(/{{POST_SLUG}}/g, post.slug)
      .replace(/{{BLOG_TITLE}}/g, BLOG_TITLE)
      .replace(/{{BLOG_TAGLINE}}/g, BLOG_TAGLINE);

    res.send(html);
  } catch (err) {
    console.error('Error rendering post page:', err);
    res.status(500).send('Server Error');
  }
});

// ==========================================
// REST API ROUTES
// ==========================================

// Get all posts with optional filtering & pagination
app.get('/api/posts', async (req, res) => {
  try {
    const { category, search, tag, limit, offset } = req.query;
    const result = await db.queryPosts({
      category,
      search,
      tag,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : 0
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post by slug
app.get('/api/posts/:slug', async (req, res) => {
  try {
    const post = await db.getPostBySlug(req.params.slug);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Get categories with count
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.getCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get all tags
app.get('/api/tags', async (req, res) => {
  try {
    const tags = await db.getTags();
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Handle contact form submission
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Please provide name, email, and a message.' });
  }
  console.log(`[Contact Form Received] From: ${name} (${email}) | Subject: ${subject || 'No Subject'}`);
  res.json({ success: true, message: 'Thank you for reaching out! We will respond shortly.' });
});

// Handle newsletter subscription
app.post('/api/newsletter', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  console.log(`[Newsletter Subscription] ${email}`);
  res.json({ success: true, message: 'Welcome to the Lumina Weekly digest!' });
});

// ==========================================
// ADMIN AUTH & CRUD ROUTES
// ==========================================

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!password || !ADMIN_PASSWORD_HASH) {
    return res.status(401).json({ error: 'Incorrect administrator password' });
  }
  const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!isValid) {
    return res.status(401).json({ error: 'Incorrect administrator password' });
  }
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('admin_token', token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  });
  return res.json({ success: true, token, message: 'Authenticated successfully' });
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Admin Auth Status Check
app.get('/api/admin/check', (req, res) => {
  const token = req.cookies.admin_token || req.headers['x-admin-token'];
  if (!token) {
    return res.json({ authenticated: false });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    return res.json({ authenticated: true });
  } catch (err) {
    return res.json({ authenticated: false });
  }
});

// Admin Create Post
app.post('/api/admin/posts', authenticateAdmin, async (req, res) => {
  try {
    const { title, content, category, tags, coverImage, excerpt, featured, slug } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    const newPost = await db.createPost({
      title,
      content,
      category,
      tags,
      coverImage,
      excerpt,
      featured,
      slug
    });
    res.status(201).json(newPost);
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ error: err.message || 'Failed to create post' });
  }
});

// Admin Update Post
app.put('/api/admin/posts/:id', authenticateAdmin, async (req, res) => {
  try {
    const updatedPost = await db.updatePost(req.params.id, req.body);
    res.json(updatedPost);
  } catch (err) {
    console.error('Error updating post:', err);
    res.status(500).json({ error: err.message || 'Failed to update post' });
  }
});

// Admin Delete Post
app.delete('/api/admin/posts/:id', authenticateAdmin, async (req, res) => {
  try {
    const success = await db.deletePost(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Post not found or already deleted' });
    }
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🌟 Lumina Editorial Blog is running!`);
  console.log(`🌐 Public Website:     http://localhost:${PORT}`);
  console.log(`✍️  Admin CMS Portal:   http://localhost:${PORT}/admin`);
  console.log(`🔑 Admin login is protected — password hash loaded from .env`);
  console.log(`======================================================\n`);
});
