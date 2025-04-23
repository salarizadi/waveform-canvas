# jQuery Waveform Player 🎵

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/salarizadi/waveform-canvas)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/salarizadi/waveform/blob/main/LICENSE)
[![jsDelivr](https://data.jsdelivr.com/v1/package/gh/salarizadi/waveform-canvas/badge)](https://www.jsdelivr.com/package/gh/salarizadi/waveform-canvas)
[![jQuery](https://img.shields.io/badge/jquery-%3E%3D%201.7-yellow.svg)](https://jquery.com/)
[![CodePen demo](https://img.shields.io/badge/CodePen-demo-blue.svg)](https://codepen.io/salariz/pen/gbbwPZZ)

A sleek and interactive audio visualization jQuery plugin that creates a customizable waveform player using HTML5 Canvas for high-performance rendering. Features include touch support, real-time updates, RTL support, and responsive design with optimized canvas rendering for smooth animations.

## Features ✨

- 🎨 High-performance canvas rendering
- 📱 Touch support for mobile devices
- 🔄 Real-time waveform updates
- 🌐 RTL (Right-to-Left) support
- 📐 Responsive design
- 🎯 Customizable appearance
- 🔋 Web Worker processing for smooth performance
- 💾 Export/Import waveform data
- 🖼️ Optimized canvas rendering
- 🎚️ Adjustable sampling quality

## Installation 📦

### Manual Installation
Include jQuery and the waveform plugin in your HTML:

```html
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="waveform-canvas.min.js"></script>
```

## Usage 🚀

### Basic Setup

```html
<div id="waveform-container"></div>
<audio id="audio" src="path/to/audio.mp3"></audio>

<script>
$(document).ready(function() {
    $("#waveform-container").waveform({
        audioElement: "#audio",
        audioContext: new (window.AudioContext || window.webkitAudioContext)(),
        activeColor: "#2196F3",
        inactiveColor: "#ccc"
    });
});
</script>
```

### Advanced Configuration

```javascript
$("#waveform-container").waveform({
    audioElement: "#audio",
    audioContext: new AudioContext(),
    segments: 200,                    // Number of segments
    segmentGap: 2,                   // Gap between segments
    activeColor: "#2196F3",          // Color of played segments
    inactiveColor: "#ccc",           // Color of unplayed segments
    backgroundColor: "#f5f5f5",      // Container background color
    rtl: false,                      // Right-to-left mode
    samplingQuality: "medium",       // low, medium, high
    segmentBorderRadius: 2,          // Segment border radius
    minSegmentHeight: 15,            // Minimum segment height (%)
    useQueue: true,                  // Enable processing queue
    
    // Callbacks
    onRendered: function(instance) {
        console.log("Waveform rendered!");
    },
    onProgressChange: function(progress) {
        console.log("Progress:", progress);
    },
    onSeek: function(position) {
        console.log("Seeked to:", position);
    }
});
```

## Export/Import Data 💾

You can export the waveform data for later use:

```javascript
// Export waveform data
const waveformInstance = $("#waveform-container").data("waveform");
const exportedData = waveformInstance.export();

// Save to localStorage or send to server
localStorage.setItem("waveformData", JSON.stringify(exportedData));

// Later, restore the waveform
const savedData = JSON.parse(localStorage.getItem("waveformData"));
waveformInstance.restore(savedData);
```

## API Reference 📚

### Methods

| Method | Description |
|--------|-------------|
| `export()` | Exports waveform data |
| `restore(data)` | Restores waveform from exported data |
| `destroy()` | Removes the waveform instance |
| `enableInteraction()` | Enables user interaction |
| `disableInteraction()` | Disables user interaction |

### Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `audioElement` | String | "#audio-element" | Audio element selector |
| `segments` | Number | auto | Number of waveform segments |
| `segmentGap` | Number | 2 | Gap between segments |
| `activeColor` | String | "#2196F3" | Color of played segments |
| `inactiveColor` | String | "#ccc" | Color of unplayed segments |
| `backgroundColor` | String | null | Container background color |
| `rtl` | Boolean | false | Right-to-left mode |
| `samplingQuality` | String | "medium" | Sampling quality (low/medium/high) |
| `loadingText` | String | "Loading waveform..." | Loading indicator text |
| `useQueue` | Boolean | false | Enable processing queue |
| `segmentBorderRadius` | Number | 2 | Segment border radius |
| `minSegmentHeight` | Number | 15 | Minimum segment height percentage |

## Browser Support 🌐

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Opera (latest)
- Mobile browsers (iOS Safari, Android Chrome)

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author ✍️

- **Salar Izadi** - [GitHub Profile](https://github.com/salarizadi)
- Website: [salarizadi.ir](https://salarizadi.ir)

## Support ⭐️

If you find this project helpful, please give it a ⭐️!

---
Made with ❤️ by [Salar Izadi](https://github.com/salarizadi)
