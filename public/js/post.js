// ==========================================================================
// LUMINA EDITORIAL BLOG - POST READING SCRIPT (post.js)
// ==========================================================================

import { showToast } from './main.js';

document.addEventListener('DOMContentLoaded', () => {
  initReadingProgressBar();
  initInArticleAdSlot();
  initShareButtons();
  initRelatedPosts();
});

// 1. Reading Progress Bar at the Top of the Page
function initReadingProgressBar() {
  const progressBar = document.getElementById('reading-progress-bar');
  const articleContent = document.querySelector('.article-prose');
  if (!progressBar || !articleContent) return;

  const updateProgress = () => {
    const articleBox = articleContent.getBoundingClientRect();
    const articleHeight = articleContent.offsetHeight;
    const windowHeight = window.innerHeight;
    
    // Calculate how much of the article has scrolled past
    const startOffset = articleContent.offsetTop;
    const scrollY = window.scrollY;
    
    if (scrollY < startOffset) {
      progressBar.style.width = '0%';
    } else {
      const scrollable = articleHeight;
      const progress = Math.min(100, Math.max(0, ((scrollY - startOffset) / (scrollable - windowHeight * 0.5)) * 100));
      progressBar.style.width = `${progress}%`;
    }
  };

  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();
}

// 2. Intelligent In-Article Ad Placement Slot
// Ensures the ad-slot-in-article is placed organically between paragraphs (after paragraph 2)
function initInArticleAdSlot() {
  const prose = document.querySelector('.article-prose');
  const adSlot = document.getElementById('ad-slot-in-article');
  
  if (!prose || !adSlot) return;

  const paragraphs = prose.querySelectorAll('p');
  if (paragraphs.length >= 3) {
    // Insert after the second or third paragraph
    const targetP = paragraphs[1];
    targetP.insertAdjacentElement('afterend', adSlot);
    adSlot.style.display = 'block';
  }
}

// 3. Social Share Buttons & Copy Link
function initShareButtons() {
  const copyBtn = document.getElementById('share-copy-btn');
  const twitterBtn = document.getElementById('share-twitter-btn');
  const linkedinBtn = document.getElementById('share-linkedin-btn');
  
  const currentUrl = window.location.href;
  const postTitle = document.querySelector('.article-title')?.textContent || document.title;

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(currentUrl);
        showToast('Article link copied to clipboard!', 'success');
      } catch (err) {
        // Fallback
        const dummy = document.createElement('input');
        document.body.appendChild(dummy);
        dummy.value = currentUrl;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        showToast('Article link copied to clipboard!', 'success');
      }
    });
  }

  if (twitterBtn) {
    twitterBtn.addEventListener('click', () => {
      const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(postTitle)}&url=${encodeURIComponent(currentUrl)}`;
      window.open(tweetUrl, '_blank', 'width=600,height=400');
    });
  }

  if (linkedinBtn) {
    linkedinBtn.addEventListener('click', () => {
      const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`;
      window.open(shareUrl, '_blank', 'width=600,height=500');
    });
  }
}

// 4. Fetch and render Related Posts
async function initRelatedPosts() {
  const container = document.getElementById('related-posts-grid');
  if (!container) return;

  const currentSlug = window.location.pathname.replace('/post/', '').replace(/\/$/, '');

  try {
    const res = await fetch('/api/posts?limit=3');
    const data = await res.json();
    const posts = (data.posts || []).filter(p => p.slug !== currentSlug).slice(0, 2);

    if (posts.length === 0) {
      container.parentElement.style.display = 'none';
      return;
    }

    container.innerHTML = posts.map(post => `
      <article class="post-card">
        <a href="/post/${post.slug}" class="card-img-wrap">
          <img src="${post.coverImage}" alt="${post.title}" class="card-img" loading="lazy">
        </a>
        <div class="card-content">
          <div class="post-meta-top">
            <span class="category-tag">${post.category}</span>
            <span class="meta-divider">•</span>
            <span class="meta-text">${post.readingTime}</span>
          </div>
          <h3 class="card-title">
            <a href="/post/${post.slug}">${post.title}</a>
          </h3>
          <p class="card-excerpt">${post.excerpt}</p>
        </div>
      </article>
    `).join('');
  } catch (err) {
    console.error('Error loading related posts:', err);
  }
}
