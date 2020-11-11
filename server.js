/* ==== SETTINGS AREA ==== */
// port binding
const listen_host = '0.0.0.0';
const listen_port = '25570';

const COLOR = {
  BLACK: '\u00a70',
  DARK_BLUE: '\u00a71',
  DARK_GREEN: '\u00a72',
  DARK_AQUA: '\u00a73',
  DARK_RED: '\u00a74',
  PURPLE: '\u00a75',
  ORANGE: '\u00a76',
  LIGHT_GRAY: '\u00a77',
  DARK_GRAY: '\u00a78',
  BLUE: '\u00a79',
  GREEN: '\u00a7a',
  AQUA: '\u00a7b',
  RED: '\u00a7c',
  PINK: '\u00a7d',
  YELLOW: '\u00a7e',
  WHITE: '\u00a7f',
}

class ServerEntry {
  constructor(title = '', icon = 0, lore = [], server = '') {
    this.title = title;
    this.icon = icon;
    this.lore = lore;
    this.server = server;
  }
}

class CategoryEntry {
  constructor(title = '', icon = 0, lore = [], servers = []) {
    this.title = title;
    this.icon = icon;
    this.lore = lore;
    this.servers = servers;
  }
}

// format 'Display Name': [ITEM_ID, [LORES], {sub-menu} or 'server-name']
const menu_map = [
  new ServerEntry('Lobby', 1, ['Server lobby', '', `${COLOR.RED}[v1.12.2+]`], 'lobby'),
  undefined,
  new ServerEntry('Survival', 37, ['Vanilla survival', '', `${COLOR.RED}[v1.16.3]`], 'survival'),
  new ServerEntry('Skyblock', 8, ['Vanilla skyblock', '', `${COLOR.RED}[v1.16.3]`], 'skyblock'),
  undefined,
  new CategoryEntry('Modded', 75, ['A list of all our modded minecraft servers'], [
    new ServerEntry('ATM3', 102, ['All the mods 3', '', `${COLOR.RED}[v1.14.2]`], 'atm3'),
  ]),
];
// item settings
const item_server = 3;
const item_category = 4;
const item_functional = 20;
// messages
const message_loading = `${COLOR.AQUA}Loading...`;
const menu_title = `${COLOR.DARK_GRAY}Choose a server`;
const message_bye = `${COLOR.AQUA}Have a good day!`;

/* == END OF SETTINGS AREA == */

const type = require('type-detect');

const mc = require('minecraft-protocol');
const server = mc.createServer({
  'online-mode': false,
  encryption: true,
  host: listen_host,
  port: listen_port,
  motd: `${COLOR.DARK_GRAY}Sparr0ws Lobby\n${COLOR.RED}[1.14+]`,
  maxPlayers: 1337,
});
const mcData = require('minecraft-data')(server.version)

console.log('Minecraft server is now started!');

server.on('login', function(client) {
  
  let loginPacket = mcData.loginPacket;

  client.write('login', {
    entityId: client.id,
    isHardcore: false,
    gameMode: 0,
    previousGameMode: 255,
    worldNames: loginPacket.worldNames,
    dimensionCodec: loginPacket.dimensionCodec,
    dimension: loginPacket.dimension,
    worldName: 'minecraft:overworld',
    hashedSeed: [0, 0],
    maxPlayers: server.maxPlayers,
    viewDistance: 10,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    isDebug: false,
    isFlat: false
  });

  client.write('position', {
    x: 0,
    y: 1,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  });

  modifyClient(client);
  
  client.sendChat(message_loading);

  client.on('close_window', () => {
    client.parentMenu == null;
    client.currentMenu = menu_map;
    updateClient(client);
  });

  client.on('window_click', function(packet){
      var slot = packet.slot;
      if (slot == client.functionalSlots[0]) {
        if(client.parentMenu.length == 0) {
          return;
        }
        client.currentMenu = client.parentMenu.pop();
        updateClient(client);
        return;
      }
      if (slot == client.functionalSlots[1]) {
        client.end(message_bye);
        return;
      }
      var selected = client.currentMenu[slot];
      if (selected == undefined || selected == null) return; 

      console.log('selected:', selected);
      if(selected.server) {
        target = selected.server;
        console.log('Transfering player [' + client.username + '] to server <' + target + '>... ');
        transferPlayer(client, target);
      }
      if (selected.servers) {
        client.currentMenuLabel = client.currentMenu[slot].title || '';
        client.parentMenu.push(client.currentMenu);
        client.currentMenu = selected.servers;
        updateClient(client);
      }
  });

  updateClient(client);
});

function updateClient(client){ 
  // close opened window first
  if(client.windowOpened) {
    client.write('close_window', {
      windowId: 10
    });
  }
  
  client.windowOpened = true;
  var slots_desired = 9;
  
  // Open the interface
  client.write('open_window', {
      windowId: 10,
      inventoryType: 'minecraft:chest', 
      windowTitle: JSON.stringify(menu_title + (client.parentMenu.length == 0 ? '' : (' - ' + client.currentMenuLabel))),
      slotCount: slots_desired,
      entityId: 0,
  });

  const items = [];

  // Add each of the menu items to the current menu
  client.currentMenu.forEach(serv => {
    items.push(!serv || serv.title == '' ? generateSpaceItem() : generateItem(serv.icon, serv.title, serv.lore));
  });

  // Generate back and quit buttons
  client.functionalSlots = [slots_desired - 2, slots_desired - 1];
  for(i = items.length; i < slots_desired; i++) {
    if (i == client.functionalSlots[0]) {
      if(client.parentMenu.length != 0) {
        items[i] = generateItem(item_functional, '<< BACK', []);
      } else {
        items[i] = generateSpaceItem();
      }
      continue;
    }
    if (i == client.functionalSlots[1]) {
      items[i] = generateItem(item_functional, 'X QUIT', []);
      continue;
    }
    items[i] = generateSpaceItem();
  }

  // Push the data to the client
  client.write('window_items', {
      windowId: 10,
      items: items
  });
}

function modifyClient(client) {
  client.windowOpened = false;
  client.currentMenu = menu_map;
  client.currentMenuLabel = null;
  client.parentMenu = [];
  client.functionalSlots = []; // back, exit
  client.sendChat = (message) => {
    const msg = {
      translate: 'chat.type.announcement',
      with: [
        'SERVER',
        message,
      ]
    };
    client.write('chat', { message: JSON.stringify(msg), position: 0, sender: '0' });
  };
}

function transferPlayer(client, target) {
  var buff_connect = new Buffer.alloc(2+7+2+target.length);
  var offset = 0;
  buff_connect.writeUInt16BE(7, offset);
  offset += 2;
  buff_connect.write('Connect', offset, encoding='utf8');
  offset += 7;
  buff_connect.writeUInt16BE(target.length, offset);
  offset += 2;
  buff_connect.write(target, offset, target.length, 'utf8');
  // offset += target.length;
  client.write('custom_payload', {
    channel: 'BungeeCord',
    data: buff_connect
  });
}

function generateItem(id = 0, label = '', lores = []) {
  var displayValue = {
    Name: {
      type: 'string',
      value: JSON.stringify(label),
    },
    Lore: {
      type: 'list',
      value: {
        type: 'string',
        value: lores.map(l => JSON.stringify(l)),
      }
    }
  };

  return {
      present: true,
      itemId: id,
      itemCount: 1,
      nbtData: {
        name: '',
        type: 'compound',
        value: {
          display: {
            type: 'compound',
            value: displayValue
          }
        }
      }
    }
}

function generateSpaceItem() {
  return generateItem();
}
