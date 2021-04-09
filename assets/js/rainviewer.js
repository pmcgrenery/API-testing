//Original Code from https://www.rainviewer.com/api/weather-maps-api.html

// var lat = 53.35;
// var long = -6.26;

// function fecthRainviewerData(event) {
// $.when(
//   $.getJSON(`https://api.rainviewer.com/public/weather-maps.json`)
// ).then(
//   function (response) {
//     var userData = response;
//     console.log(userData.radar.nowcast[0]);
//     $("#rv-data").html(`${userData}`);
//   },
//   function (errorResponse) {
//     if (errorResponse.status === 404) {
//       $("#rv-data").html(
//         `<h2>No info found</h2>`);
//     } else {
//       console.log(errorResponse);
//       $("#gh-user-data").html(
//         `<h2>Error: ${errorResponse.responseJSON.message}</h2>`);
//     }
//   });
// }

// Leaflet Map
var map = L.map('mapid').setView([48.8566, 2.3522], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attributions: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
}).addTo(map);

/**
 * RainViewer radar animation part
 * @type {number[]}
 */
var apiData = {};
var mapFrames = [];
var lastPastFramePosition = -1;
var radarLayers = [];

var optionKind = 'radar'; // can be 'radar' or 'satellite'

var optionTileSize = 256; // can be 256 or 512.
var optionColorScheme = 7; // from 0 to 8. Check the https://rainviewer.com/api/color-schemes.html for additional information
var optionSmoothData = 1; // 0 - not smooth, 1 - smooth
var optionSnowColors = 1; // 0 - do not show snow colors, 1 - show snow colors

var animationPosition = 0;
var animationTimer = false;

/**
 * Load all the available maps frames from RainViewer API
 */
var apiRequest = new XMLHttpRequest();
apiRequest.open("GET", "https://api.rainviewer.com/public/weather-maps.json", true);
apiRequest.onload = function (e) {
  // store the API response for re-use purposes in memory
  apiData = JSON.parse(apiRequest.response);
  initialize(apiData, optionKind);
};
apiRequest.send();

/**
 * Initialize internal data from the API response and options
 */
function initialize(api, kind) {
  // remove all already added tiled layers
  for (var i in radarLayers) {
    map.removeLayer(radarLayers[i]);
  }
  mapFrames = [];
  radarLayers = [];
  animationPosition = 0;

  if (!api) {
    return;
  }
  if (kind == 'satellite' && api.satellite && api.satellite.infrared) {
    mapFrames = api.satellite.infrared;

    lastPastFramePosition = api.satellite.infrared.length - 1;
    showFrame(lastPastFramePosition);
  } else if (api.radar && api.radar.past) {
    mapFrames = api.radar.past;
    if (api.radar.nowcast) {
      mapFrames = mapFrames.concat(api.radar.nowcast);
    }

    // show the last "past" frame
    lastPastFramePosition = api.radar.past.length - 1;
    showFrame(lastPastFramePosition);
  }
}

/**
 * Animation functions
 * @param path - Path to the XYZ tile
 */
function addLayer(frame) {
  if (!radarLayers[frame.path]) {
    var colorScheme = optionKind == 'satellite' ? 0 : optionColorScheme;
    var smooth = optionKind == 'satellite' ? 0 : optionSmoothData;
    var snow = optionKind == 'satellite' ? 0 : optionSnowColors;

    radarLayers[frame.path] = new L.TileLayer(apiData.host + frame.path + '/' + optionTileSize + '/{z}/{x}/{y}/' + colorScheme + '/' + smooth + '_' + snow + '.png', {
      tileSize: 256,
      opacity: 0.001,
      zIndex: frame.time
    });
  }
  if (!map.hasLayer(radarLayers[frame.path])) {
    map.addLayer(radarLayers[frame.path]);
  }
}

/**
 * Display particular frame of animation for the @position
 * If preloadOnly parameter is set to true, the frame layer only adds for the tiles preloading purpose
 * @param position
 * @param preloadOnly
 */
function changeRadarPosition(position, preloadOnly) {
  while (position >= mapFrames.length) {
    position -= mapFrames.length;
  }
  while (position < 0) {
    position += mapFrames.length;
  }

  var currentFrame = mapFrames[animationPosition];
  var nextFrame = mapFrames[position];

  addLayer(nextFrame);

  if (preloadOnly) {
    return;
  }

  animationPosition = position;

  if (radarLayers[currentFrame.path]) {
    radarLayers[currentFrame.path].setOpacity(0);
  }
  radarLayers[nextFrame.path].setOpacity(100);

  setFrameTime(nextFrame);
  // var pastOrForecast = nextFrame.time > Date.now() / 1000 ? '(Forecast)' : '';

  // Own Code to handle the frame times and present UTC time
  // frameTime = new Date(nextFrame.time * 1000); // Create a time object
  // utcString = frameTime.toUTCString(); // Returns 'Fri, 09 Apr 2021 14:40:00 GMT'
  // time = utcString.slice(17, 22); // Slice out just the HH:MM from the utcString
  // document.getElementById("timestamp").innerHTML = `${time} UTC ${pastOrForecast}`;

}

function setFrameTime(frame) {
  var pastOrForecast = frame.time > Date.now() / 1000 ? '(Forecast)' : '';

  frameTime = new Date(frame.time * 1000); // Create a time object
  utcString = frameTime.toUTCString(); // Returns 'Fri, 09 Apr 2021 14:40:00 GMT'
  time = utcString.slice(17, 22); // Slice out just the HH:MM from the utcString
  document.getElementById("timestamp").innerHTML = `${time} UTC ${pastOrForecast}`;


}
/**
 * Check avialability and show particular frame position from the timestamps list
 */
function showFrame(nextPosition) {
  var preloadingDirection = nextPosition - animationPosition > 0 ? 1 : -1;

  changeRadarPosition(nextPosition);

  // preload next next frame (typically, +1 frame)
  // if don't do that, the animation will be blinking at the first loop
  changeRadarPosition(nextPosition + preloadingDirection, true);
}

/**
 * Stop the animation
 * Check if the animation timeout is set and clear it.
 */
function stop() {
  if (animationTimer) {
    clearTimeout(animationTimer);
    animationTimer = false;
    return true;
  }
  return false;
}

function play() {
  showFrame(animationPosition + 1);

  // Main animation driver. Run this function every 500 ms
  animationTimer = setTimeout(play, 500);
}

function playStop() {
  if (!stop()) {
    play();
  }
}

/**
 * Change map options
 */
function setKind(kind) {
  optionKind = kind;
  initialize(apiData, optionKind);
}

/**
 * Handle arrow keys for navigation between next \ prev frames
 */
document.onkeydown = function (e) {
  e = e || window.event;
  switch (e.which || e.keyCode) {
    case 37: // left
      stop();
      showFrame(animationPosition - 1);
      break;

    case 39: // right
      stop();
      showFrame(animationPosition + 1);
      break;

    default:
      return; // exit this handler for other keys
  }
  e.preventDefault();
  return false;
}