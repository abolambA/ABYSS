import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import IntroScene from './scenes/IntroScene.js';
import StoryScene from './scenes/StoryScene.js';
import LevelTransition from './scenes/LevelTransition.js';
import PauseScene from './scenes/PauseScene.js';
import GameScene from './scenes/GameScene.js';
import OutroScene from './scenes/OutroScene.js';
import GamepadManager from './systems/GamepadManager.js';

// Single global gamepad instance — survives scene restarts
window._gp = new GamepadManager();

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#000810',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: [MenuScene, IntroScene, StoryScene, LevelTransition, PauseScene, GameScene, OutroScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  render: {
    antialias: false,
    pixelArt: false,
    roundPixels: true,
  },
};

new Phaser.Game(config);