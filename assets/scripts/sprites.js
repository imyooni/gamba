


export function loadGameSprites(scene){
  // single
  scene.load.image('gridBack', 'assets/sprites/GridBack.png');
  scene.load.image('inventoryBack', 'assets/sprites/inventoryBack.png');
  scene.load.image('Background', 'assets/sprites/background.png');

  // sheets
  scene.load.spritesheet('fruits', 'assets/sprites/fruits.png', {frameWidth: 36,frameHeight: 36 });
  scene.load.spritesheet('baseSlots', 'assets/sprites/baseSlots.png', {frameWidth: 36,frameHeight: 36 });

 
}
