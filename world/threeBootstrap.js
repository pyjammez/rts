if (window.OpenRTSThree) {
  window.THREE = window.OpenRTSThree.THREE;
  window.GLTFLoader = window.OpenRTSThree.GLTFLoader;
  window.threeReady = Promise.resolve(window.THREE);
  window.dispatchEvent(new CustomEvent('open-rts-three-ready'));
} else {
  window.threeReady = Promise.resolve(null);
  console.error('The local Three.js runtime did not load.');
}
