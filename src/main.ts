import './style.scss'
import 'fontawesome-free/css/all.css'

import { CommunityView, LemmyHttp, PostView } from 'lemmy-js-client';
import { createMarkdown } from "../node_modules/safe-marked/src/browser.js";
import * as marked from 'marked';
const renderer = new marked.Renderer();
const originalLink = renderer.link;
renderer.link = function (href, title, text) {
  if (href && href.startsWith('mailto:')) {
    return text;
  }
  return originalLink.call(this, href, title, text);
};
const markdown = createMarkdown({
  marked: {
    headerIds: false,
    renderer: renderer,
  },
});

type Filter = 'all' | 'only' | 'none';

interface MyCommunityView extends CommunityView {
  url: string;
  id: string;
}

let communities: MyCommunityView[] = [];
let currentCommunity: number = 0;
let nsfwFilter: Filter = 'none';
let blockedInstances: string[] = [];
let checkedCommunities: string[] = [];
let jwt: string = '';
let userInstance: string = '';
let userLemmy: LemmyHttp | null = null;

function saveData() {
  localStorage.setItem('blockedInstances', JSON.stringify(blockedInstances));
  localStorage.setItem('checkedCommunities', JSON.stringify(checkedCommunities));
  localStorage.setItem('nsfwFilter', nsfwFilter);
  localStorage.setItem('jwt', jwt);
  localStorage.setItem('userInstance', userInstance);
}

function loadData() {
  if (localStorage.getItem('blockedInstances')) {
    blockedInstances = JSON.parse(localStorage.getItem('blockedInstances')!);
  }
  if (localStorage.getItem('checkedCommunities')) {
    checkedCommunities = JSON.parse(localStorage.getItem('checkedCommunities')!);
  }
  if (localStorage.getItem('nsfwFilter')) {
    nsfwFilter = localStorage.getItem('nsfwFilter') as Filter;
  }
  if (localStorage.getItem('jwt')) {
    jwt = localStorage.getItem('jwt')!;
  }
  if (localStorage.getItem('userInstance')) {
    userInstance = localStorage.getItem('userInstance')!;
  }
}
loadData();

