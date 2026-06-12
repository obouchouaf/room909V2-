import './ui/styles.css';
import { App } from './App.js';

const canvas = document.getElementById('gl');
const ui = document.getElementById('ui');

const app = new App({ canvas, ui });
app.start();

// expose for debugging / dropping in real footage from the console:
//   app.grid.setMap(new THREE.VideoTexture(videoEl))
window.__room909 = app;
