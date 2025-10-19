


export function loadGameSprites(scene){
  // single
  scene.load.image('emptySlot', 'assets/sprites/emptySlot.png');
  scene.load.image('usedSlot', 'assets/sprites/usedSlot.png');
  scene.load.image('movableSlot', 'assets/sprites/movableSlot.png');
  scene.load.image('gridBack', 'assets/sprites/GridBack.png');
  scene.load.image('inventoryBack', 'assets/sprites/inventoryBack.png');
  scene.load.image('background', 'assets/sprites/Background.png');

  // sheets
  scene.load.spritesheet('fruits', 'assets/sprites/fruits.png', {frameWidth: 36,frameHeight: 36 });

 
}

