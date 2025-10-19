import * as sprites from '../assets/scripts/sprites.js';
import * as symbols from '../assets/scripts/symbols.js';

export default class Game_Scene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() { 
    sprites.loadGameSprites(this);
    this.load.audio('menuBgm', '../assets/audio/bgm/MenuBgm.ogg');
   }

  create() {
    this.background = this.add.image(this.scale.width / 2, this.scale.height / 2, 'background').setOrigin(0.5);
    this.menuBgm = null;
    this.endTurnActive = true
    // Initialize drag tracking variables first
    this.draggedSymbol = null;
    this.originalSlot = null;
    this.dragOffset = { x: 0, y: 0 };
    
    this.createGrid();
    this.createInventory();
    this.createStartButton();
    this.createEndTurnButton();
    
    // Enable drag and drop - do this AFTER creating interactive objects
    this.input.on('dragstart', (pointer, gameObject) => {
      this.onDragStart(pointer, gameObject);
    });
    
    this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
      this.onDrag(pointer, gameObject, dragX, dragY);
    });
    
    this.input.on('dragend', (pointer, gameObject) => {
      this.onDragEnd(pointer, gameObject);
    });
  }

  update() { }

  // Helper method to calculate text position
  getTextLeftMargin(slot) {
    const slotWidth = slot.displayWidth || slot.width || 36;
    return slotWidth / 2 + 0; // Half slot width + padding
  }

  // ---------------- GRID ----------------
  createGrid() {
    const { width, height } = this.scale;
    this.gridBack = this.add.image(width / 2, (height / 2) - 50, 'gridBack').setOrigin(0.5);

    const rows = 8, cols = 8, slotSize = 36, gap = 4;
    const startX = (width - (cols * slotSize + (cols - 1) * gap)) / 2 + slotSize / 2;
    const startY = ((height - (rows * slotSize + (rows - 1) * gap)) / 2 + slotSize / 2) - 50;

    this.slots = [];
    for (let y = 0; y < rows; y++) {
      this.slots[y] = [];
      for (let x = 0; x < cols; x++) {
        const slot = this.add.image(startX + x * (slotSize + gap), startY + y * (slotSize + gap), 'emptySlot').setOrigin(0.5);
        slot.used = false;
        slot.symbol = null;
        slot.gridX = x;
        slot.gridY = y;
        this.slots[y][x] = slot;
      }
    }
  }

  // ---------------- INVENTORY ----------------
  createInventory() {
    const { width, height } = this.scale;
    this.inventoryBack = this.add.image(width / 2, height - 200, 'inventoryBack').setOrigin(0.5, 1);

    const cols = 8, slotSize = 36, gap = 4;
    const startX = this.inventoryBack.x - (cols * slotSize + (cols - 1) * gap) / 2 + slotSize / 2;
    const startY = this.inventoryBack.y - this.inventoryBack.height / 2;

    this.inventorySlots = [];
    for (let i = 0; i < cols; i++) {
      const slot = this.add.image(startX + i * (slotSize + gap), startY, 'emptySlot').setOrigin(0.5);
      slot.inventoryIndex = i;
      this.inventorySlots.push({ slot, symbol: null });
    }
  }

  // Drag event handlers
  onDragStart(pointer, gameObject) {
    const symbol = gameObject;
    
    // ONLY allow dragging for symbols that are placed on grid AND are movable
    if (!symbol.placedOnGrid || symbol.symbolData.movement !== 'movable') {
      this.input.setDraggable(symbol, false);
      return;
    }
    
    this.draggedSymbol = symbol;
    symbol.setAlpha(0.7);
    
    // Calculate offset for smooth dragging
    this.dragOffset.x = symbol.x - pointer.worldX;
    this.dragOffset.y = symbol.y - pointer.worldY;
    
    // Bring symbol to top
    symbol.setDepth(1000);
    if (symbol.valueText) {
      symbol.valueText.setDepth(1001);
    }
    
    // Store original slot info and free it up
    this.originalSlot = this.findSlotForSymbol(symbol);
    if (this.originalSlot) {
      this.originalSlot.used = false;
      this.originalSlot.symbol = null;
      this.originalSlot.setTexture('emptySlot');
    }
  }

  onDrag(pointer, gameObject, dragX, dragY) {
    const symbol = gameObject;
    if (this.draggedSymbol !== symbol) return;
    
    symbol.x = dragX + this.dragOffset.x;
    symbol.y = dragY + this.dragOffset.y;
    
    // Move value text with symbol - APPLY LEFT MARGIN HERE
    if (symbol.valueText) {
      const currentSlot = this.findSlotForSymbol(symbol) || { width: 36 };
      const leftMargin = this.getTextLeftMargin(currentSlot);
      symbol.valueText.x = symbol.x - leftMargin;
      symbol.valueText.y = symbol.y;
    }
  }

  onDragEnd(pointer, gameObject) {
    const symbol = gameObject;
    if (this.draggedSymbol !== symbol) return;
    
    symbol.setAlpha(1);
    symbol.setDepth(0);
    if (symbol.valueText) {
      symbol.valueText.setDepth(1);
    }
    
    // Find the closest valid slot
    const targetSlot = this.findClosestEmptySlot(symbol.x, symbol.y);
    
    if (targetSlot && !targetSlot.used) {
      // Place symbol in the new slot
      this.placeSymbolInSlot(symbol, targetSlot);
    } else if (this.originalSlot && !this.originalSlot.used) {
      // Return to original slot
      this.placeSymbolInSlot(symbol, this.originalSlot);
    } else {
      // Find any empty slot
      const emptySlot = this.findAnyEmptySlot();
      if (emptySlot) {
        this.placeSymbolInSlot(symbol, emptySlot);
      } else {
        // If no empty slots, return to original position
        this.returnSymbolToOriginalPosition(symbol);
      }
    }
    
    this.draggedSymbol = null;
    this.originalSlot = null;
  }

  // Setup symbol interaction (combines click and drag)
  setupSymbolInteraction(symbol, symbolData, inventorySlotIndex) {
    // Store original position for snap back if needed
    symbol.originalPosition = { x: symbol.x, y: symbol.y };
    symbol.currentSlotIndex = inventorySlotIndex;
    
    // For symbols in inventory (not placed on grid yet)
    if (!symbol.placedOnGrid) {
      // Use click to place on grid for ALL inventory symbols
      symbol.setInteractive(); // Make interactive but NOT draggable
      symbol.on('pointerdown', () => {
        this.placeSymbolOnGrid(symbol, symbolData, inventorySlotIndex);
      });
      
      // IMPORTANT: Disable dragging for inventory symbols
      this.input.setDraggable(symbol, false);
      
    } else {
      // For symbols already placed on grid
      if (symbol.symbolData.movement === 'movable') {
        // Enable dragging only for movable symbols on grid
        symbol.setInteractive({ draggable: true });
        this.input.setDraggable(symbol, true);
      } else {
        // Non-movable symbols on grid are not interactive (or can be clickable for other actions)
        symbol.setInteractive({ draggable: false });
        this.input.setDraggable(symbol, false);
      }
    }
  }

  // Helper method to place symbol on grid (from inventory to grid)
  placeSymbolOnGrid(symbol, symbolData, inventorySlotIndex) {
    if (symbol.placedOnGrid) return;

    // Find free main grid slots
    const free = [];
    this.slots.forEach(r => r.forEach(s => { if (!s.used) free.push(s); }));
    if (free.length === 0) return;
    const target = Phaser.Math.RND.pick(free);
    target.used = true
    // Smooth movement to main grid
    this.tweens.add({
      targets: symbol,
      x: target.x,
      y: target.y,
      duration: 400,
      ease: 'Power2',
      onStart: () => {
        symbol.disableInteractive();
      },
      onComplete: () => {
          symbol.placedOnGrid = true;
        // After placing on grid, set up appropriate interaction
        if (symbol.symbolData.movement === 'movable') {
          // Enable dragging for movable symbols on grid
          symbol.setInteractive({ draggable: true });
          this.input.setDraggable(symbol, true);
        } else {
          // Non-movable symbols on grid are not interactive
          symbol.setInteractive({ draggable: false });
          this.input.setDraggable(symbol, false);
        }
      }
    });

    // Create value text with smooth movement
    if (!symbol.valueText) {
      symbol.valueText = this.add.text(symbol.x, symbol.y, symbolData.baseValue.toString(), {
        fontFamily: 'DefaultFont',
        fontSize: '16px',
        stroke: '#000000',
        strokeThickness: 4,
        fill: '#ffffff'
      }).setOrigin(0, 0); 
      
      const leftMargin = this.getTextLeftMargin(target);
      symbol.valueText.x = symbol.x - leftMargin;

      this.tweens.add({
        targets: symbol.valueText,
        x: target.x - leftMargin,
        y: target.y,
        duration: 400,
        ease: 'Power2',
        onComplete: () => {
          target.symbol = symbol;
          if (symbol.symbolData.movement === 'movable') {
            target.setTexture('movableSlot');
          } else {
            target.setTexture('usedSlot');
          }
        }
      });
    } else {
      const leftMargin = this.getTextLeftMargin(target);
      this.tweens.add({
        targets: symbol.valueText,
        x: target.x - leftMargin,
        y: target.y,
        duration: 400,
        ease: 'Power2'
      });
    }

    const currentInvSlotIndex = symbol.currentSlotIndex;
    if (currentInvSlotIndex !== undefined && this.inventorySlots[currentInvSlotIndex]) {
      const invSlot = this.inventorySlots[currentInvSlotIndex];
      invSlot.slot.setTexture('emptySlot');
      invSlot.symbol = null;
    }
  }

  // Helper method to find closest empty slot
  findClosestEmptySlot(x, y) {
    let closestSlot = null;
    let minDistance = Number.MAX_VALUE;
    
    for (let row of this.slots) {
      for (let slot of row) {
        if (!slot.used) {
          const distance = Phaser.Math.Distance.Between(x, y, slot.x, slot.y);
          if (distance < minDistance) {
            minDistance = distance;
            closestSlot = slot;
          }
        }
      }
    }
    
    // Only return if within a reasonable distance (slot size + some padding)
    return minDistance < 50 ? closestSlot : null;
  }

  // Helper method to find any empty slot
  findAnyEmptySlot() {
    for (let row of this.slots) {
      for (let slot of row) {
        if (!slot.used) return slot;
      }
    }
    return null;
  }

  // Helper method to find slot for a symbol
  findSlotForSymbol(symbol) {
    for (let row of this.slots) {
      for (let slot of row) {
        if (slot.symbol === symbol) {
          return slot;
        }
      }
    }
    return null;
  }

  // Helper method to place symbol in a specific slot
  placeSymbolInSlot(symbol, slot) {
    const leftMargin = this.getTextLeftMargin(slot);
    
    // Smooth movement to slot
    this.tweens.add({
      targets: [symbol],
      x: slot.x,
      y: slot.y,
      duration: 200,
      ease: 'Power2'
    });

    if (symbol.valueText) {
      this.tweens.add({
        targets: [symbol.valueText],
        x: slot.x - leftMargin, // APPLY LEFT MARGIN HERE
        y: slot.y,
        duration: 200,
        ease: 'Power2'
      });
    }

    // Update slot and symbol properties
    slot.used = true;
    slot.symbol = symbol;
    symbol.placedOnGrid = true;
    
    if (symbol.symbolData.movement === 'movable') {
      slot.setTexture('movableSlot');
      // Keep symbol draggable since it's movable and on grid
      symbol.setInteractive({ draggable: true });
      this.input.setDraggable(symbol, true);
    } else {
      slot.setTexture('usedSlot');
      // Non-movable symbols on grid are not draggable
      symbol.setInteractive({ draggable: false });
      this.input.setDraggable(symbol, false);
    }
  }

  // Helper method to return symbol to original position
  returnSymbolToOriginalPosition(symbol) {
    const originalSlot = this.findSlotForSymbol(symbol) || { width: 36 };
    const leftMargin = this.getTextLeftMargin(originalSlot);
    
    this.tweens.add({
      targets: [symbol],
      x: symbol.originalPosition.x,
      y: symbol.originalPosition.y,
      duration: 200,
      ease: 'Power2'
    });

    if (symbol.valueText) {
      this.tweens.add({
        targets: [symbol.valueText],
        x: symbol.originalPosition.x - leftMargin, // APPLY LEFT MARGIN HERE
        y: symbol.originalPosition.y,
        duration: 200,
        ease: 'Power2'
      });
    }
  }

  // The rest of your existing methods remain the same...
  addInventorySymbol(invSlotObj, index) {
    const { slot } = invSlotObj;
    const symbolData = symbols.generateSymbol()
    const symbol = this.add.sprite(slot.x, slot.y, symbolData.sprite[0], symbolData.sprite[1]).setOrigin(0.5);
    symbol.visible = true;
    symbol.setScale(0);
    symbol.placedOnGrid = false;
    symbol.currentSlotIndex = index;
    symbol.symbolData = symbolData;

    this.tweens.add({ targets: symbol, scale: 1, duration: 300, ease: 'Back.Out' });

    if (symbol.symbolData.movement === 'movable') {
      slot.setTexture('movableSlot');
    } else {
      slot.setTexture('usedSlot');
    }
    invSlotObj.symbol = symbol;

    // Use the reusable interaction handler
    this.setupSymbolInteraction(symbol, symbolData, index);
  }

