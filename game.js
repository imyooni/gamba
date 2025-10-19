

import Game_Scene from './scenes/Game_Scene.js';

document.addEventListener('contextmenu', (event) => {
   event.preventDefault();
});


document.fonts.load('16px DefaultFont').then(() => {
  const config = {
    type: Phaser.AUTO,
    width: 384,
    height: 736,
    parent: 'game-container',
    pixelArt: true,
    backgroundColor: 'transparent',
    transparent: true,
    scene: [Game_Scene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };
  
  const game = new Phaser.Game(config);
  
});


