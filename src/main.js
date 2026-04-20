import { Engine } from './Engine.js';
import { Environment } from './Environment.js';
import { Slingshot } from './Slingshot.js';
import { InputController } from './InputController.js';
import { PlayerController } from './PlayerController.js';

const engine = new Engine();
const environment = new Environment(engine);
const playerController = new PlayerController(engine);
const slingshot = new Slingshot(engine, playerController);
const inputController = new InputController(engine, slingshot, playerController);

document.getElementById('restart-btn').addEventListener('click', () => {
    // A simple page reload is the cleanest way to restart a physics engine state
    window.location.reload();
});

// Main animation loop
function animate() {
  requestAnimationFrame(animate);

  // Update engine physics and get delta time
  const dt = engine.update();

  // Use exact delta for controllers
  playerController.update(dt);
  if(inputController.update) inputController.update(dt);
}

animate();
