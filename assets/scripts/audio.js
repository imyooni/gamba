// audioManager.js
export class AudioManager {
  constructor(scene) {
    this.scene = scene;
    this.bgm = {};
    this.sfxVolume = 1;
  }

  // Load audio
  loadAudio() {
    this.scene.load.audio('menuBgm', 'assets/audio/BGM/MenuBgm.ogg'); 

    this.scene.load.audio('coin', 'assets/audio/SFX/systemMoney.ogg');
    this.scene.load.audio('shuffle', 'assets/audio/SFX/tickets.ogg');
    this.scene.load.audio('selected', 'assets/audio/SFX/systemSelected.ogg');
    this.scene.load.audio('grab', 'assets/audio/SFX/systemGrab.ogg');
    this.scene.load.audio('completed', 'assets/audio/SFX/systemCompleted.ogg');
  }

  // Play BGM (auto-init if not yet created)
  playBgm(key, volume = 0.5) {
  if (!this.bgm[key]) {
    this.bgm[key] = this.scene.sound.add(key, { loop: true, volume });
  } else {
    this.bgm[key].setVolume(volume); // update volume if already exists
  }

  if (!this.bgm[key].isPlaying) {
    this.bgm[key].play();
  }
}


  pauseBgm(key) {
    if (this.bgm[key] && this.bgm[key].isPlaying) this.bgm[key].pause();
  }

  stopBgm(key) {
    if (this.bgm[key]) this.bgm[key].stop();
  }

  toggleBgm(key) {
    if (!this.bgm[key]) return;
    this.bgm[key].isPlaying ? this.bgm[key].pause() : this.bgm[key].play();
  }

  setBgmVolume(key, volume) {
    if (this.bgm[key]) this.bgm[key].setVolume(Phaser.Math.Clamp(volume, 0, 1));
  }

  setAllBgmVolume(volume) {
    const vol = Phaser.Math.Clamp(volume, 0, 1);
    for (const key in this.bgm) this.bgm[key].setVolume(vol);
  }

  setSfxVolume(volume) {
    this.sfxVolume = Phaser.Math.Clamp(volume, 0, 1);
  }

// audio.js
playSfx(key, volume = null, config = {}) {
  this.scene.sound.play(key, { 
    volume: volume !== null ? Phaser.Math.Clamp(volume, 0, 1) : this.sfxVolume,
    ...config
  });
}

}
