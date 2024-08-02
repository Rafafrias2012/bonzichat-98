interface Agent {
  name: string;
  guid: string;
  x: number;
  y: number;
  sheet: any;
  color: string;
  voice: string;
  sprite: createjs.Sprite;
  speechBubble: HTMLDivElement;
  nameBubble: HTMLDivElement;
  updatePosition: () => void;
  talk: (text: string) => void;
  change: (color: string) => void;
  kill: () => void;
  actqueue: (queue: any[], index: number) => void;
}

interface Self {
  name: string;
  room: string;
  color: string;
}

let socket: SocketIOClient.Socket;
let agents: {[key: string]: Agent} = {};
let self: Self = {name: '', room: '', color: ''};
let level: number = 0;
let announcements: any[] = [];

const sheets = {
  purple: {
    src: "https://bonziworld.org/img/agents/purple.png",
    frames: {width: 200, height: 160},
    animations: {
      idle: 0,
      enter: {frames: [277, 302], next: "idle", speed: 0.25},
      leave: {frames: [16, 39, 40], speed: 0.25}
    }
  }
};

class AgentImpl implements Agent {
  constructor(
    public name: string,
    public guid: string,
    public x: number,
    public y: number,
    public sheet: any,
    public color: string,
    public voice: string
  ) {
    this.sprite = new createjs.Sprite(new createjs.SpriteSheet(sheet));
    this.sprite.x = x;
    this.sprite.y = y;
    
    this.speechBubble = document.createElement('div');
    this.speechBubble.className = 'speechBubble';
    document.body.appendChild(this.speechBubble);
    
    this.nameBubble = document.createElement('div');
    this.nameBubble.className = 'nameBubble';
    this.nameBubble.textContent = name;
    document.body.appendChild(this.nameBubble);
    
    this.updatePosition();
  }
  
  sprite: createjs.Sprite;
  speechBubble: HTMLDivElement;
  nameBubble: HTMLDivElement;
  
  updatePosition(): void {
    this.speechBubble.style.left = (this.x + 100) + 'px';
    this.speechBubble.style.top = (this.y - 20) + 'px';
    this.nameBubble.style.left = this.x + 'px';
    this.nameBubble.style.top = (this.y + 160) + 'px';
  }
  
  talk(text: string): void {
    this.speechBubble.textContent = text;
    this.speechBubble.style.display = 'block';
    setTimeout(() => {
      this.speechBubble.style.display = 'none';
    }, 5000);
    
    let url = "https://www.tetyys.com/SAPI4/SAPI4?text=" + encodeURIComponent(text) + "&voice=" + encodeURIComponent("Sam") + "&pitch=150&speed=100";
    new Audio(url).play();
  }
  
  change(color: string): void {
    // Implement color change logic here
  }
  
  kill(): void {
    this.sprite.parent.removeChild(this.sprite);
    document.body.removeChild(this.speechBubble);
    document.body.removeChild(this.nameBubble);
    delete agents[this.guid];
  }

  actqueue(queue: any[], index: number): void {
    // Implement actqueue logic here
  }
}

