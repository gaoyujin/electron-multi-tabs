const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const tabsContainer = document.getElementById('tabs');
const newTabBtn = document.getElementById('new-tab-btn');
const tabLimitToast = document.getElementById('tab-limit-toast');
const tabsScroll = document.querySelector('.tabs-scroll');
const scrollLeftBtn = document.getElementById('scroll-left');
const scrollRightBtn = document.getElementById('scroll-right');
let activeTabId = null;
let views = new Set(); // 用于跟踪标签数量
let tabCounter = 0; // 用于跟踪标签序号

// 添加一个 Map 来跟踪每个标签页的加载状态
const loadingStates = new Map();

function addMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.textContent = message;
  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function createTabElement(viewId) {
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.setAttribute('data-view-id', viewId);
  
  tabCounter++;
  const tabNumber = tabCounter;  // 保存当前标签的序号
  tab.innerHTML = `
    <span class="tab-title">新标签页 ${tabNumber}</span>
    <span class="close-btn">×</span>
    <div class="tab-loading"></div>
  `;
  
  // 初始化加载状态
  loadingStates.set(viewId, false);
  
  tab.addEventListener('click', () => {
    setActiveTab(viewId);
    window.electronAPI.switchTab(viewId);
  });
  
  // 只有当标签数量大于1时才允许关闭
  const closeBtn = tab.querySelector('.close-btn');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (views.size > 1) {
      window.electronAPI.closeTab(viewId);
    } else {
      showToast('至少需要保留1个标签页');
    }
  });
  
  return tab;
}

function setActiveTab(viewId) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.getAttribute('data-view-id') === viewId) {
      tab.classList.add('active');
      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  });
  activeTabId = viewId;
  updateScrollButtons();
}

function showToast(message) {
  tabLimitToast.textContent = message;
  tabLimitToast.style.display = 'block';
  setTimeout(() => {
    tabLimitToast.style.display = 'none';
  }, 2000);
}

// 事件监听
sendBtn.addEventListener('click', () => {
  const message = messageInput.value.trim();
  if (message) {
    window.electronAPI.sendMessage(message);
    messageInput.value = '';
  }
});

newTabBtn.addEventListener('click', () => {
  if (views.size < 10) {
    window.electronAPI.createNewTab();
  } else {
    showToast('最多只能创建10个标签页');
  }
});

// API 回调设置
window.electronAPI.onMessageResponse((response) => {
  addMessage(response);
});

window.electronAPI.onBroadcastMessage((message) => {
  addMessage(message);
});

window.electronAPI.onTabCreated((event, viewId) => {
  views.add(viewId);
  const tab = createTabElement(viewId);
  
  // 将新标签插入到新建按钮之前
  const newTabBtn = document.getElementById('new-tab-btn');
  tabsContainer.insertBefore(tab, newTabBtn);
  
  setActiveTab(viewId);
  updateNewTabButtonVisibility(); // 更新新建按钮显示状态
  setTimeout(updateScrollButtons, 0);
});

window.electronAPI.onTabClosed((event, viewId) => {
  views.delete(viewId);
  loadingStates.delete(viewId); // 清理加载状态
  const tab = document.querySelector(`[data-view-id="${viewId}"]`);
  if (tab) {
    tab.remove();
    updateTabNumbers();
    updateNewTabButtonVisibility();
  }
  setTimeout(updateScrollButtons, 0);
});

window.electronAPI.onTabLimit((message) => {
  showToast(message);
});

window.addEventListener('beforeunload', () => {
  window.electronAPI.removeAllListeners();
});

// 初始化时请求创建第一个标签并设置新建按钮状态
window.electronAPI.createNewTab();
updateNewTabButtonVisibility();

