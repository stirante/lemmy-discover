import './style.scss'
import 'fontawesome-free/css/all.css'

import { CommunityView, LemmyHttp, ListCommunitiesResponse, PostView } from 'lemmy-js-client';
import { createMarkdown } from "../node_modules/safe-marked/src/browser.js";
import * as marked from 'marked';

// Setup markdown renderer
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

// Setup types
type Filter = 'all' | 'only' | 'none';

interface MyCommunityView extends CommunityView {
  url: string;
  id: string;
}
// List of defederated instances to ignore
let defederatedInstances: string[] = [];

// List of all communities
let communities: MyCommunityView[] = [];
// Currently selected community
let currentCommunity: number = 0;

// Saved data

// Filter for NSFW communities
let nsfwFilter: Filter = 'none';
// List of blocked instances
let blockedInstances: string[] = [];
// List of already seen communities
let checkedCommunities: string[] = [];
// JWT token
let jwt: string = '';
// Instance of the logged in user
let userInstance: string = '';

// Lemmy client for the logged in user
let userLemmy: LemmyHttp | null = null;
// List of communities the user is following
let followedCommunities: string[] = [];

// Saves the data to local storage
function saveData() {
  localStorage.setItem('blockedInstances', JSON.stringify(blockedInstances));
  localStorage.setItem('checkedCommunities', JSON.stringify(checkedCommunities));
  localStorage.setItem('nsfwFilter', nsfwFilter);
  localStorage.setItem('jwt', jwt);
  localStorage.setItem('userInstance', userInstance);
}

// Loads the data from local storage
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

// Picks a random community and displays it
function pickRandomCommunity() {
  // Reset the community card
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
  // Find a random community, that fulfills the requirements
  while (true) {
    // Pick a random community
    currentCommunity = Math.floor(Math.random() * communities.length);
    let instance = new URL(communities[currentCommunity].community.actor_id).hostname;
    // Check if the community is not defederated
    if (defederatedInstances.indexOf(instance) !== -1) {
      console.log('Skipped defederated community: ' + communities[currentCommunity].community.actor_id);
      continue;
    }
    // Check if the community is not already followed
    if (followedCommunities.indexOf(communities[currentCommunity].community.name + '@' + instance) !== -1) {
      console.log('Skipped followed community: ' + communities[currentCommunity].community.actor_id);
      continue;
    }
    // Check if the community was already seen
    if (blockedInstances.indexOf(communities[currentCommunity].url.toLowerCase()) !== -1) {
      continue;
    }
    // Apply the NSFW filter
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
  document.querySelector<HTMLParagraphElement>('#community-instance')!.innerText = new URL(randomCommunity.community.actor_id).hostname;
  document.querySelector<HTMLParagraphElement>('#post-count')!.innerText = randomCommunity.counts.posts.toString();
  document.querySelector<HTMLParagraphElement>('#sub-count')!.innerText = randomCommunity.counts.subscribers.toString();
  document.querySelector<HTMLParagraphElement>('#comment-count')!.innerText = randomCommunity.counts.comments.toString();
  document.querySelector<HTMLSpanElement>('#nsfw-tag')!.style.display = randomCommunity.community.nsfw ? 'inline-flex' : 'none';
  // Create Lemmy client for the community's instance
  let lemmy = new LemmyHttp('https://' + randomCommunity.url);
  // Get top 10 posts of all time from the community
  lemmy.getPosts({
    community_id: randomCommunity.community.id,
    sort: 'TopAll',
    limit: 10,
    community_name: randomCommunity.community.name,
  }).then((posts) => {
    // If the community changed while loading, ignore the result
    if (i !== currentCommunity) {
      return;
    }
    // Display the posts
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

// Creates the HTML element for a post
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

// Marks community as seen
function checkCommunity(c: MyCommunityView) {
  checkedCommunities.push(c.community.instance_id + '@' + c.community.id);
  communities.splice(communities.indexOf(c), 1);
  saveData();
}

// Shows an error
function showError(err: any) {
  document.querySelector<HTMLDivElement>('#error-box')!.innerText = err;
  document.querySelector<HTMLDivElement>('#error-box')!.style.display = 'block';
}

// Clears the error
function clearError() {
  document.querySelector<HTMLDivElement>('#error-box')!.style.display = 'none';
}

// Setup function for showing an image. Currently redirects to the image URL in a new tab
(document as any).showImage = function (url: string) {
  window.open(url, '_blank');
}

// Fetch list of communities
fetch('communities.json').then((response) => {
  return response.json();
}).then((c) => {
  communities = c;
  communities = communities.filter((c) => {
    // Filter out communities with less than 10 posts and seen communities
    return c.counts.posts > 10 && checkedCommunities.indexOf(c.community.instance_id + '@' + c.community.id) === -1;
  });
  // Setup follow button
  document.querySelector<HTMLButtonElement>('#subscribe-btn')!.onclick = () => {
    clearError();
    // Check if the user is logged in
    if (!userLemmy || !jwt) {
      showError('You need to login first');
      return;
    }
    const c = communities[currentCommunity];
    // Get the community through user's instance
    userLemmy.getCommunity({
      name: c.community.name + '@' + new URL(c.community.actor_id).hostname,
    }).then((fetched) => {
      // Follow the community
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
  // Setup skip button
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

// If the user is logged in, setup lemmy instance and trigger login event
if (jwt) {
  userLemmy = new LemmyHttp('https://' + userInstance);
  onLogin();
}

// Login event
function onLogin() {
  document.querySelector<HTMLButtonElement>('#login-btn')!.innerText = 'Logout';
  userLemmy!.getFederatedInstances().then((instances) => {
    defederatedInstances = instances.federated_instances?.blocked.map(x => x.domain) ?? [];
  }).catch((err) => {
    console.log(err);
  });
  fetchFollowedCommunities();
}

// Fetches the list of followed communities
async function fetchFollowedCommunities() {
  if (!userLemmy || !jwt) {
    return;
  }
  let followed: ListCommunitiesResponse | undefined;
  let page = 0;
  do {
    followed = await userLemmy.listCommunities({
      auth: jwt,
      type_: 'Subscribed',
      limit: 50,
      page: page,
    });
    page++;
    followedCommunities.push(...followed.communities.map(x => x.community.name + '@' + new URL(x.community.actor_id).hostname));
  } while (followed.communities.length === 50);
}

// Setup login button
document.querySelector<HTMLButtonElement>('#login-btn')!.onclick = () => {
  // Login or logout depending on the current state
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
// Setup cancel button in login modal
document.querySelector<HTMLButtonElement>('#modal-cancel-btn')!.onclick = () => {
  document.querySelector<HTMLInputElement>('#instance-txt')!.value = '';
  document.querySelector<HTMLInputElement>('#username-txt')!.value = '';
  document.querySelector<HTMLInputElement>('#password-txt')!.value = '';
  document.querySelector<HTMLDivElement>('#login-modal')!.classList.remove('is-active');
}
// Setup login button in login modal
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
    onLogin();
    saveData();
    document.querySelector<HTMLDivElement>('#login-modal')!.classList.remove('is-active');
  }).catch((err) => {
    document.querySelector<HTMLDivElement>('#failed-login-info')!.style.display = 'block';
    document.querySelector<HTMLDivElement>('#failed-login-info')!.innerText = err;
    console.log(err);
  });
}