function initializeBonziWorld(): void {
  const stage = new createjs.Stage("bonziContainer");
  createjs.Ticker.framerate = 30;
  createjs.Ticker.addEventListener("tick", stage);
  
  socket = io("https://bonziworld.org/");
  
  socket.on("login", (loginData: any) => {
    document.getElementById("loginContainer")!.style.display = "none";
    document.getElementById("chatContainer")!.style.display = "block";
    document.getElementById("currentRoom")!.textContent = self.room;
    
    Object.keys(loginData.users).forEach(userKey => {
      let user = loginData.users[userKey];
      let x = Math.floor(Math.random() * (window.innerWidth - sheets.purple.frames.width));
      let y = Math.floor(Math.random() * (window.innerHeight - sheets.purple.frames.height - 72));
      agents[userKey] = new AgentImpl(user.name, userKey, x, y, sheets.purple, user.color, user.voice);
      stage.addChild(agents[userKey].sprite);
    });
  });
  
  socket.on("join", (user: any) => {
    let x = Math.floor(Math.random() * (window.innerWidth - sheets.purple.frames.width));
    let y = Math.floor(Math.random() * (window.innerHeight - sheets.purple.frames.height - 72));
    agents[user.guid] = new AgentImpl(user.name, user.guid, x, y, sheets.purple, user.color, user.voice);
    stage.addChild(agents[user.guid].sprite);
  });
  
  socket.on("leave", (guid: string) => {
    if (agents[guid]) {
      agents[guid].kill();
    }
  });
  
  socket.on("talk", (data: {guid: string, text: string}) => {
    if (agents[data.guid]) {
      agents[data.guid].talk(data.text);
    }
  });
  
  socket.on("update", (user: any) => {
    if (agents[user.guid]) {
      agents[user.guid].name = user.name;
      agents[user.guid].voice = user.voice;
      if (user.color !== agents[user.guid].color) {
        agents[user.guid].change(user.color);
      }
      agents[user.guid].nameBubble.textContent = user.name;
    }
  });
  
  socket.on("update_self", (info: any) => {
    level = info.level;
    if (info.roomowner) {
      document.getElementById("room_owner")!.style.display = "block";
    }
  });
  
  socket.on("announce", (data: any) => {
    announcements.push(new msWindow(data.title, data.html));
    if (announcements.length > 3) {
      announcements[0].kill();
      announcements.shift();
    }
  });

  socket.on("actqueue", (data: {guid: string, list: any[]}) => {
    if (agents[data.guid]) {
      agents[data.guid].actqueue(data.list, 0);
    }
  });
  
  updateTimezone();
  setInterval(updateTimezone, 60000);
}

function updateTimezone(): void {
  const timezoneElement = document.getElementById("timezone")!;
  timezoneElement.textContent = new Date().toLocaleTimeString();
}

function send(): void {
  const messageInput = document.getElementById("send_message") as HTMLInputElement;
  const message = messageInput.value.trim();
  
  if (message.startsWith("/")) {
    const [command, ...params] = message.substring(1).split(" ");
    socket.emit("command", {command, param: params.join(" ")});
  } else {
    socket.emit("talk", message);
  }
  
  messageInput.value = "";
}

document.getElementById("loginButton")!.addEventListener("click", () => {
  self.name = (document.getElementById("login_nickname") as HTMLInputElement).value;
  self.room = (document.getElementById("login_room") as HTMLInputElement).value;
  self.color = "purple";
  
  socket.emit("login", self);
  initializeBonziWorld();
});

document.getElementById("send_message")!.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    send();
  }
});

// Initialize drag functionality for bonzi
let isDragging = false;
let dragOffsetX: number, dragOffsetY: number;

document.getElementById("bonziContainer")!.addEventListener("mousedown", startDrag);
document.getElementById("bonziContainer")!.addEventListener("touchstart", startDrag);

function startDrag(e: MouseEvent | TouchEvent): void {
  isDragging = true;
  const bonzi = document.getElementById("bonziContainer")!;
  const rect = bonzi.getBoundingClientRect();
  
  if (e instanceof MouseEvent) {
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
  } else if (e instanceof TouchEvent) {
    dragOffsetX = e.touches[0].clientX - rect.left;
    dragOffsetY = e.touches[0].clientY - rect.top;
  }
  
  document.addEventListener("mousemove", drag);
  document.addEventListener("touchmove", drag);
  document.addEventListener("mouseup", stopDrag);
  document.addEventListener("touchend", stopDrag);
}

function drag(e: MouseEvent | TouchEvent): void {
  if (!isDragging) return;
  
  const bonzi = document.getElementById("bonziContainer")!;
  let x: number, y: number;
  
  if (e instanceof MouseEvent) {
    x = e.clientX - dragOffsetX;
    y = e.clientY - dragOffsetY;
  } else if (e instanceof TouchEvent) {
    x = e.touches[0].clientX - dragOffsetX;
    y = e.touches[0].clientY - dragOffsetY;
  } else {
    return;
  }
  
  bonzi.style.left = x + "px";
  bonzi.style.top = y + "px";
}

