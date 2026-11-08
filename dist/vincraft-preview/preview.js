'use strict';
// Demonstration data only. The original application uses PHP and MySQL on XAMPP.
const categories = ['Builds', 'Redstone', 'News', 'Tutorial', 'Mods'];
const initialPosts = [
  {id:1,title:'Cherry Blossom House',category:'Builds',image:'assets/6.jpg',description:'An illustrative community post presenting a house surrounded by cherry blossom trees. This sample demonstrates how Vincraft displays a build, its category, and community interactions.'},
  {id:2,title:'Modern Mansion',category:'Builds',image:'assets/5.jpg',description:'An illustrative post featuring a modern Minecraft mansion. Visitors can explore the detail page and try the preview Like and Comment controls.'},
  {id:3,title:'Interior Design Showcase',category:'Tutorial',image:'assets/3.jpg',description:'An illustrative interior-design post used to demonstrate title searches, category filters, and the post detail layout.'}
];
let posts, member = false, nextId = 4;
const view = document.querySelector('#view');
const navigation = document.querySelector('#navigation');
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const options = selected => categories.map(category => `<option${category === selected ? ' selected' : ''}>${category}</option>`).join('');
function initialize() { posts = initialPosts.map(post => ({...post, author:'Sample Creator', likes:0, liked:false, comments:[], report:'', video:'', own:false})); member=false; nextId=4; }
function safeVideoURL(value) {
  try { const url = new URL(String(value).trim()); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function route() { const [page, query=''] = (location.hash.slice(1) || 'home').split('?'); return {page, params:new URLSearchParams(query)}; }
function go(hash) { if (location.hash === '#'+hash) render(); else location.hash=hash; }
function card(post) {
  return `<article class="card"><img src="${post.image}" alt="${escapeHTML(post.title)}" class="card-image"><div class="card-content"><h2 class="card-title">${escapeHTML(post.title)}</h2><p class="card-meta">By ${escapeHTML(post.author)} · Sample post</p><span class="card-category">${escapeHTML(post.category)}</span><a href="#post?id=${post.id}" class="btn btn-primary btn-block">View Details</a></div></article>`;
}
function showCards(items) { return items.length ? `<div class="card-grid">${items.map(card).join('')}</div>` : '<div class="no-results"><h2>No posts found</h2><p>Try another search or category.</p></div>'; }
function render() {
  const {page, params} = route();
  navigation.innerHTML = `<li><a href="#home"${page==='home'?' aria-current="page"':''}>Home</a></li><li><a href="#browse"${page==='browse'?' aria-current="page"':''}>Browse Posts</a></li>` + (member ? '<li><a href="#create">Create Post</a></li><li><a href="#mine">My Posts</a></li><li><button type="button" data-action="logout">End Preview Session</button></li>' : '<li><a href="#login">Login</a></li><li><a href="#register">Register</a></li>');
  if (page === 'home') {
    view.innerHTML = `<div class="hero"><h1>Welcome to VinCraft Community</h1><p>Discover content from our community members</p></div><div class="login-reminder">${member?'You are exploring as Preview Visitor. All interactions remain in this preview.':'Explore sample posts or <a href="#login">start a preview session</a> to try likes, comments, and post creation.'}</div><details class="source-scope"><summary>About This Coursework Preview</summary><p>The original PHP and MySQL application includes visitor, member, and administrator workflows.</p><ul><li><strong>Visitors:</strong> browse recent posts, search titles, and filter categories.</li><li><strong>Members:</strong> create and edit posts, add optional video links, like content, comment, and submit reports.</li><li><strong>Administrators:</strong> manage users, categories, posts, comments, and reports in dedicated management pages.</li></ul><p>Member interactions are simulated here. Account authentication, file uploads, persistent storage, and administrator operations require the original application.</p></details><h2 class="section-heading">Latest Posts</h2>${showCards(posts.slice(0,3))}<div class="btn-center"><a href="#browse" class="btn btn-primary">Browse All Posts</a></div>`;
  } else if (page === 'browse') {
    const query = params.get('search') || '', category = params.get('category') || '';
    const filtered = posts.filter(post => post.title.toLowerCase().includes(query.toLowerCase()) && (!category || post.category === category));
    view.innerHTML = `<h1 class="section-heading">Browse Posts</h1><div class="search-filter"><form id="filter-form"><div><label for="search">Search by Title</label><input id="search" name="search" class="form-control" value="${escapeHTML(query)}" placeholder="Search by title..."></div><div><label for="category">Category</label><select id="category" name="category" class="form-control"><option value="">All Categories</option>${options(category)}</select></div><button class="btn btn-primary">Filter</button><a href="#browse" class="btn btn-secondary">Clear</a></form></div><p class="result-count" role="status">${filtered.length} sample ${filtered.length===1?'post':'posts'} found</p>${showCards(filtered)}`;
  } else if (page === 'login' || page === 'register') {
    view.innerHTML = `<div class="form-container"><h1 style="color:#667eea;text-align:center;margin-bottom:24px">${page==='login'?'Login':'Register'}</h1><p>This screen represents the original account interface. Account registration and authentication require the PHP application and MySQL database.</p><fieldset disabled class="preview-account-fields" style="border:0"><div class="form-group"><label for="username">Username</label><input id="username" class="form-control" placeholder="Unavailable in this preview"></div><div class="form-group"><label for="password">Password</label><input id="password" type="password" class="form-control" placeholder="No password required"></div></fieldset><button type="button" data-action="start" class="btn btn-primary btn-block">Continue as Preview Visitor</button><p class="sample-note">No account is created. Please do not enter real credentials.</p></div>`;
  } else if (page === 'post') {
    const post = posts.find(item => item.id === Number(params.get('id')));
    if (!post) { view.innerHTML='<div class="no-results"><h1>Post unavailable</h1><a href="#browse" class="btn btn-primary">Browse Posts</a></div>'; }
    else view.innerHTML = `<a class="back-link" href="#browse">← Back to Browse Posts</a><article class="post-detail"><div class="post-header"><h1 class="post-title">${escapeHTML(post.title)}</h1><p class="post-meta">By ${escapeHTML(post.author)} · <span class="card-category">${escapeHTML(post.category)}</span></p></div><img class="post-image" src="${post.image}" alt="${escapeHTML(post.title)}"><h2>Description</h2><p class="post-description">${escapeHTML(post.description)}</p>${post.video?`<h2>Video Link</h2><p><a class="video-link" href="${escapeHTML(post.video)}" target="_blank" rel="noopener noreferrer">Open the linked video ↗</a></p>`:''}<div class="post-actions">${member?`<button type="button" data-action="like" data-id="${post.id}" aria-pressed="${post.liked}" class="like-btn${post.liked?' liked':''}">${post.liked?'Liked':'Like'}</button><span>${post.likes} ${post.likes===1?'like':'likes'}</span>${post.own?`<a href="#edit?id=${post.id}" class="btn btn-primary">Edit Post</a><button type="button" class="btn btn-danger" data-action="delete-post" data-id="${post.id}">Delete Preview Post</button>`:''}`:'<a href="#login" class="btn btn-primary">Start a Preview Session</a>'}</div>${member&&!post.own?`<section class="report-section" aria-label="Report this post">${post.report?'<p class="report-status" role="status">Your preview report has been recorded in this session. No report has been sent to an administrator.</p>':`<details><summary>Report This Post</summary><p class="sample-note">Try the reporting workflow using a sample reason. Nothing is sent or saved to a server.</p><form id="report-form" data-id="${post.id}"><div class="form-group"><label for="report-reason">Reason (15–250 characters)</label><textarea id="report-reason" name="reason" class="form-control" required minlength="15" maxlength="250" rows="3"></textarea></div><button class="btn btn-danger">Submit Preview Report</button></form></details>`}</section>`:''}<div class="comments-section"><h2>Comments (${post.comments.length})</h2>${post.comments.map((comment,index)=>`<div class="comment"><div class="comment-header"><span class="comment-author">Preview Visitor</span>${member?`<button type="button" class="comment-delete" data-action="delete-comment" data-id="${post.id}" data-index="${index}">Delete</button>`:''}</div><p class="comment-text">${escapeHTML(comment)}</p></div>`).join('') || '<p class="empty-message">No preview comments yet.</p>'}${member?`<form id="comment-form" data-id="${post.id}" style="margin-top:24px"><div class="form-group"><label for="comment">Add a Preview Comment</label><textarea id="comment" name="comment" class="form-control" required maxlength="1000"></textarea></div><button class="btn btn-primary">Add Comment</button></form>`:''}</div></article>`;
  } else if (page === 'mine') {
    view.innerHTML = `<h1 class="section-heading">My Preview Posts</h1>${member?`${showCards(posts.filter(post=>post.own))}<a href="#create" class="btn btn-primary">Create Preview Post</a>`:'<div class="no-results"><a href="#login">Start a preview session to create posts.</a></div>'}`;
  } else if (page === 'create' || page === 'edit') {
    const post = posts.find(item => item.id === Number(params.get('id')) && item.own);
    if (!member || (page==='edit' && !post)) { view.innerHTML='<div class="no-results"><a href="#login">Start a preview session to continue.</a></div>'; }
    else view.innerHTML=`<div class="form-container"><h1>${post?'Edit':'Create'} Preview Post</h1><p class="sample-note">Use sample content. Nothing is uploaded or saved to a server.</p><form id="post-form" data-id="${post?.id||''}"><div class="form-group"><label for="post-title">Title (5–75 characters)</label><input id="post-title" name="title" class="form-control" required minlength="5" maxlength="75" value="${escapeHTML(post?.title||'')}"></div><div class="form-group"><label for="post-category">Category</label><select id="post-category" name="category" class="form-control">${options(post?.category||'Builds')}</select></div><div class="form-group"><label for="post-description">Description (15–250 characters)</label><textarea id="post-description" name="description" class="form-control" required minlength="15" maxlength="250">${escapeHTML(post?.description||'')}</textarea></div><div class="form-group"><label for="post-image">Sample Cover Image</label><select id="post-image" name="image" class="form-control">${[['assets/6.jpg','Cherry Blossom House'],['assets/5.jpg','Modern Mansion'],['assets/3.jpg','Interior Showcase']].map(([path,label])=>`<option value="${path}"${path===post?.image?' selected':''}>${label}</option>`).join('')}</select></div><div class="form-group"><label for="post-video">Video Link (Optional)</label><input id="post-video" name="video" type="url" class="form-control" placeholder="https://example.com/video" value="${escapeHTML(post?.video||'')}" aria-describedby="video-help"><p class="sample-note" id="video-help">Use an HTTP or HTTPS link. Videos are linked rather than uploaded.</p></div><div class="form-actions"><button class="btn btn-primary">Save Preview Post</button><a class="btn btn-secondary" href="#mine">Cancel</a></div></form></div>`;
  } else { go('home'); return; }
}
document.addEventListener('click', event => {
  const button=event.target.closest('[data-action]'); if (!button) return;
  const post=posts.find(item=>item.id===Number(button.dataset.id));
  if (button.dataset.action==='start') { member=true; go('home'); }
  if (button.dataset.action==='logout') { member=false; go('home'); }
  if (member && post && button.dataset.action==='like') { post.liked=!post.liked; post.likes=post.liked?1:0; render(); }
  if (member && post && button.dataset.action==='delete-comment') { post.comments.splice(Number(button.dataset.index),1); render(); }
  if (member && post?.own && button.dataset.action==='delete-post') { posts=posts.filter(item=>item.id!==post.id);go('mine'); }
});
document.addEventListener('submit', event => {
  event.preventDefault(); const form=event.target; const data=new FormData(form);
  if (form.id==='filter-form') { const params=new URLSearchParams({search:String(data.get('search')).trim(),category:String(data.get('category'))});go('browse?'+params); }
  if (member && form.id==='comment-form') { const post=posts.find(item=>item.id===Number(form.dataset.id));const comment=String(data.get('comment')).trim(); if(post && comment) {post.comments.push(comment);render();} }
  if (member && form.id==='report-form') {
    const post=posts.find(item=>item.id===Number(form.dataset.id));
    const reason=String(data.get('reason')).trim();
    if(post && !post.own && !post.report && reason.length>=15 && reason.length<=250) {post.report=reason;render();}
  }
  if (member && form.id==='post-form') {
    const title=String(data.get('title')).trim(),description=String(data.get('description')).trim();
    if(title.length<5||title.length>75||description.length<15||description.length>250)return;
    const videoInput=form.querySelector('[name=video]');
    const videoValue=String(data.get('video')).trim(),video=safeVideoURL(videoValue);
    if(videoValue&&!video) {videoInput.setCustomValidity('Enter a valid HTTP or HTTPS link.');videoInput.reportValidity();return;}
    videoInput.setCustomValidity('');
    let post=posts.find(item=>item.id===Number(form.dataset.id)&&item.own);
    const values={title,description,category:String(data.get('category')),image:String(data.get('image')),video};
    if(post)Object.assign(post,values);else {post={...values,id:nextId++,author:'Preview Visitor',own:true,likes:0,liked:false,comments:[],report:''};posts.unshift(post);}
    go('post?id='+post.id);
  }
});
document.addEventListener('input', event=>{if(event.target.id==='post-video')event.target.setCustomValidity('');});
document.querySelector('#reset-preview').addEventListener('click',()=>{initialize();go('home');});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);document.querySelector('#content').focus({preventScroll:true});});
initialize();render();