function updateScrollButtons() {
  const { scrollLeft, scrollWidth, clientWidth } = tabsScroll;
  const hasOverflow = scrollWidth > clientWidth;
  
  // 只在有溢出内容时显示滚动按钮
  if (!hasOverflow) {
    scrollLeftBtn.style.display = 'none';
    scrollRightBtn.style.display = 'none';
    return;
  }
  
  // 根据滚动位置显示/隐藏对应的按钮
  scrollLeftBtn.style.display = scrollLeft > 0 ? 'flex' : 'none';
  scrollRightBtn.style.display = 
    Math.ceil(scrollLeft + clientWidth) < scrollWidth ? 'flex' : 'none';
}

scrollLeftBtn.addEventListener('click', () => {
  tabsScroll.scrollBy({ left: -200, behavior: 'smooth' });
});

scrollRightBtn.addEventListener('click', () => {
  tabsScroll.scrollBy({ left: 200, behavior: 'smooth' });
});

tabsScroll.addEventListener('scroll', updateScrollButtons);

window.addEventListener('resize', () => {
  requestAnimationFrame(updateScrollButtons);
});

// 在标签内容变化时更新滚动按钮状态
const observer = new MutationObserver(() => {
  requestAnimationFrame(updateScrollButtons);
});

observer.observe(tabsContainer, {
  childList: true,
  subtree: true
});

const originalOnTabCreated = window.electronAPI.onTabCreated;
window.electronAPI.onTabCreated = (event, viewId) => {
  originalOnTabCreated(event, viewId);
  setTimeout(updateScrollButtons, 0);
};

const originalOnTabClosed = window.electronAPI.onTabClosed;
window.electronAPI.onTabClosed = (event, viewId) => {
  originalOnTabClosed(event, viewId);
  setTimeout(updateScrollButtons, 0);
};

// 添加更新标签序号的函数
function updateTabNumbers() {
  document.querySelectorAll('.tab').forEach((tab, index) => {
    const titleElement = tab.querySelector('.tab-title');
    if (titleElement) {
      const currentTitle = titleElement.textContent;
      const tabNumber = index + 1;
      
      // 如果是默认标题，只更新序号
      if (currentTitle.startsWith('新标签页')) {
        titleElement.textContent = `新标签页 ${tabNumber}`;
      } else {
        // 更新带有网站标题的序号
        const match = currentTitle.match(/(.*?)\s*\(\d+\)$/);
        const baseTitle = match ? match[1] : currentTitle;
        titleElement.textContent = `${baseTitle} (${tabNumber})`;
      }
    }
  });
  tabCounter = document.querySelectorAll('.tab').length;
}

// 添加更新新建按钮显示状态的函数
function updateNewTabButtonVisibility() {
  newTabBtn.style.display = views.size >= 10 ? 'none' : 'flex';
}

// 修改加载状态处理函数
window.electronAPI.onTabLoading((viewId, isLoading) => {
  const tab = document.querySelector(`[data-view-id="${viewId}"]`);
  if (!tab) return;

  const loadingBar = tab.querySelector('.tab-loading');
  if (!loadingBar) return;

  // 更新加载状态
  loadingStates.set(viewId, isLoading);

  if (isLoading) {
    loadingBar.classList.add('active');
  } else {
    // 添加一个小延迟确保动画平滑
    setTimeout(() => {
      // 再次检查状态，确保没有新的加载开始
      if (!loadingStates.get(viewId)) {
        loadingBar.classList.remove('active');
      }
    }, 200);
  }
});

// 添加标题更新处理
window.electronAPI.onTabTitleUpdated((viewId, title) => {
  const tab = document.querySelector(`[data-view-id="${viewId}"]`);
  if (!tab) return;

  const titleElement = tab.querySelector('.tab-title');
  if (!titleElement) return;

  // 获取标签序号
  const tabNumber = Array.from(document.querySelectorAll('.tab')).indexOf(tab) + 1;
  
  // 如果标题为空或是默认标题，只显示序号
  if (!title || title === 'about:blank') {
    titleElement.textContent = `新标签页 ${tabNumber}`;
  } else {
    // 组合网站标题和序号
    titleElement.textContent = `${title} (${tabNumber})`;
  }
}); 