function stopDrag(): void {
  isDragging = false;
  document.removeEventListener("mousemove", drag);
  document.removeEventListener("touchmove", drag);
  document.removeEventListener("mouseup", stopDrag);
  document.removeEventListener("touchend", stopDrag);
}

class msWindow {
  constructor(title: string, content: string, x?: number, y?: number, width?: number, height?: number) {
    this.element = document.createElement('div');
    this.element.className = 'msWindow';
    this.element.style.left = (x || Math.random() * (window.innerWidth - 300)) + 'px';
    this.element.style.top = (y || Math.random() * (window.innerHeight - 200)) + 'px';
    this.element.style.width = (width || 300) + 'px';
    this.element.style.height = (height || 200) + 'px';
    
    this.titleBar = document.createElement('div');
    this.titleBar.className = 'msWindowTitle';
    this.titleBar.textContent = title;
    
    this.content = document.createElement('div');
    this.content.className = 'msWindowContent';
    this.content.innerHTML = content;
    
    this.buttons = document.createElement('div');
    this.buttons.className = 'msWindowButtons';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'msWindowButton';
    closeButton.textContent = 'X';
    closeButton.onclick = () => this.kill();
    
    this.buttons.appendChild(closeButton);
    this.element.appendChild(this.titleBar);
    this.element.appendChild(this.buttons);
    this.element.appendChild(this.content);
    
    document.body.appendChild(this.element);
    
    this.makeDraggable();
  }
  
  element: HTMLDivElement;
  titleBar: HTMLDivElement;
  content: HTMLDivElement;
  buttons: HTMLDivElement;
  
  kill(): void {
    document.body.removeChild(this.element);
  }
  
  makeDraggable(): void {
    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;
    let xOffset = 0;
    let yOffset = 0;

    this.titleBar.onmousedown = dragStart;
    this.titleBar.ontouchstart = dragStart;

    function dragStart(e: MouseEvent | TouchEvent) {
      if (e instanceof TouchEvent) {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
      } else {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
      }

      isDragging = true;
    }

    document.onmousemove = drag;
    document.ontouchmove = drag;

    function drag(e: MouseEvent | TouchEvent) {
      if (isDragging) {
        e.preventDefault();
        if (e instanceof TouchEvent) {
          currentX = e.touches[0].clientX - initialX;
          currentY = e.touches[0].clientY - initialY;
        } else {
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;
        }

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, this.element);
      }
    }

    document.onmouseup = dragEnd;
    document.ontouchend = dragEnd;

    function dragEnd() {
      initialX = currentX;
      initialY = currentY;

      isDragging = false;
    }

    function setTranslate(xPos: number, yPos: number, el: HTMLElement) {
      el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)";
    }
  }
}

// Welcome window
new msWindow("Welcome to BonziChat", `
  <h2>Rules:</h2>
  <ol>
    <li>Be respectful to others</li>
    <li>No spamming</li>
    <li>Keep conversations family-friendly</li>
    <li>Don't share personal information</li>
    <li>Have fun!</li>
    <li>Report any issues to moderators</li>
  </ol>
`);

// Control Panel
document.getElementById('clippy')!.onclick = () => {
  new msWindow("Control Panel", `
    <h2>Settings</h2>
    <div class="field-row">
      <label for="username">Username:</label>
      <input id="username" type="text" value="${self.name}">
    </div>
    <div class="field-row">
      <label for="bgColor">Background Color:</label>
      <input id="bgColor" type="color" value="#008080">
    </div>
    <div class="field-row">
      <label for="darkMode">Dark Mode:</label>
      <input id="darkMode" type="checkbox">
    </div>
    <button onclick="applySettings()">Apply</button>
  `);
};

