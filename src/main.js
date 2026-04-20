import { Engine } from './Engine.js';
import { Environment } from './Environment.js';
import { Slingshot } from './Slingshot.js';
import { InputController } from './InputController.js';

const engine = new Engine();
const environment = new Environment(engine);
const slingshot = new Slingshot(engine);
const inputController = new InputController(engine, slingshot);

// Main animation loop
function animate() {
  requestAnimationFrame(animate);
  engine.update();
}

animate();
