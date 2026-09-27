import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'data', 'posts.json');

// Helper to calculate reading time
export function calculateReadingTime(text) {
  if (!text) return '1 min read';
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

// Helper to generate a slug
export function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class PostDatabase {
  constructor(filePath = DATA_FILE) {
    this.filePath = filePath;
    this.cache = null;
  }

  async init() {
    try {
      await fs.access(this.filePath);
    } catch {
      // If file doesn't exist, create empty array
      await this.savePosts([]);
    }
  }

  async getAllPosts() {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const posts = JSON.parse(data || '[]');
      // Sort newest first
      return posts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    } catch (err) {
      console.error('Error reading posts database:', err);
      return [];
    }
  }

  async savePosts(posts) {
    const tempPath = `${this.filePath}.tmp`;
    const json = JSON.stringify(posts, null, 2);
    // Atomic write to prevent file corruption
    await fs.writeFile(tempPath, json, 'utf-8');
    await fs.rename(tempPath, this.filePath);
    this.cache = posts;
  }

  async getPostBySlug(slug) {
    const posts = await this.getAllPosts();
    return posts.find(p => p.slug === slug) || null;
  }

  async getPostById(id) {
    const posts = await this.getAllPosts();
    return posts.find(p => p.id === id) || null;
  }

  async queryPosts({ category, search, tag, limit, offset = 0 } = {}) {
    let posts = await this.getAllPosts();

    if (category && category.toLowerCase() !== 'all') {
      posts = posts.filter(p => p.category && p.category.toLowerCase() === category.toLowerCase());
    }

    if (tag) {
      posts = posts.filter(p => p.tags && p.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      posts = posts.filter(p =>
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.excerpt && p.excerpt.toLowerCase().includes(q)) ||
        (p.content && p.content.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    const total = posts.length;
    if (limit) {
      posts = posts.slice(offset, offset + limit);
    }

    return { posts, total };
  }

  async createPost(postData) {
    const posts = await this.getAllPosts();
    
    // Auto-generate or sanitize slug
    let baseSlug = postData.slug ? generateSlug(postData.slug) : generateSlug(postData.title);
    if (!baseSlug) baseSlug = `post-${Date.now()}`;
    
    let uniqueSlug = baseSlug;
    let counter = 1;
    while (posts.some(p => p.slug === uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const now = new Date().toISOString();
    const readingTime = calculateReadingTime(postData.content);

    const newPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: postData.title.trim(),
      slug: uniqueSlug,
      category: postData.category ? postData.category.trim() : 'General',
      tags: Array.isArray(postData.tags) 
        ? postData.tags.map(t => t.trim()).filter(Boolean)
        : (postData.tags ? postData.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      coverImage: postData.coverImage ? postData.coverImage.trim() : 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80',
      excerpt: postData.excerpt ? postData.excerpt.trim() : (postData.content ? postData.content.substring(0, 160).replace(/[#*`_]/g, '') + '...' : ''),
      content: postData.content || '',
      author: postData.author || {
        name: 'Aria Thorne',
        role: 'Editor & Essayist',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80'
      },
      featured: Boolean(postData.featured),
      readingTime: readingTime,
      publishedAt: postData.publishedAt || now,
      updatedAt: now
    };

    posts.unshift(newPost);
    await this.savePosts(posts);
    return newPost;
  }

  async updatePost(id, postData) {
    const posts = await this.getAllPosts();
    const index = posts.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Post with id "${id}" not found`);
    }

    const existing = posts[index];
    let uniqueSlug = existing.slug;
    
    // If slug changed, ensure uniqueness
    if (postData.slug && postData.slug !== existing.slug) {
      const baseSlug = generateSlug(postData.slug);
      uniqueSlug = baseSlug;
      let counter = 1;
      while (posts.some(p => p.slug === uniqueSlug && p.id !== id)) {
        uniqueSlug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    const readingTime = postData.content ? calculateReadingTime(postData.content) : existing.readingTime;

    const updatedPost = {
      ...existing,
      title: postData.title !== undefined ? postData.title.trim() : existing.title,
      slug: uniqueSlug,
      category: postData.category !== undefined ? postData.category.trim() : existing.category,
      tags: postData.tags !== undefined 
        ? (Array.isArray(postData.tags) ? postData.tags : postData.tags.split(',').map(t => t.trim()).filter(Boolean))
        : existing.tags,
      coverImage: postData.coverImage !== undefined ? postData.coverImage.trim() : existing.coverImage,
      excerpt: postData.excerpt !== undefined ? postData.excerpt.trim() : existing.excerpt,
      content: postData.content !== undefined ? postData.content : existing.content,
      featured: postData.featured !== undefined ? Boolean(postData.featured) : existing.featured,
      readingTime: readingTime,
      updatedAt: new Date().toISOString()
    };

    posts[index] = updatedPost;
    await this.savePosts(posts);
    return updatedPost;
  }

  async deletePost(id) {
    const posts = await this.getAllPosts();
    const filtered = posts.filter(p => p.id !== id);
    if (filtered.length === posts.length) {
      return false;
    }
    await this.savePosts(filtered);
    return true;
  }
  async incrementView(slug) {
    const posts = await this.getAllPosts();
    const index = posts.findIndex(p => p.slug === slug);
    if (index === -1) return;
    const post = posts[index];
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const timestamps = Array.isArray(post.viewTimestamps) ? post.viewTimestamps : [];
    const recent = timestamps.filter(t => t > oneWeekAgo);
    recent.push(now);
    post.viewTimestamps = recent;
    post.totalViews = (post.totalViews || 0) + 1;
    await this.savePosts(posts);
  }

  async getPopularPosts(limit = 5) {
    const posts = await this.getAllPosts();
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const withScores = posts.map(p => {
      const timestamps = Array.isArray(p.viewTimestamps) ? p.viewTimestamps : [];
      const weeklyViews = timestamps.filter(t => t > oneWeekAgo).length;
      return { post: p, weeklyViews };
    });

    withScores.sort((a, b) => b.weeklyViews - a.weeklyViews);

    const hasAnyViews = withScores.some(s => s.weeklyViews > 0);
    const ranked = hasAnyViews ? withScores : posts.map(p => ({ post: p, weeklyViews: 0 }));

    return ranked.slice(0, limit).map(s => s.post);
  }

  async getRelatedPosts(currentPost, limit = 3) {
    const posts = await this.getAllPosts();
    const others = posts.filter(p => p.id !== currentPost.id);
    const currentTags = new Set(currentPost.tags || []);

    const scored = others.map(p => {
      let score = 0;
      if (p.category && currentPost.category && p.category.toLowerCase() === currentPost.category.toLowerCase()) {
        score += 2;
      }
      if (Array.isArray(p.tags)) {
        score += p.tags.filter(t => currentTags.has(t)).length;
      }
      return { post: p, score };
    });

    scored.sort((a, b) => b.score - a.score || new Date(b.post.publishedAt) - new Date(a.post.publishedAt));

    const withScore = scored.filter(s => s.score > 0).map(s => s.post);
    const withoutScore = scored.filter(s => s.score === 0).map(s => s.post);

    return [...withScore, ...withoutScore].slice(0, limit);
  }
  async getCategories() {
    const posts = await this.getAllPosts();
    const categoryMap = {};
    posts.forEach(p => {
      const cat = p.category || 'General';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });
    return Object.entries(categoryMap).map(([name, count]) => ({ name, count }));
  }

  async getTags() {
    const posts = await this.getAllPosts();
    const tagSet = new Set();
    posts.forEach(p => {
      if (Array.isArray(p.tags)) {
        p.tags.forEach(t => tagSet.add(t));
      }
    });
    return Array.from(tagSet);
  }
}

export const db = new PostDatabase();