function applySettings() {
  const username = (document.getElementById('username') as HTMLInputElement).value;
  const bgColor = (document.getElementById('bgColor') as HTMLInputElement).value;
  const darkMode = (document.getElementById('darkMode') as HTMLInputElement).checked;
  
  self.name = username;
  socket.emit('update', { name: username });
  
  document.body.style.backgroundColor = bgColor;
  
  if (darkMode) {
    document.body.classList.add('darkMode');
  } else {
    document.body.classList.remove('darkMode');
  }
}

// Chat log
document.getElementById('chatLogButton')!.onclick = () => {
  new msWindow("Chat Log", `
    <div id="chatLog" style="height: 200px; overflow-y: scroll;"></div>
  `);
};

// Update chat log
socket.on('talk', (data: {guid: string, text: string}) => {
  const chatLog = document.getElementById('chatLog');
  if (chatLog) {
    const message = document.createElement('p');
    message.innerHTML = `<strong>${agents[data.guid].name}:</strong> ${data.text}`;
    chatLog.appendChild(message);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
});

// Context menu
document.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault();
  const contextMenu = new msWindow("Context Menu", `
    <button onclick="heyUser()">Hey, User!</button>
    <button onclick="getStats()">Get Stats</button>
  `, e.clientX, e.clientY, 150, 100);
});

function heyUser() {
  const selectedUser = Object.values(agents).find(agent => 
    agent.x < (event as MouseEvent).clientX && 
    (event as MouseEvent).clientX < agent.x + 200 && 
    agent.y < (event as MouseEvent).clientY && 
    (event as MouseEvent).clientY < agent.y + 160
  );
  if (selectedUser) {
    socket.emit("talk", `Hey, ${selectedUser.name}!`);
  }
}

function getStats() {
  const selectedUser = Object.values(agents).find(agent => 
    agent.x < (event as MouseEvent).clientX && 
    (event as MouseEvent).clientX < agent.x + 200 && 
    agent.y < (event as MouseEvent).clientY && 
    (event as MouseEvent).clientY < agent.y + 160
  );
  if (selectedUser) {
    new msWindow(selectedUser.name + "'s stats", `
      <table>
        <tr>
          <td class="side">
            <img src="https://win98icons.alexmeub.com/icons/png/stats-0.png" alt="Windows 98 stats icon">
          </td>
          <td>
            <span class="win_text">
              <table style="margin-left: 15px;">
                <tr><td>Name:</td><td>${selectedUser.name}</td></tr>
                <tr><td>Color:</td><td>${selectedUser.color}</td></tr>
                <tr><td>GUID:</td><td>${selectedUser.guid}</td></tr>
              </table>
            </span>
          </td>
        </tr>
      </table>
    `);
  }
}

// Implement mute functionality
socket.on('mute', (data: {guid: string, muted: boolean}) => {
  const agent = agents[data.guid];
  if (agent) {
    const muteIcon = document.createElement('img');
    muteIcon.src = 'https://win98icons.alexmeub.com/icons/png/sound_off-0.png';
    muteIcon.alt = 'Muted';
    muteIcon.style.position = 'absolute';
    muteIcon.style.top = (agent.y - 20) + 'px';
    muteIcon.style.left = (agent.x + 180) + 'px';
    muteIcon.style.width = '16px';
    muteIcon.style.height = '16px';
    if (data.muted) {
      document.body.appendChild(muteIcon);
    } else {
      const existingIcon = document.body.querySelector(`img[alt="Muted"][style*="top: ${agent.y - 20}px"][style*="left: ${agent.x + 180}px"]`);
      if (existingIcon) document.body.removeChild(existingIcon);
    }
  }
});