createStartButton() {
  const { width } = this.scale;

  const startBtn = this.add.text(width / 2, 40, 'START', {
    fontSize: '28px',
    fontFamily: 'Arial',
    color: '#ffffff',
    backgroundColor: '#ff9900',       // base color
    padding: { x: 20, y: 10 },
    stroke: '#000000',
    strokeThickness: 3,
    shadow: {
      offsetX: 3,
      offsetY: 3,
      color: '#000000',
      blur: 4,
      stroke: true,
      fill: true
    }
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  // Hover effect
  startBtn.on('pointerover', () => {
    startBtn.setStyle({ backgroundColor: '#ffaa33', color: '#fff8e7' });
    startBtn.setScale(1.05);
  });
  startBtn.on('pointerout', () => {
    startBtn.setStyle({ backgroundColor: '#ff9900', color: '#ffffff' });
    startBtn.setScale(1);
  });

  startBtn.on('pointerdown', () => {
    startBtn.setVisible(false);
    startBtn.disableInteractive();

    // Play BGM
    if (!this.menuBgm) {
      this.menuBgm = this.sound.add('menuBgm', { loop: true, volume: 0.5 });
    }
    this.menuBgm.play();

    // Fill inventory
    const emptySlots = this.inventorySlots.filter(s => !s.symbol || s.symbol.placedOnGrid);
    for (let i = 0; i < Math.min(4, emptySlots.length); i++) {
      const index = this.inventorySlots.indexOf(emptySlots[i]);
      this.addInventorySymbol(emptySlots[i], index);
    }
  });
}

 
  // Add this new method to your class
// Updated method to include movable slots as free slots
moveRandomSymbols() {
  const randomSymbols = [];

  // Collect all symbols with random movement
  for (let row of this.slots) {
    for (let slot of row) {
      if (slot.used && slot.symbol && slot.symbol.symbolData.movement === 'random' && !slot.destroyed) {
        randomSymbols.push({
          symbol: slot.symbol,
          originalSlot: slot
        });
      }
    }
  }

  if (randomSymbols.length === 0) return;

  // Collect all valid target slots (empty + random symbols)
  const targetSlots = [];
  for (let row of this.slots) {
    for (let slot of row) {
      if (!slot.used || (slot.used && slot.symbol && slot.symbol.symbolData.movement === 'random' && !slot.destroyed)) {
        targetSlots.push(slot);
      }
    }
  }

  // Shuffle possible targets
  const availableTargets = Phaser.Utils.Array.Shuffle([...targetSlots]);
  const moves = [];

  // Assign unique target to each symbol
  randomSymbols.forEach(({ symbol, originalSlot }) => {
    // Filter out original slot
    const validTargets = availableTargets.filter(s => s !== originalSlot);
    if (validTargets.length === 0) return;

    const targetSlot = validTargets[0]; // first valid one
    moves.push({ symbol, fromSlot: originalSlot, toSlot: targetSlot });

    // Mark slots
    originalSlot.used = false;
    originalSlot.symbol = null;
    originalSlot.setTexture('emptySlot');

    // Remove target from available list
    availableTargets.splice(availableTargets.indexOf(targetSlot), 1);
  });

  // Assign symbols to new slots
  moves.forEach(({ symbol, toSlot }) => {
    toSlot.used = true;
    toSlot.symbol = symbol;
  });

  // Animate movements
  moves.forEach(({ symbol, toSlot }) => {
    if (symbol.destroyed) return;
    this.tweens.add({
      targets: [symbol],
      x: toSlot.x,
      y: toSlot.y,
      duration: 400,
      ease: 'Back.easeInOut',
      onComplete: () => {
        toSlot.setTexture('usedSlot');
      }
    });

    if (symbol.valueText) {
      const leftMargin = this.getTextLeftMargin(toSlot);
      this.tweens.add({
        targets: [symbol.valueText],
        x: toSlot.x - leftMargin,
        y: toSlot.y,
        duration: 400,
        ease: 'Back.easeInOut'
      });
    }
  });
}


// Update the createEndTurnButton method to use this function
createEndTurnButton() {
  const { width } = this.scale;

  const endButton = this.add.text(width - 80, 20, 'END TURN', {
    fontSize: '20px',
    color: '#ffffff',
    backgroundColor: '#000000',
    padding: { x: 10, y: 5 }
  }).setOrigin(0.5).setInteractive();

  endButton.on('pointerdown', () => {
    if (!this.inventorySlots || !this.endTurnActive) return;

    this.endTurnActive = false;
    this.applySymbolEffects();

    let tweensToWait = 0;

    // ---------------- MOVE RANDOM SYMBOLS ----------------
    const randomSymbols = [];
    for (let row of this.slots) {
      for (let slot of row) {
        if (slot.used && slot.symbol && slot.symbol.symbolData.movement === 'random') {
          randomSymbols.push({ symbol: slot.symbol, originalSlot: slot });
        }
      }
    }

    const targetSlots = [];
    for (let row of this.slots) {
      for (let slot of row) {
        if (!slot.used || (slot.used && slot.symbol && slot.symbol.symbolData.movement === 'random')) {
          targetSlots.push(slot);
        }
      }
    }

    const availableTargets = Phaser.Utils.Array.Shuffle([...targetSlots]);
    const moves = [];

    randomSymbols.forEach(({ symbol, originalSlot }) => {
      const validTargets = availableTargets.filter(s => s !== originalSlot);
      if (validTargets.length === 0) return;

      const targetSlot = validTargets[0];
      moves.push({ symbol, fromSlot: originalSlot, toSlot: targetSlot });

      originalSlot.used = false;
      originalSlot.symbol = null;
      originalSlot.setTexture('emptySlot');

      availableTargets.splice(availableTargets.indexOf(targetSlot), 1);
    });

    moves.forEach(({ symbol, toSlot }) => {
      toSlot.used = true;
      toSlot.symbol = symbol;
    });

    // Animate random symbol movement
    moves.forEach(({ symbol, toSlot }) => {
      tweensToWait++;
      this.tweens.add({
        targets: [symbol],
        x: toSlot.x,
        y: toSlot.y,
        duration: 400,
        ease: 'Back.easeInOut',
        onComplete: () => {
          toSlot.setTexture('usedSlot');
          tweensToWait--;
          checkAllDone();
        }
      });

      if (symbol.valueText) {
        const leftMargin = this.getTextLeftMargin(toSlot);
        tweensToWait++;
        this.tweens.add({
          targets: [symbol.valueText],
          x: toSlot.x - leftMargin,
          y: toSlot.y,
          duration: 400,
          ease: 'Back.easeInOut',
          onComplete: () => {
            tweensToWait--;
            checkAllDone();
          }
        });
      }
    });

    // ---------------- INVENTORY PROCESSING ----------------
    const slots = this.inventorySlots;

    const continueAfterFadeout = () => {
      for (let i = slots.length - 1; i > 0; i--) {
        const prevSymbol = slots[i - 1].symbol;
        if (prevSymbol && !prevSymbol.placedOnGrid) {
          prevSymbol.x = slots[i].slot.x;
          prevSymbol.y = slots[i].slot.y;
          slots[i].symbol = prevSymbol;
          if (prevSymbol.symbolData.movement === 'movable') {
            slots[i].slot.setTexture('movableSlot');
          } else {
            slots[i].slot.setTexture('usedSlot');
          }

          slots[i - 1].symbol = null;
          slots[i - 1].slot.setTexture('emptySlot');
          prevSymbol.currentSlotIndex = i;
        }
      }

      const firstSlot = slots[0];
      if (!firstSlot.symbol || firstSlot.symbol.placedOnGrid) {
        const symbolData = symbols.generateSymbol();
        const newSymbol = this.add.sprite(firstSlot.slot.x, firstSlot.slot.y, symbolData.sprite[0], symbolData.sprite[1]).setOrigin(0.5);
        newSymbol.visible = true;
        newSymbol.setScale(0);
        newSymbol.placedOnGrid = false;
        newSymbol.symbolData = symbolData;
        newSymbol.currentSlotIndex = 0;

        tweensToWait++;
        this.tweens.add({
          targets: newSymbol,
          scale: 1,
          duration: 300,
          ease: 'Back.Out',
          onComplete: () => {
            tweensToWait--;
            checkAllDone();
          }
        });

        firstSlot.symbol = newSymbol;
        if (newSymbol.symbolData.movement === 'movable') {
          firstSlot.slot.setTexture('movableSlot');
        } else {
          firstSlot.slot.setTexture('usedSlot');
        }

        this.setupSymbolInteraction(newSymbol, symbolData, 0);
      }
    };

    const lastSlot = slots[slots.length - 1];
    if (lastSlot.symbol && !lastSlot.symbol.placedOnGrid) {
      tweensToWait++;
      this.tweens.add({
        targets: [lastSlot.symbol, lastSlot.slot],
        alpha: 0,
        scale: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          lastSlot.symbol.destroy();
          lastSlot.symbol = null;
          lastSlot.slot.setTexture('emptySlot');
          lastSlot.slot.setAlpha(1);
          lastSlot.slot.setScale(1);
          continueAfterFadeout();
          tweensToWait--;
          checkAllDone();
        }
      });
    } else {
      continueAfterFadeout();
    }

    const checkAllDone = () => {
  if (tweensToWait <= 0) {
    this.endTurnActive = true;
  }
};

  });
}


// --- SYMBOL EFFECTS ---
applySymbolEffects() {
  for (let row of this.slots) {
    for (let slot of row) {
      if (!slot.used || !slot.symbol) continue;

      const symbol = slot.symbol;
      const data = symbol.symbolData;

      if (data.key === 'cherry') {
  // Count cherries on the grid except this one
  let otherCherries = 0;
  for (let row of this.slots) {
    for (let s of row) {
      if (s.used && s.symbol && s.symbol.symbolData.key === 'cherry' && s !== slot) {
        otherCherries++;
      }
    }
  }

  // Chance: 100% - 1% per other cherry
  const chance = Math.max(0.15, 1 - 0.03 * otherCherries); // 3% reduction per cherry, min 10%

  // Apply shape-based bonus only if roll succeeds
  if (Math.random() < chance) {
    let valueChange = 0;
    const dirs = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    for (let d of dirs) {
      const nx = slot.gridX + d.x;
      const ny = slot.gridY + d.y;
      if (ny < 0 || ny >= this.slots.length) continue;
      if (nx < 0 || nx >= this.slots[0].length) continue;

      const neighbor = this.slots[ny][nx];
      if (neighbor.used && neighbor.symbol) {
        const nType = neighbor.symbol.symbolData.type;
        if (nType === 'fruit') valueChange += 1;
      }
    }

    data.baseValue += valueChange;
    if (symbol.valueText) symbol.valueText.setText(data.baseValue.toString());
  }
}

      // Banana effect: +1 every turn, 15% chance to be destroyed
if (data.key === 'banana') {
  data.baseValue += 1;
  symbol.valueText.setText(data.baseValue.toString());

  // 15% destroy chance
  if (Math.random() < 0.15) {
    // find the slot and clear it
    slot.used = false;
    slot.symbol = null;
    slot.setTexture('emptySlot');

    // fade out and destroy
    this.tweens.add({
      targets: [symbol, symbol.valueText],
      alpha: 0,
      duration: 300,
      onComplete: () => {
        symbol.destroy();
        if (symbol.valueText) symbol.valueText.destroy();
      }
    });
  }
}
// Strawberry effect: +1 if NOT surrounded by any fruits in all 8 directions
if (data.key === 'strawberry') {
  const dirs = [
    { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 0 },                  { x: 1, y: 0 },
    { x: -1, y: 1 },  { x: 0, y: 1 },  { x: 1, y: 1 },
  ];

  let hasFruitNearby = false;

  for (let d of dirs) {
    const nx = slot.gridX + d.x;
    const ny = slot.gridY + d.y;
    if (ny < 0 || ny >= this.slots.length) continue;
    if (nx < 0 || nx >= this.slots[0].length) continue;

    const neighbor = this.slots[ny][nx];
    if (neighbor.used && neighbor.symbol) {
      const nType = neighbor.symbol.symbolData.type;
      if (nType === 'fruit') {
        hasFruitNearby = true;
        break;
      }
    }
  }

  if (!hasFruitNearby) {
    data.baseValue += 1;
    symbol.valueText.setText(data.baseValue.toString());
  }
}

// Orange effect: +1 for each fruit in an X shape, each affected fruit -1 if >1
if (data.key === 'orange') {
  const dirs = [
    { x: -1, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 1 },  { x: 1, y: 1 },
  ];

  let gain = 0;
  const neighborsToDecrease = [];

  for (let d of dirs) {
    const nx = slot.gridX + d.x;
    const ny = slot.gridY + d.y;
    if (ny < 0 || ny >= this.slots.length) continue;
    if (nx < 0 || nx >= this.slots[0].length) continue;

    const neighbor = this.slots[ny][nx];
    const nSymbol = neighbor?.symbol;
    const nData = nSymbol?.symbolData;

    // Skip if no symbol, no data, or other orange
    if (!nSymbol || !nData || nData.key === 'orange') continue;

    if (nData.type === 'fruit' && nData.baseValue > 1) {
      gain += 2;
      neighborsToDecrease.push(nSymbol);
    }
  }

  // Reduce neighbors after calculating gain
  neighborsToDecrease.forEach(nSymbol => {
    const nData = nSymbol.symbolData;
    nData.baseValue = Math.max(1, nData.baseValue - 1);
    if (nSymbol.valueText) nSymbol.valueText.setText(nData.baseValue.toString());
  });

  if (gain > 0) {
    data.baseValue += gain;
    if (symbol.valueText) symbol.valueText.setText(data.baseValue.toString());
  }
}

if (data.key === 'lemon') {
  // + shape
  const plusDirs = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  // X shape
  const xDirs = [
    { x: -1, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 1 },  { x: 1, y: 1 },
  ];

  let gain = 0;
  let hasOtherFruit = false;

  // Check diagonals for other fruits
  for (let d of xDirs) {
    const nx = slot.gridX + d.x;
    const ny = slot.gridY + d.y;
    if (ny < 0 || ny >= this.slots.length) continue;
    if (nx < 0 || nx >= this.slots[0].length) continue;

    const neighbor = this.slots[ny][nx];
    if (neighbor.used && neighbor.symbol) {
      const nData = neighbor.symbol.symbolData;
      if (nData.type === 'fruit' && nData.key !== 'lemon') {
        hasOtherFruit = true;
        break;
      }
    }
  }

  if (!hasOtherFruit) {
    for (let d of plusDirs) {
      const nx = slot.gridX + d.x;
      const ny = slot.gridY + d.y;
      if (ny < 0 || ny >= this.slots.length) continue;
      if (nx < 0 || nx >= this.slots[0].length) continue;

      const neighbor = this.slots[ny][nx];
      if (neighbor.used && neighbor.symbol) {
        const nData = neighbor.symbol.symbolData;
        if (nData.key === 'lemon') gain += 1;
      }
    }

    if (gain > 0) {
      data.baseValue += gain;
      if (symbol.valueText) symbol.valueText.setText(data.baseValue.toString());
    }
  }
}

if (data.key === 'watermelon') {
  const nx = slot.gridX;
  const ny = slot.gridY + 1;

  // Gain +1 every turn
  data.baseValue += 1;
  if (symbol.valueText) symbol.valueText.setText(data.baseValue.toString());

  // Destroy fruit below if present
  if (ny >= 0 && ny < this.slots.length && nx >= 0 && nx < this.slots[0].length) {
    const below = this.slots[ny][nx];
    if (below.used && below.symbol) {
      const bSym = below.symbol;
      const bData = bSym.symbolData;

      if (bData.type === 'fruit' && bData.key != 'watermelon') {
        below.used = false;
        below.symbol = null;
        below.setTexture('emptySlot'); // reset slot texture

        this.tweens.add({
          targets: [bSym, bSym.valueText],
          alpha: 0,
          duration: 200,
          onComplete: () => {
            if (bSym.valueText) bSym.valueText.destroy();
            bSym.destroy();
          }
        });
      }
    }
  }
}












    }
  }
}





}


