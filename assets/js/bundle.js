import './main.js';
import './nfp-handler.js';
import './qr-scan-handler.js';

if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
  console.log('%cNOTE: during development, use --live-reloading on the web server',
    'color: red; font-size: 48px;');
  console.log('%cthis imports the js files directly rather than the bundle',
    'color: lightskyblue; font-size: 24px;');
} else {
  // funny pranke
  console.log('%cDO NOT PASTE ANYTHING HERE!!!!!!!!!!',
    'color: red; font-size: 90px;');
  console.log('%cHowever, if you know JavaScript, you should go here: ' +
    // links to an image of steve jobs
    location.protocol + '//' + location.host + '/jobs',
  'color: lightskyblue; font-size: 40px;');
}
