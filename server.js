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

// format 'Display Name': [ITEM_ID, [LORES], {sub-menu} or 'server-name']
const empty_item = [0, [], '']
const menu_map = {
  'Lobby': [1, ['Server lobby', '', `${COLOR.RED}[v1.12.2+]`], 'lobby'],
  '-': empty_item,
  'Survival': [37, ['Vanilla survival', '', `${COLOR.RED}[v1.16.3]`], 'survival'],
  'Skyblock': [8, ['Vanilla skyblock', '', `${COLOR.RED}[v1.16.3]`], 'skyblock'],
  '--': empty_item,
  'Modded': [75, ['A list of all our modded minecraft servers'], {
    'ATM3': [102, ['All the mods 3', '', `${COLOR.RED}[v1.14.2]`], 'atm3']
  }],
};
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
      var selected = client.currentMenu[Object.keys(client.currentMenu)[slot]];
      if (selected == undefined || selected == null) return; 
      var target = selected[2];
      if(target == null) return;
      if(type(target) == 'string') {
        if (target !== '') {
          console.log('Transfering player [' + client.username + '] to server <' + target + '>... ');
          transferPlayer(client, target);
        }
      } else {
        client.currentMenuLabel = Object.keys(client.currentMenu)[slot];
        client.parentMenu.push(client.currentMenu);
        client.currentMenu = target;
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
    // keep that set to true
  }
  
  client.windowOpened = true;
  var slots_desired = ((parseInt(Object.keys(client.currentMenu).length / 9)) + 1) * 45;
  client.write('open_window', {
      windowId: 10,
      inventoryType: 'minecraft:chest', 
      windowTitle: JSON.stringify(menu_title + (client.parentMenu.length == 0 ? '' : (' - ' + client.currentMenuLabel))),
      slotCount: slots_desired,
      entityId: 0,
  });
  var items = [];
  var items_i = 0;
  for(var label in client.currentMenu) {
    if (client.currentMenu[label][2] == '') {
      items.push(generateSpaceItem());
    } else {
      items.push(generateItem(client.currentMenu[label][0], label, client.currentMenu[label][1]));
    }
    items_i ++;
  }
  client.functionalSlots = [slots_desired - 2, slots_desired - 1];
  for(var i = items_i; i < slots_desired; i++) {
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
