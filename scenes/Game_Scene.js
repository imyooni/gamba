import * as sprites from '../assets/scripts/sprites.js';
import * as symbols from '../assets/scripts/symbols.js';
import { AudioManager } from '../assets/scripts/audio.js';

export default class Game_Scene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.audioManager = new AudioManager(this);
  }

  preload() {
    sprites.loadGameSprites(this);
    this.audioManager.loadAudio();
    // audio.loadGameAudio(this)
  }

  create() {
    this.background = this.add.image(this.scale.width / 2, this.scale.height / 2, 'Background').setOrigin(0.5);

    this.endTurnActive = true
    // Initialize drag tracking variables first
    this.draggedSymbol = null;
    this.originalSlot = null;
    this.dragOffset = { x: 0, y: 0 };

    this.createGrid();
    this.createInventory();
    this.createEndTurnButton();
    this.createEndDayButton();
    this.createStartButton();

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

 formatValue(value) {
    if (value < 1000) return value.toString();                  // 0 - 999
    if (value < 10000) return (value / 1000).toFixed(1) + 'k'; // 1,000 - 9,999
    if (value < 100000) return Math.floor(value / 1000) + 'k'; // 10,000 - 99,999
    if (value < 1000000) return (value / 1000).toFixed(1) + 'k'; // 100,000 - 999,999
    if (value < 1000000000) return (value / 1000000).toFixed(1) + 'M'; // 1M - 999M
    if (value < 1000000000000) return (value / 1000000000).toFixed(1) + 'B'; // 1B - 999B
    return (value / 1000000000000).toFixed(1) + 'T'; // 1T+
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
        const slot = this.add.image(startX + x * (slotSize + gap), startY + y * (slotSize + gap), 'baseSlots', 0).setOrigin(0.5);
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
      const slot = this.add.image(startX + i * (slotSize + gap), startY, 'baseSlots', 0).setOrigin(0.5);
      slot.inventoryIndex = i;
      this.inventorySlots.push({ slot, symbol: null });
    }
  }

  // Drag event handlers
  onDragStart(pointer, gameObject) {
    const symbol = gameObject;

    // ONLY allow dragging for symbols that are placed on grid AND are movable
    if (!symbol.placedOnGrid || symbol.symbolData.movement[0] !== 'movable') {
      this.input.setDraggable(symbol, false);
      return;
    }

    this.audioManager.playSfx('grab', 0.35)
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
      this.originalSlot.setTexture('baseSlots', 0);
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

    this.audioManager.playSfx('grab', 0.35)
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
      if (symbol.symbolData.movement[0] === 'movable') {
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
    this.audioManager.playSfx('selected', 0.5)
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
        if (symbol.symbolData.movement[0] === 'movable') {
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
          target.setTexture('baseSlots', symbol.symbolData.movement[1])
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
      invSlot.slot.setTexture('baseSlots', 0);
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
    slot.setTexture('baseSlots', symbol.symbolData.movement[1]);
    if (symbol.symbolData.movement[0] === 'movable') {
      // Keep symbol draggable since it's movable and on grid
      symbol.setInteractive({ draggable: true });
      this.input.setDraggable(symbol, true);
    } else {
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
    symbol.isProtected = []

    this.tweens.add({ targets: symbol, scale: 1, duration: 300, ease: 'Back.Out' });
    slot.setTexture('baseSlots', symbol.symbolData.movement[1]);
    invSlotObj.symbol = symbol;

    // Use the reusable interaction handler
    this.setupSymbolInteraction(symbol, symbolData, index);
  }

  createStarterSelection() {
    const { width, height } = this.scale;
    const panelSpacing = 60;
    const centerX = width / 2;
    const panels = [];

    for (let i = 0; i < 3; i++) {
      const panelY = height / 2 + (i - 1) * panelSpacing;
      const panel = this.add.rectangle(centerX, panelY, 300, 50, 0x000000, 0.5)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive();
      panel.symbols = [];
      panel.slots = []; // store slot sprites

      const symbolCount = 4;
      const spacing = 36;
      const totalWidth = (symbolCount - 1) * spacing;
      const startX = centerX - totalWidth / 2;

      for (let j = 0; j < symbolCount; j++) {
        const data = symbols.generateSymbol();

        // Slot background
        const slot = this.add.sprite(startX + j * spacing, panelY, 'baseSlots', data.movement[1])
          .setScale(0.9);
        panel.slots.push(slot); // store slot

        // Fruit symbol on top
        const fruit = this.add.sprite(slot.x, slot.y, data.sprite[0], data.sprite[1])
          .setScale(0.9)
          .setInteractive();

        fruit.symbolData = data;
        panel.symbols.push(fruit);
      }

      panel.on('pointerover', () => panel.setFillStyle(0xffffff, 0.2));
      panel.on('pointerout', () => panel.setFillStyle(0x000000, 0.5));
      panel.on('pointerdown', () => this.selectStarterPack(panels, panel));

      panels.push(panel);
    }

    this.starterPanels = panels;
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
    }).setOrigin(0.5).setInteractive();
    this.startButton = startBtn

    this.days = 1;
    this.daysText = this.add.text(20, 10, 'Day 1', {
      fontFamily: 'DefaultFont',
      fontSize: '24px',
      stroke: '#000000',
      strokeThickness: 4,
      fill: '#F4A460'
    })
    this.daysText.setVisible(false)

    this.score = 0;
    this.scoreText = this.add.text(20, 110, '0', {
      fontFamily: 'DefaultFont',
      fontSize: '24px',
      stroke: '#000000',
      strokeThickness: 4,
      fill: '#ffd000ff'
    })
    this.scoreText.setVisible(false)

    this.coins = [5, 5];
    this.coinsText = this.add.text(20, 80, `Coins: ${this.coins[0]}/${this.coins[1]}`, {
      fontFamily: 'DefaultFont',
      fontSize: '24px',
      stroke: '#000000',
      strokeThickness: 4,
      fill: '#ffd000ff'
    })
    this.coinsText.setVisible(false)

    this.goal = 50;
    this.goalText = this.add.text(210, 110, 'Goal: 50', {
      fontFamily: 'DefaultFont',
      fontSize: '24px',
      stroke: '#000000',
      strokeThickness: 4,
      fill: '#00ff9dff'
    })
    this.goalText.setVisible(false)
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
      this.startButton.setVisible(false);
      this.createStarterSelection();


      this.daysText.setVisible(true)
      this.audioManager.playBgm('menuBgm', 0.25);


    });
  }


  selectStarterPack(allPanels, selectedPanel) {
    // Remove other panels, their symbols and slots
    allPanels.forEach(p => {
      if (p !== selectedPanel) {
        // Destroy fruit symbols
        p.symbols.forEach(s => s.destroy());
        // Destroy slot sprites
        if (p.slots) p.slots.forEach(s => s.destroy());
        // Destroy optional backSprite
        if (p.backSprite) p.backSprite.destroy();
        p.destroy();
      }
    });

    // Move chosen symbols to inventory with smooth movement
    const emptySlots = this.inventorySlots.filter(s => !s.symbol);
    for (let i = 0; i < selectedPanel.symbols.length && i < emptySlots.length; i++) {
      const index = this.inventorySlots.indexOf(emptySlots[i]);
      const sym = selectedPanel.symbols[i];
      sym.setScale(1);
      sym.placedOnGrid = false;
      sym.currentSlotIndex = index;
      emptySlots[i].symbol = sym;

      // Smooth tween to inventory slot
      this.tweens.add({
        targets: sym,
        x: emptySlots[i].slot.x,
        y: emptySlots[i].slot.y,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          emptySlots[i].slot.setTexture('baseSlots', sym.symbolData.movement[1]);
          this.setupSymbolInteraction(sym, sym.symbolData, index);
        }
      });
    }

    // Remove selected panel and its slots/backSprite
    if (selectedPanel.slots) selectedPanel.slots.forEach(s => s.destroy());
    if (selectedPanel.backSprite) selectedPanel.backSprite.destroy();
    selectedPanel.destroy();

    this.endButton.setVisible(true)
    this.coinsText.setVisible(true)
    this.scoreText.setVisible(true)
    this.goalText.setVisible(true)
  }



  // Add this new method to your class
  // Updated method to include movable slots as free slots
  moveRandomSymbols() {
    const randomSymbols = [];

    // Collect all symbols with random movement
    for (let row of this.slots) {
      for (let slot of row) {
        if (slot.used && slot.symbol && slot.symbol.symbolData.movement[0] === 'random' && !slot.destroyed) {
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
        if (!slot.used || (slot.used && slot.symbol && slot.symbol.symbolData.movement[0] === 'random' && !slot.destroyed)) {
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
      originalSlot.setTexture('baseSlots', 0);

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
          toSlot.setTexture('baseSlots', symbol.symbolData.movement[1]);
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

  gameOver() {
    // Kill all animations and timers first
    this.tweens.killAll();
    this.time.removeAllEvents();

    // Stop background music
    this.audioManager.stopBgm('menuBgm');

    // Destroy all symbols on the main grid
    for (let row of this.slots) {
      for (let slot of row) {
        if (slot.symbol) {
          if (slot.symbol.valueText) slot.symbol.valueText.destroy();
          slot.symbol.destroy();
          slot.symbol = null;
        }
        slot.used = false;
        slot.setTexture('baseSlots', 0);
        slot.setAlpha(1);
        slot.setScale(1);
      }
    }

    // Destroy all symbols in the inventory
    for (let invSlot of this.inventorySlots) {
      if (invSlot.symbol) {
        if (invSlot.symbol.valueText) invSlot.symbol.valueText.destroy();
        invSlot.symbol.destroy();
        invSlot.symbol = null;
      }
      invSlot.slot.setTexture('baseSlots', 0);
      invSlot.slot.setAlpha(1);
      invSlot.slot.setScale(1);
    }

    // Reset core stats
    this.score = 0;
    this.goal = 50;
    this.coins = [5, 5];
    this.days = 1;

    // Hide all UI elements
    this.endDayButton.setVisible(false);
    this.endButton.setVisible(false);
    this.coinsText.setVisible(false);
    this.scoreText.setVisible(false);
    this.goalText.setVisible(false);
    this.daysText.setVisible(false);

    // Reset text values
    this.daysText.setText('Day: 1');
    this.coinsText.setText(`Coins: ${this.coins[0]}/${this.coins[1]}`);
    this.goalText.setText(`Goal: ${this.goal}`);
    this.scoreText.setText('0');

    // Show start button again
    this.startButton.setVisible(true);
  }



  createEndDayButton() {
    const { width } = this.scale;
    const endDayButton = this.add.text(width - 80, 20, 'END DAY', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#CD5C5C',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setVisible(false).setInteractive();
    this.endDayButton = endDayButton

    endDayButton.on('pointerdown', () => {
      if (this.score < this.goal) {
        this.gameOver()
      } else {
        this.days += 1
        this.daysText.setText(`Day ${this.days}`)
        this.coins[0] = this.coins[1]
        this.goal = Math.ceil(this.goal * 2.25);
        this.goalText.setText(`Goal: ${this.goal}`);
        this.coinsText.setText(`Coins: ${this.coins[0]}/${this.coins[1]}`)
        this.endDayButton.setVisible(false)
        this.audioManager.playSfx('completed', 0.5)
      }
    })

  }
  // Update the createEndTurnButton method to use this function
  createEndTurnButton() {
    const { width } = this.scale;

    const endButton = this.add.text(width - 80, 20, 'END TURN', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setVisible(false).setInteractive();
    this.endButton = endButton


    endButton.on('pointerdown', () => {
      if (this.coins[0] < 1) return




      if (!this.inventorySlots || !this.endTurnActive) return;

      for (let row of this.slots) {
        for (let slot of row) {
          if (slot.used && slot.symbol) {
            this.score += slot.symbol.symbolData.baseValue;
          }
        }
      }
      this.audioManager.playSfx('coin', 0.5)
      this.audioManager.playSfx('shuffle', 0.5)
      this.coins[0] -= 1

      if (this.coins[0] < 1) this.endDayButton.setVisible(true)
      this.scoreText.setText(this.score);
      this.coinsText.setText(`Coins: ${this.coins[0]}/${this.coins[1]}`);

      this.endTurnActive = false;
      this.applySymbolEffects();

      let tweensToWait = 0;


      // ---------------- MOVE RANDOM SYMBOLS ----------------
      const randomSymbols = [];
      for (let row of this.slots) {
        for (let slot of row) {
          if (slot.used && slot.symbol && slot.symbol.symbolData.movement[0] === 'random') {
            randomSymbols.push({ symbol: slot.symbol, originalSlot: slot });
          }
        }
      }

      const targetSlots = [];
      for (let row of this.slots) {
        for (let slot of row) {
          if (!slot.used || (slot.used && slot.symbol && slot.symbol.symbolData.movement[0] === 'random')) {
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
        originalSlot.setTexture('baseSlots', 0);

        availableTargets.splice(availableTargets.indexOf(targetSlot), 1);
      });

      moves.forEach(({ symbol, toSlot }) => {
        toSlot.used = true;
        toSlot.symbol = symbol;
      });

      // Animate random symbol movements
      moves.forEach(({ symbol, toSlot }) => {
        tweensToWait++;
        this.tweens.add({
          targets: [symbol],
          x: toSlot.x,
          y: toSlot.y,
          duration: 400,
          ease: 'Back.easeInOut',
          onComplete: () => {
            toSlot.setTexture('baseSlots', symbol.symbolData.movement[1]);
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
            slots[i].slot.setTexture('baseSlots', prevSymbol.symbolData.movement[1]);
            slots[i - 1].symbol = null;
            slots[i - 1].slot.setTexture('baseSlots', 0);
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
          firstSlot.slot.setTexture('baseSlots', newSymbol.symbolData.movement[1]);
          this.setupSymbolInteraction(newSymbol, symbolData, 0);
        }
      };

      const lastSlot = slots[slots.length - 1];

      if ((this.coins[0] === 0) && (this.score < this.goal)) {
        this.endTurnActive = true;
      } else {
        if (lastSlot.symbol && !lastSlot.symbol.placedOnGrid) {
          const fadingSymbol = lastSlot.symbol;
          tweensToWait++;
          this.tweens.add({
            targets: [fadingSymbol, lastSlot.slot],
            alpha: 0,
            scale: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
              if (fadingSymbol && !fadingSymbol.destroyed && fadingSymbol.destroy) {
                fadingSymbol.destroy();
              }
              lastSlot.symbol = null;
              lastSlot.slot.setTexture('baseSlots', 0);
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
      }



      const checkAllDone = () => {
        if (tweensToWait <= 0) {
          this.endTurnActive = true;
        }
      };

    });
  }


  applyCoconutEffect(symbol, slot) {
    const dirs = [
      { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
      { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
    ];

    for (let d of dirs) {
      const nx = slot.gridX + d.x;
      const ny = slot.gridY + d.y;
      if (ny < 0 || ny >= this.slots.length) continue;
      if (nx < 0 || nx >= this.slots[0].length) continue;

      const neighbor = this.slots[ny][nx];
      if (neighbor.used && neighbor.symbol) {
        const nSym = neighbor.symbol;
        const nData = nSym.symbolData;
        if (nData.key !== 'coconut') {
          if (!Array.isArray(nSym.isProtected)) nSym.isProtected = [];
          nSym.isProtected.push([0, symbol, () => this.coconutSum(symbol)]);
        }
      }
    }
  }

  coconutSum(symbol) {
    symbol.symbolData.baseValue += 1;
    if (symbol.valueText) {
      symbol.valueText.setText(this.formatValue(symbol.symbolData.baseValue.toString()));
    }
  }

  checkDestructionType(symbol, data) {
    if (data.destructionType === "sameKey") {
      const result = [];
      for (let row of this.slots) {
        for (let slot of row) {
          if (slot.used && slot.symbol && slot.symbol.isProtected.length === 0) {
            const sData = slot.symbol.symbolData;
            if (sData.key === data.key) result.push(slot.symbol);
          }
        }
      }
      return result;
    }
    return [symbol];
  }


  // --- SYMBOL EFFECTS ---
  applySymbolEffects() {

    // reset protection flags
    for (let row of this.slots)
      for (let slot of row)
        if (slot.used && slot.symbol)
          slot.symbol.isProtected = [];

    for (let row of this.slots)
      for (let slot of row)
        if (slot.used && slot.symbol?.symbolData.key === 'coconut')
          this.applyCoconutEffect(slot.symbol, slot);

    for (let row of this.slots) {
      for (let slot of row) {
        if (!slot.used || !slot.symbol) continue;

        const symbol = slot.symbol;
        const data = symbol.symbolData;

        // █ CHERRY █ //
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
            
            if (symbol.valueText) symbol.valueText.setText(this.formatValue(data.baseValue.toString()));
          }
        }

        // █ BANANA █ //
        if (data.key === 'banana') {
          data.baseValue += 1;
          if (symbol.valueText) symbol.valueText.setText(this.formatValue(data.baseValue.toString()));
          if (Math.random() < 0.10) {
            if (Array.isArray(symbol.isProtected) && symbol.isProtected.length > 0) {
              for (const [_, protector, fn] of symbol.isProtected) {
                if (typeof fn === 'function') fn();
              }
            } else {
              // Directions around banana (8-way)
              const dirs = [
                { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
                { x: -1, y: 0 }, { x: 1, y: 0 },
                { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
              ];

              const nearby = [];

              for (let d of dirs) {
                const nx = slot.gridX + d.x;
                const ny = slot.gridY + d.y;
                if (ny < 0 || ny >= this.slots.length) continue;
                if (nx < 0 || nx >= this.slots[0].length) continue;

                const neighbor = this.slots[ny][nx];
                if (neighbor.used && neighbor.symbol) {
                  const nData = neighbor.symbol.symbolData;
                  if (nData.type === 'fruit') nearby.push(neighbor.symbol);
                }
              }

              // Double one random nearby fruit
              if (nearby.length > 0) {
                const target = Phaser.Utils.Array.GetRandom(nearby);
                const tData = target.symbolData;
                tData.baseValue = Math.floor(tData.baseValue * 2);
                if (target.valueText) target.valueText.setText(this.formatValue(tData.baseValue.toString()))
            
                // visual pulse
                this.tweens.add({
                  targets: [target],
                  scale: 1.3,
                  duration: 100,
                  yoyo: true
                });
              }

              // Destroy banana
              slot.used = false;
              slot.symbol = null;
              slot.setTexture('baseSlots', 0);

              this.tweens.add({
                targets: [symbol, symbol.valueText],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                  if (symbol.valueText) symbol.valueText.destroy();
                  symbol.destroy();
                }
              });
            }
          }
        }



        // █ STRAWBERRY █ //
        if (data.key === 'strawberry') {
          const dirs = [
            { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
            { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
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
            data.baseValue += 5;
            symbol.valueText.setText(this.formatValue(data.baseValue.toString()));
          }
        }

        // █ ORANGE █ //
        if (data.key === 'orange') {
          const dirs = [
            { x: -1, y: -1 }, { x: 1, y: -1 },
            { x: -1, y: 1 }, { x: 1, y: 1 },
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
              gain += 10;
              neighborsToDecrease.push(nSymbol);
            }
          }

          // Reduce neighbors after calculating gain
          neighborsToDecrease.forEach(nSymbol => {
            const nData = nSymbol.symbolData;
            nData.baseValue = Math.max(1, nData.baseValue - 1);
            if (nSymbol.valueText) nSymbol.valueText.setText(this.formatValue(nData.baseValue.toString()));
          });

          if (gain > 0) {
            data.baseValue += gain;
            if (symbol.valueText) symbol.valueText.setText(this.formatValue(data.baseValue.toString()));
          }
        }


        // █ LEMON █ //
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
            { x: -1, y: 1 }, { x: 1, y: 1 },
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
                if (nData.key === 'lemon') gain += 5;
              }
            }

            if (gain > 0) {
              data.baseValue += gain;
              if (symbol.valueText) symbol.valueText.setText(this.formatValue(data.baseValue.toString()));
            }
          }
        }


        // █ WATERMELON █ //
        if (data.key === 'watermelon') {
          const nx = slot.gridX;
          const ny = slot.gridY + 1;

          // +1 every turn
          data.baseValue += 1;
          if (symbol.valueText) symbol.valueText.setText(this.formatValue(data.baseValue.toString()));

          if (ny >= 0 && ny < this.slots.length && nx >= 0 && nx < this.slots[0].length) {
            const below = this.slots[ny][nx];
            if (below.used && below.symbol) {
              const bSym = below.symbol;
              const bData = bSym.symbolData;

              // protected?
              if (Array.isArray(bSym.isProtected) && bSym.isProtected.length > 0) {
                for (const [_, protector, fn] of bSym.isProtected) {
                  if (typeof fn === 'function') fn();
                }
                return; // skip further destruction
              }

              if (bData.key === 'watermelon') {
                // destroy both watermelons
                const currentSlot = this.findSlotForSymbol(symbol);
                if (currentSlot) {
                  currentSlot.used = false;
                  currentSlot.symbol = null;
                  currentSlot.setTexture('baseSlots', 0);
                }

                below.used = false;
                below.symbol = null;
                below.setTexture('baseSlots', 0);

                this.tweens.add({
                  targets: [symbol, symbol.valueText],
                  alpha: 0,
                  duration: 200,
                  onComplete: () => {
                    if (symbol.valueText) symbol.valueText.destroy();
                    symbol.destroy();
                  }
                });

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
              else if (bData.type === 'fruit') {
                // absorb the fruit's value before destruction
                data.baseValue += bData.baseValue;
                if (symbol.valueText) symbol.valueText.setText(this.formatValue(data.baseValue.toString()));

                const symbolsToDestroy = this.checkDestructionType(bSym, bData);
                for (const s of symbolsToDestroy) {
                  const sSlot = this.findSlotForSymbol(s);
                  if (!sSlot) continue;

                  sSlot.used = false;
                  sSlot.symbol = null;
                  sSlot.setTexture('baseSlots', 0);

                  this.tweens.add({
                    targets: [s, s.valueText],
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                      if (s.valueText) s.valueText.destroy();
                      s.destroy();
                    }
                  });
                }
              }
            }
          }
        }

        // █ GRAPE █ //
        if (data.key === 'grape') {
          // Count all other grapes on the grid
          let grapeCount = 0;
          for (let r of this.slots) {
            for (let s of r) {
              if (s.used && s.symbol && s.symbol.symbolData.key === 'grape' && s.symbol !== symbol) {
                grapeCount++;
              }
            }
          }
          // Add the value bonus
          if (grapeCount > 0) {
            data.baseValue += grapeCount;
            if (symbol.valueText) symbol.valueText.setText(this.formatValue(data.baseValue.toString()));
          }
        }

        // █ PEACH █ //

        if (data.key === 'peach') {
          const nx = slot.gridX;
          const ny = slot.gridY;
          const maxX = this.slots[0].length - 1;
          const maxY = this.slots.length - 1;

          // Trigger for any edge
          if (nx === 0 || nx === maxX || ny === 0 || ny === maxY) {
            let gain = 0;
            for (let row of this.slots) {
              for (let s of row) {
                if (s.used && s.symbol && s.symbol.symbolData.type === 'fruit') {
                  gain += 1;
                }
              }
            }

            data.baseValue += gain;
            if (symbol.valueText) symbol.valueText.setText(this.formatValue(data.baseValue.toString()));
          }
        }


        // █ KIWI █ //
        if (data.key === 'kiwi') {
          // get all fruits in grid
          const allFruits = [];
          for (let r of this.slots) {
            for (let s of r) {
              if (s.used && s.symbol && s.symbol.symbolData.type === 'fruit' && s.symbol !== symbol) {
                allFruits.push(s.symbol);
              }
            }
          }

          if (allFruits.length > 0) {
            const randomFruit = Phaser.Utils.Array.GetRandom(allFruits);
            const fData = randomFruit.symbolData;
            data.baseValue += fData.baseValue;
          } else {
            data.baseValue += 1;
          }

          // 25% chance to reset value
          let reset = false
          if (Math.random() < 0.25 && data.baseValue > 1) {
            data.baseValue = 1;
            reset = true
          }

          if (symbol.valueText) symbol.valueText.setText(this.formatValue(data.baseValue.toString()));

          // visual flicker for reset
          if (reset) {
            this.audioManager.playSfx('reset', 0.35)
            this.tweens.add({
              targets: [symbol],
              alpha: 0.4,
              duration: 80,
              yoyo: true,
              repeat: 2
            });
          }
        }

        // █ PINEAPPLE █ //
        if (data.key === 'pineapple') {
          // gather all other symbols
          const others = [];
          for (let r of this.slots) {
            for (let s of r) {
              if (s.used && s.symbol && s.symbol !== symbol) {
                others.push(s.symbol);
              }
            }
          }

          if (others.length > 0) {
            // pick random symbol
            const target = Phaser.Utils.Array.GetRandom(others);
            const tData = target.symbolData;

            // swap values
            const temp = data.baseValue;
            data.baseValue = tData.baseValue;
            tData.baseValue = temp;

            // update text
            if (symbol.valueText) symbol.valueText.setText(this.formatValue(data.baseValue.toString()));
            if (target.valueText) target.valueText.setText(this.formatValue(tData.baseValue.toString()));

            // visual swap pulse
            this.tweens.add({
              targets: [symbol, target],
              scale: 1.2,
              duration: 100,
              yoyo: true
            });
          } else {
            // no symbols to swap
            data.baseValue += 1;
            if (symbol.valueText) symbol.valueText.setText(this.formatValue(data.baseValue.toString()));
          }
        }


// █ APPLE █ //
if (data.key === 'apple') {
    let maxValue = 0;

    for (let r of this.slots) {
        for (let s of r) {
            if (s.used && s.symbol && s.symbol.symbolData.type === 'fruit' && s.symbol !== symbol) {
                maxValue = Math.max(maxValue, s.symbol.symbolData.baseValue);
            }
        }
    }

    data.baseValue = maxValue;

    if (symbol.valueText) {
        symbol.valueText.setText(this.formatValue(data.baseValue.toString()));
    }

    // Optional visual pulse
    this.tweens.add({
        targets: [symbol],
        scale: 1.2,
        duration: 100,
        yoyo: true
    });
}







      }
    }
  }





}






