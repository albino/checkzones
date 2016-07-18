var errors = {
  "mediainfo" : "Couldn't parse mediainfo. Check that it is a valid video mediainfo which contains zones.",
  "frames" : "Please check that the frame count you entered is correct, and the mediainfo is valid.",
  "check" : "Could not parse the list of frames to check. Please check it.",
  "unknown" : "An unknown error occured.",
};

function getBaseRate(settings) {
  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i];
    if (/^crf=/.test(setting)) {
      return ["crf", setting.replace(/^crf=/, "")];
    } else if (/^bitrate=/.test(setting)) {
      return ["bitrate", setting.replace(/^bitrate=/, "")];
    }
  }
};

function parseZones(zones, base, numframes) {
  numframes = parseInt(numframes);
  var frames = new Array(numframes);
  for (var i = 0; i < zones.length; i++) {
    var zone = zones[i].split(",");
    if (parseInt(zone[1]) > numframes) {
      return null;
    }

    if (/^crf=/.test(zone[2])) {
      var crf = zone[2].replace(/^crf=/, "");
      frames.fill(["crf", crf], parseInt(zone[0]), parseInt(zone[1])+1);
    } else if (/^b=/.test(zone[2])) {
      var b = zone[2].replace(/^b=/, "");
      frames.fill(["b", b], parseInt(zone[0]), parseInt(zone[1])+1);
    }
  }

  // fill in all the unfilled frames
  for (var i = 0; i < frames.length; i++) {
    if (!frames[i]) {
      frames[i] = base;
    }
  }
  
  return frames;
};

function checkZones(mediainfo, numframes, check) {
  // Extract encode settings
  var lines = mediainfo.split('\n');
  var settings;
  for (var i = 0; i < lines.length; i++) {
    if (/^Encoding\ settings\ :\ /.test(lines[i])) {
      // This is the line we want
      settings = lines[i].replace(/^Encoding\ settings\ :\ /, "").split(" / ");
    }
  }
  if (!settings) {
    return errors["mediainfo"];
  }

  // Find base CRF or bitrate
  var base = getBaseRate(settings);
  if (!base) {
    return errors["mediainfo"];
  }

  var frames;
  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i];
    if (/^zones=/.test(setting)) {
      frames = parseZones(setting.replace(/^zones=/, "").split("/"), base, numframes);
    }
  }
  if (!frames) {
    return errors["frames"];
  }

  // Check input
  var to_check = check.split(",");
  for (var i = 0; i < to_check.length; i++) {
    if (/^[0-9]+$/.test(to_check[i])) {
      to_check[i] = parseInt(to_check[i]);
    } else {
      return errors["check"];
    }
  }

  // Check each frame
  var results = {
    frames : {},
    zones : {},
  };
  for (var i = 0; i < to_check.length; i++) {
    var frame = to_check[i];
    results["frames"][frame] = frames[frame][0] + "=" + frames[frame][1];
  }

  // Calculate percentages
  var frequencies = new Object;
  for (var i = 0; i < frames.length; i++) {
    var frame = frames[i];
    if (frame[0] != base[0] || frame[1] != base[1]) {
      // does the frequencies object already have an entry for this rate?
      if (frequencies[frame[0] + "=" + frame[1]]) {
        // yes
        frequencies[frame[0] + "=" + frame[1]]++;
      } else {
        // no
        frequencies[frame[0] + "=" + frame[1]] = 1;
      }
    } 
  }

  for (var rate in frequencies) {
    if (!frequencies.hasOwnProperty(rate)) continue;
    results["zones"][rate] = parseInt(frequencies[rate]) / parseInt(numframes) * 100;
  }

  // sorting
  var rates = new Array;
  for (var rate in results["zones"]) {
    if (!results["zones"].hasOwnProperty(rate)) continue;
    rates.push(rate);
  }
  rates.sort(
    function(a, b) {
      c = [a, b].map(
        function(x) {
          return parseFloat(x.replace(/^(crf|b)=/, ""));
        }
      );
      return c[0] - c[1];
    }
  );

  // Build report
  var output = "Base " + base[0] + ": " + base[1] + "\n\n";

  for (var frame in results["frames"]) {
    if (!results["frames"].hasOwnProperty(frame)) continue;
    output += "Frame " + frame + ": " + results["frames"][frame] + "\n";
  }
  output += "\n";

  for (var zone in results["zones"]) {
    if (!results["zones"].hasOwnProperty(zone)) continue;
    output += zone + ": " + parseFloat(results["zones"][zone]).toFixed(3) + "% (" + frequencies[zone] + " frames)\n";
  }

  return output;
};

function update() {
  var mediainfo = document.getElementById("mediainfo").value;
  var frames = document.getElementById("frames").value;
  var check = document.getElementById("check").value;

  if (mediainfo && frames && check) {
    document.getElementById("results").value = checkZones(mediainfo, frames, check);
  } else {
    document.getElementById("results").value = "";
  }
};