function pickRandomCommunity() {
  document.querySelector<HTMLDivElement>('#community-description')!.innerHTML = '';
  document.querySelector<HTMLDivElement>('#community-description')!.style.display = 'none';
  document.querySelector<HTMLImageElement>('#community-icon')!.src = '';
  document.querySelector<HTMLAnchorElement>('#community-name')!.innerText = '';
  document.querySelector<HTMLAnchorElement>('#community-name')!.href = '#';
  document.querySelector<HTMLParagraphElement>('#community-instance')!.innerText = '';
  document.querySelector<HTMLParagraphElement>('#post-count')!.innerText = '';
  document.querySelector<HTMLParagraphElement>('#sub-count')!.innerText = '';
  document.querySelector<HTMLParagraphElement>('#comment-count')!.innerText = '';
  document.querySelector<HTMLSpanElement>('#nsfw-tag')!.style.display = 'none';
  document.querySelector<HTMLDivElement>('#posts')!.innerHTML = `<div class="loader is-loading"></div>`;
  while (true) {
    currentCommunity = Math.floor(Math.random() * communities.length);
    if (communities[currentCommunity].counts.posts === 0) {
      continue;
    }
    if (blockedInstances.indexOf(communities[currentCommunity].url.toLowerCase()) !== -1) {
      continue;
    }
    if ((nsfwFilter === 'none' && communities[currentCommunity].community.nsfw) || (nsfwFilter === 'only' && !communities[currentCommunity].community.nsfw)) {
      continue;
    }
    break;
  }
  const i = currentCommunity;
  const randomCommunity = communities[currentCommunity];
  if (randomCommunity.community.description) {
    document.querySelector<HTMLDivElement>('#community-description')!.innerHTML = markdown(randomCommunity.community.description);
    document.querySelector<HTMLDivElement>('#community-description')!.style.display = 'block';
  } else {
    document.querySelector<HTMLDivElement>('#community-description')!.style.display = 'none';
  }
  if (randomCommunity.community.icon) {
    document.querySelector<HTMLImageElement>('#community-icon')!.src = randomCommunity.community.icon;
  } else {
    document.querySelector<HTMLImageElement>('#community-icon')!.src = 'lemmy-logo.png';
  }
  document.querySelector<HTMLAnchorElement>('#community-name')!.innerText = randomCommunity.community.title;
  document.querySelector<HTMLAnchorElement>('#community-name')!.href = randomCommunity.community.actor_id;
  document.querySelector<HTMLParagraphElement>('#community-instance')!.innerText = randomCommunity.url;
  document.querySelector<HTMLParagraphElement>('#post-count')!.innerText = randomCommunity.counts.posts.toString();
  document.querySelector<HTMLParagraphElement>('#sub-count')!.innerText = randomCommunity.counts.subscribers.toString();
  document.querySelector<HTMLParagraphElement>('#comment-count')!.innerText = randomCommunity.counts.comments.toString();
  document.querySelector<HTMLSpanElement>('#nsfw-tag')!.style.display = randomCommunity.community.nsfw ? 'inline-flex' : 'none';
  if (randomCommunity.counts.posts > 0) {
    let lemmy = new LemmyHttp('https://' + randomCommunity.url);
    lemmy.getPosts({
      community_id: randomCommunity.community.id,
      sort: 'TopAll',
      limit: 10,
      community_name: randomCommunity.community.name,
    }).then((posts) => {
      if (i !== currentCommunity) {
        return;
      }
      let html = '';
      for (const post of posts.posts) {
        html += createPostElement(post);
      }
      document.querySelector<HTMLDivElement>('#posts')!.innerHTML = html;
    }).catch((err) => {
      document.querySelector<HTMLDivElement>('#posts')!.innerHTML = `<article class="message is-danger">
      <div class="message-header">
        <p>Error</p>
      </div>
      <div class="message-body">
        ${err}
      </div>
    </article>`;
      console.log(err);
    });
  }
}

function createPostElement(post: PostView) {
  let thumbnail = '';
  if (post.post.thumbnail_url) {
    thumbnail = `<figure class="media-left">
    <p class="image is-64x64">
      <img src="${post.post.thumbnail_url}" class="post-img contained-img" onclick="showImage('${post.post.url}')">
    </p>
  </figure>`;
  }
  let embed = '';
  if (post.post.embed_title) {
    embed = `<a href='${post.post.url}' target='_blank'><div class="box">
    <strong>${post.post.embed_title}</strong>
    ${post.post.embed_description ? '<p>' + post.post.embed_description + '</p>' : ''}
    ${post.post.embed_video_url && post.post.embed_video_url.endsWith('.mp4') ? `<video controls src="${post.post.embed_video_url}"></video>` : ''}
    <p><small>${post.post.url}</small></p>
  </div></a>`
  }
  return `<article class="media">
  ${thumbnail}
  <div class="media-content">
    <div class="content">
      <p>
        <a href="${post.post.ap_id}" target="_blank"><strong>${post.post.name}</strong></a>
        <br>
        ${post.post.body ? markdown(post.post.body) + '<br>' : ''}
        ${embed ?? ''}
        <small>Score: ${post.counts.score}</small>
      </p>
    </div>
    </nav>
  </div>
</article>`
}

function checkCommunity(c: MyCommunityView) {
  checkedCommunities.push(c.community.instance_id + '@' + c.community.id);
  communities.splice(communities.indexOf(c), 1);
  saveData();
}

function showError(err:any) {
  document.querySelector<HTMLDivElement>('#error-box')!.innerText = err;
  document.querySelector<HTMLDivElement>('#error-box')!.style.display = 'block';
}

function clearError() {
  document.querySelector<HTMLDivElement>('#error-box')!.style.display = 'none';
}