// Implement poll functionality
socket.on("poll", (data: {name: string, title: string}) => {
  if (window.poll) {
    window.poll.kill();
  }
  window.poll = new msWindow("Poll from " + data.name, `
    <h1>${data.title}</h1>
    <div id="pollyes"><div id="innerbar_yes"></div><span class='polltx'>YES</span></div>
    <div id="pollno"><div id="innerbar_no"></div><span class='polltx'>NO</span></div>
    <span id="votecount">0</span> Votes!
    <img src="https://win98icons.alexmeub.com/icons/png/poll-0.png" alt="Poll windows 98 icon">
  `, undefined, undefined, window.innerWidth / 2);
  
  document.getElementById("pollyes")!.onclick = () => {
    socket.emit('command', {
      command: 'vote',
      param: 'yes'
    });
  };
  
  document.getElementById("pollno")!.onclick = () => {
    socket.emit('command', {
      command: 'vote',
      param: 'no'
    });
  };
});

socket.on("vote", (data: {yes: number, no: number}) => {
  if (!window.poll) return;
  let tvotes = data.yes + data.no;
  (document.getElementById("innerbar_yes") as HTMLElement).style.width = data.yes / tvotes * 100 + "%";
  (document.getElementById("innerbar_no") as HTMLElement).style.width = data.no / tvotes * 100 + "%";
  document.getElementById("votecount")!.innerHTML = tvotes.toString();
});

// Implement kick functionality
socket.on("kick", (kicker: string) => {
  new msWindow("Kicked", `You have been kicked by ${kicker}.`);
  socket.disconnect();
});

// Add Windows 98 sounds
const audio = new Audio();
document.onclick = () => {
  audio.src = 'https://win98icons.alexmeub.com/audio/ding.wav';
  audio.play();
};

// Censorship (simplified implementation)
const censoredWords = ["badword1", "badword2", "badword3"]; // Add your list of 64 censored words here
function censorMessage(message: string): string {
  return censoredWords.reduce((msg, word) => msg.replace(new RegExp(word, 'gi'), '*'.repeat(word.length)), message);
}

// Update send function to include censorship
function send(): void {
  const messageInput = document.getElementById("send_message") as HTMLInputElement;
  const message = censorMessage(messageInput.value.trim());
  
  if (message.startsWith("/")) {
    const [command, ...params] = message.substring(1).split(" ");
    socket.emit("command", {command, param: params.join(" ")});
  } else {
    socket.emit("talk", message);
  }
  
  messageInput.value = "";
}

// Linkify messages
function linkifyMessage(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank">${url}</a>`);
}

// Update talk function to include linkify
socket.on("talk", (data: {guid: string, text: string}) => {
  if (agents[data.guid]) {
    const linkedText = linkifyMessage(data.text);
    agents[data.guid].talk(linkedText);
  }
});

// Add admin/owner icon
function updateUserIcon(guid: string, isAdmin: boolean, isOwner: boolean) {
  const agent = agents[guid];
  if (agent) {
    const iconContainer = document.createElement('div');
    iconContainer.style.position = 'absolute';
    iconContainer.style.top = (agent.y - 20) + 'px';
    iconContainer.style.left = (agent.x + 160) + 'px';

    if (isOwner) {
      const ownerIcon = document.createElement('img');
      ownerIcon.src = 'https://win98icons.alexmeub.com/icons/png/key_gray.png';
      ownerIcon.alt = 'Room Owner';
      ownerIcon.style.width = '16px';
      ownerIcon.style.height = '16px';
      iconContainer.appendChild(ownerIcon);
    } else if (isAdmin) {
      const adminIcon = document.createElement('img');
      adminIcon.src = 'https://win98icons.alexmeub.com/icons/png/world-0.png';
      adminIcon.alt = 'Admin';
      adminIcon.style.width = '16px';
      adminIcon.style.height = '16px';
      iconContainer.appendChild(adminIcon);
    }

    document.body.appendChild(iconContainer);
  }
}

// Update user levels
socket.on("update_self", (info: {level: number, roomowner: boolean}) => {
  level = info.level;
  updateUserIcon(self.guid, level >= 2, info.roomowner);
});

socket.on("update", (user: {guid: string, level: number, roomowner: boolean}) => {
  updateUserIcon(user.guid, user.level >= 2, user.roomowner);
});