(document as any).showImage = function (url: string) {
  window.open(url, '_blank');
}

// Fetch the JSON data from the server
fetch('communities.json').then((response) => {
  return response.json();
}).then((c) => {
  communities = c;
  communities = communities.filter((c) => {
    return c.counts.posts > 10 && checkedCommunities.indexOf(c.community.instance_id + '@' + c.community.id) === -1;
  });
  document.querySelector<HTMLButtonElement>('#subscribe-btn')!.onclick = () => {
    clearError();
    if (!userLemmy || !jwt) {
      showError('You need to login first');
      return;
    }
    const c = communities[currentCommunity];
    userLemmy.getCommunity({
      name: c.community.name + '@' + c.url,
    }).then((fetched) => {
      userLemmy!.followCommunity({
        community_id: fetched.community_view.community.id,
        auth: jwt,
        follow: true,
      })
      checkCommunity(communities[currentCommunity]);
      pickRandomCommunity();
    }).catch((err) => {
      console.log(err);
      showError(err);
    });
  };
  document.querySelector<HTMLButtonElement>('#skip-btn')!.onclick = () => {
    clearError();
    checkCommunity(communities[currentCommunity]);
    pickRandomCommunity();
  };
  pickRandomCommunity();
}).catch((err) => {
  console.log(err);
  showError(err);
});

if (jwt) {
  userLemmy = new LemmyHttp('https://' + userInstance);
  document.querySelector<HTMLButtonElement>('#login-btn')!.innerText = 'Logout';
}

document.querySelector<HTMLButtonElement>('#login-btn')!.onclick = () => {
  if (jwt) {
    jwt = '';
    userInstance = '';
    userLemmy = null;
    document.querySelector<HTMLButtonElement>('#login-btn')!.innerText = 'Login';
    saveData();
  } else {
    document.querySelector<HTMLDivElement>('#login-modal')!.classList.add('is-active');
  }
}
document.querySelector<HTMLButtonElement>('#modal-cancel-btn')!.onclick = () => {
  document.querySelector<HTMLInputElement>('#instance-txt')!.value = '';
  document.querySelector<HTMLInputElement>('#username-txt')!.value = '';
  document.querySelector<HTMLInputElement>('#password-txt')!.value = '';
  document.querySelector<HTMLDivElement>('#login-modal')!.classList.remove('is-active');
}
document.querySelector<HTMLButtonElement>('#modal-login-btn')!.onclick = () => {
  document.querySelector<HTMLDivElement>('#failed-login-info')!.style.display = 'none';
  const instance = document.querySelector<HTMLInputElement>('#instance-txt')!.value;
  const username = document.querySelector<HTMLInputElement>('#username-txt')!.value;
  const password = document.querySelector<HTMLInputElement>('#password-txt')!.value;
  const lemmy = new LemmyHttp('https://' + instance);
  lemmy.login({
    username_or_email: username,
    password: password,
  }).then((token) => {
    if (!token.jwt) {
      document.querySelector<HTMLDivElement>('#failed-login-info')!.style.display = 'block';
      document.querySelector<HTMLDivElement>('#failed-login-info')!.innerText = 'No JWT token received';
      return;
    }
    jwt = token.jwt;
    userInstance = document.querySelector<HTMLInputElement>('#instance-txt')!.value;
    document.querySelector<HTMLInputElement>('#instance-txt')!.value = '';
    document.querySelector<HTMLInputElement>('#username-txt')!.value = '';
    document.querySelector<HTMLInputElement>('#password-txt')!.value = '';
    userLemmy = lemmy;
    document.querySelector<HTMLButtonElement>('#login-btn')!.innerText = 'Logout';
    saveData();
    document.querySelector<HTMLDivElement>('#login-modal')!.classList.remove('is-active');
  }).catch((err) => {
    document.querySelector<HTMLDivElement>('#failed-login-info')!.style.display = 'block';
    document.querySelector<HTMLDivElement>('#failed-login-info')!.innerText = err;
    console.log(err);
  });
}