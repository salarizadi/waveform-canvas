/**
 *  Copyright (c) 2025
 *  @Version : 1.0.0
 *  @Author  : https://salarizadi.ir
 *  @Repository : https://github.com/salarizadi/waveform-canvas
 *  @Description: A sleek and interactive audio visualization plugin that creates a customizable waveform player
 *  using HTML5 Canvas for high-performance rendering. Features include touch support, real-time updates, RTL support,
 *  and responsive design with optimized canvas rendering for smooth animations.
 */

(function ($) {
    "use strict";

    const VERSION = "1.0.0";

    const workerFunction = function () {
        self.onmessage = async function (e) {
            const {channelData, segments, samplingQuality} = e.data;

            const waveformData = [];
            const samplesPerSegment = Math.floor(channelData.length / segments);
            const sampleStep = getSamplingRate(channelData.length, samplingQuality, segments);

            // Process data in chunks for better performance
            const chunkSize = 1000;
            for (let i = 0; i < segments; i += chunkSize) {
                const end = Math.min(i + chunkSize, segments);
                const chunkData = [];

                for (let j = i; j < end; j++) {
                    const startSample = j * samplesPerSegment;
                    const endSample = Math.min(startSample + samplesPerSegment, channelData.length);

                    let sum = 0;
                    let sampleCount = 0;

                    for (let k = startSample; k < endSample; k += sampleStep) {
                        sum += Math.abs(channelData[k]);
                        sampleCount++;
                    }

                    const average = sum / sampleCount;
                    chunkData.push(average);
                }

                self.postMessage({type: 'progress', progress: Math.round((end / segments) * 100)});
                waveformData.push(...chunkData);
            }

            // Normalize waveform data
            const maxPeak = Math.max(...waveformData, 0.01); // Minimum value to prevent division by zero
            const normalizedData = waveformData.map(peak => {
                const normalized = (peak / maxPeak) * 100; // Normalize to percentage
                return Math.max(normalized, 15); // Minimum 15%
            });

            self.postMessage({type: 'complete', data: normalizedData});
        };

        function getSamplingRate (totalSamples, quality, segments) {
            const samplesPerSegment = Math.floor(totalSamples / segments);

            switch (quality) {
                case "low":
                    return Math.max(1, Math.floor(samplesPerSegment / 5));
                case "medium":
                    return Math.max(1, Math.floor(samplesPerSegment / 10));
                case "high":
                    return Math.max(1, Math.floor(samplesPerSegment / 20));
                default:
                    return Math.max(1, Math.floor(samplesPerSegment / 10));
            }
        }
    };

    const createInlineWorker = func => {
        const functionString = func.toString();

        const blob = new Blob([`(${functionString})()`], {
            type: 'application/javascript'
        });

        const workerURL = URL.createObjectURL(blob);
        const worker = new Worker(workerURL);

        URL.revokeObjectURL(workerURL);

        return worker;
    };

    const WaveformPlayer = function (element, options) {
        this.settings = $.extend({}, WaveformPlayer.defaults, options);
        this.element = $(element);
        this.audioElement = $(this.settings.audioElement)[0];
        this.audioContext = this.settings.audioContext;
        this.isDragging = false;
        this.tempProgress = 0;
        this.waveformData = null;
        this.interactionEnabled = false;
        this.renderQueue = [];
        this.isRendering = false;
        this.canvas = null;
        this.ctx = null;
        this.currentProgress = 0;
        this.devicePixelRatio = window.devicePixelRatio || 1;

        this.init();
    };

    WaveformPlayer.defaults = {
        audioElement: "#audio-element",
        audioContext: null,
        segments: null,
        segmentGap: 2,
        activeColor: "#2196F3",
        inactiveColor: "#ccc",
        backgroundColor: null,
        rtl: false,
        onRendered: null,
        onProgressChange: null,
        onSeek: null,
        samplingQuality: "medium",
        loadingText: "Loading waveform...",
        useQueue: false,
        segmentBorderRadius: 2,
        usePadding: false,
        minSegmentHeight: 15
    };

    WaveformPlayer.prototype = {

        init: function () {
            if (!this.audioContext) {
                console.error("AudioContext is required");
                return;
            }

            this.createContainer();

            // Calculate optimal segments if not set
            if (!this.settings.segments) {
                this.settings.segments = this.calculateOptimalSegments();
            }

            this.bindEvents();
            this.disableInteraction();
            this.addLoadingIndicator();

            $(this.audioElement).one('loadedmetadata', () => {
                if (this.audioElement.duration && !isNaN(this.audioElement.duration)) {
                    this.enableInteraction();
                    this.removeLoadingIndicator();
                }
            });

            // Add ResizeObserver for monitoring size changes
            this.setupResizeObserver();
        },

        createContainer: function () {
            this.element.addClass("waveform-container").css({
                position: "relative",
                height: "36px",
                background: this.settings.backgroundColor || 'transparent',
                borderRadius: "18px",
                overflow: "hidden",
                cursor: "pointer",
                touchAction: "none",
                flexGrow: 1,
                userSelect: "none",
                WebkitTapHighlightColor: "transparent"
            });

            // Create canvas element with 100% dimensions
            this.canvas = $("<canvas>").css({
                width: "100%",
                height: "100%",
                display: "block",
                position: "absolute",
                top: 0,
                left: 0
            })[0];

            this.ctx = this.canvas.getContext("2d", {
                alpha: true,
                willReadFrequently: true
            });

            this.element.append(this.canvas);
            this.resizeCanvas();
        },

        setupResizeObserver: function () {
            // Remove previous resize listener
            $(window).off('resize.waveform');

            // Create ResizeObserver
            this.resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const newWidth = entry.contentRect.width;
                    const newHeight = entry.contentRect.height;

                    // Check for actual size changes
                    if (this.lastWidth !== newWidth || this.lastHeight !== newHeight) {
                        this.lastWidth = newWidth;
                        this.lastHeight = newHeight;

                        // Debounce the resize handling
                        if (this.resizeTimeout) {
                            clearTimeout(this.resizeTimeout);
                        }

                        this.resizeTimeout = setTimeout(() => {
                            this.handleResize();
                        }, 100);
                    }
                }
            });

            // Start monitoring size changes
            this.resizeObserver.observe(this.element[0]);
        },

        handleResize: function () {
            // Store current progress
            const currentProgress = this.currentProgress;

            // Update canvas and recalculate segments
            this.resizeCanvas();

            // Re-render if waveform data exists
            if (this.waveformData) {
                this.updateProgress(currentProgress);
            }
        },

        resizeCanvas: function () {
            const rect = this.element[0].getBoundingClientRect();
            const width = Math.max(1, rect.width);
            const height = Math.max(1, rect.height);

            // Set canvas size accounting for device pixel ratio
            this.canvas.width = width * this.devicePixelRatio;
            this.canvas.height = height * this.devicePixelRatio;

            // Reset context scale
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);

            // Scale context for device pixel ratio
            this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
        },

        // Calculate optimal number of segments based on container width
        calculateOptimalSegments: function () {
            const canvas = this.canvas;
            const width = canvas.width / this.devicePixelRatio;
            const minSegmentWidth = 2;
            const maxSegmentWidth = 8;
            const padding = 12;

            // Calculate effective width (without padding)
            const effectiveWidth = width - (padding * 2);

            // Calculate optimal segments based on width
            let optimalSegments;

            if (effectiveWidth <= 300) {
                // For small widths
                optimalSegments = Math.floor(effectiveWidth / maxSegmentWidth);
            } else if (effectiveWidth <= 600) {
                // For medium widths
                optimalSegments = Math.floor(effectiveWidth / 6);
            } else if (effectiveWidth <= 1200) {
                // For large widths
                optimalSegments = Math.floor(effectiveWidth / 4);
            } else {
                // For very large widths
                optimalSegments = Math.floor(effectiveWidth / minSegmentWidth);
            }

            // Limit segments to a reasonable range
            const minSegments = 20;
            const maxSegments = 500;

            return Math.min(Math.max(optimalSegments, minSegments), maxSegments);
        },

        render: function () {
            if (!this.waveformData || !this.canvas) return;

            const ctx = this.ctx;
            const width = this.canvas.width / this.devicePixelRatio;
            const height = this.canvas.height / this.devicePixelRatio;

            // Clear canvas with transparency
            ctx.clearRect(0, 0, width, height);

            // Draw background if specified
            if (this.settings.backgroundColor !== null) {
                ctx.fillStyle = this.settings.backgroundColor;
                ctx.beginPath();
                ctx.roundRect(0, 0, width, height, height / 2);
                ctx.fill();
            }

            // Calculate segment dimensions
            const totalGapWidth = this.settings.segmentGap * (this.waveformData.length - 1);
            const segmentWidth = Math.max(1, (width - totalGapWidth) / this.waveformData.length);
            const segmentRadius = Math.max(0, segmentWidth / (this.settings.segmentBorderRadius || 3));

            // Calculate progress segments
            const totalSegments = this.waveformData.length;
            const progressSegmentIndex = this.currentProgress * totalSegments;
            const fullSegments = Math.floor(progressSegmentIndex);
            const partialSegment = progressSegmentIndex - fullSegments;

            // Calculate height scaling
            const maxValue = Math.max(...this.waveformData);
            const heightScale = height / 100;
            const minHeight = Math.max(1, height * (this.settings.minSegmentHeight || 15) / 100);

            this.waveformData.forEach((value, index) => {
                // Calculate segment height
                const rawHeight = Math.max(1, value * heightScale);
                const segmentHeight = Math.max(rawHeight, minHeight);

                // Calculate x position
                let x = index * (segmentWidth + this.settings.segmentGap);
                if (this.settings.rtl) {
                    x = width - ((index + 1) * segmentWidth + (index * this.settings.segmentGap));
                }

                // Calculate y position
                const y = Math.max(0, (height - segmentHeight) / 2);

                // Draw inactive segment
                if (segmentWidth > 0 && segmentHeight > 0) {
                    ctx.fillStyle = this.settings.inactiveColor;
                    ctx.beginPath();
                    ctx.roundRect(x, y, Math.max(0.1, segmentWidth), segmentHeight, segmentRadius);
                    ctx.fill();
                }

                let isActive = false;
                let activeWidth = segmentWidth;
                let activeX = x;

                if (this.settings.rtl) {
                    if (index < fullSegments) {
                        isActive = true;
                    } else if (index === fullSegments) {
                        isActive = true;
                        activeWidth = segmentWidth * partialSegment;
                        activeX = x + (segmentWidth - activeWidth);
                    }
                } else {
                    if (index < fullSegments) {
                        isActive = true;
                    } else if (index === fullSegments) {
                        isActive = true;
                        activeWidth = segmentWidth * partialSegment;
                    }
                }

                // Draw active segment
                if (isActive && activeWidth > 0 && segmentHeight > 0) {
                    ctx.fillStyle = this.settings.activeColor;
                    ctx.beginPath();
                    ctx.roundRect(activeX, y, Math.max(0.1, activeWidth), segmentHeight, segmentRadius);
                    ctx.fill();
                }
            });
        },

        updateProgress: function (progress) {
            this.currentProgress = progress;
            this.render();
        },

        addLoadingIndicator: function () {
            if (this.element.find('.waveform-loading-indicator').length === 0) {
                this.loadingIndicator = $("<div>")
                    .addClass('waveform-loading-indicator')
                    .css({
                        position: "absolute",
                        top: "0",
                        left: "0",
                        width: "100%",
                        height: "100%",
                        background: "rgba(0,0,0,0.05)",
                        borderRadius: "18px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: "10"
                    });

                const loadingText = $("<span>")
                    .html(this.settings.loadingText)
                    .css({
                        fontSize: "10px",
                        color: "#666",
                        opacity: "0.7"
                    });

                this.loadingIndicator.append(loadingText);
                this.element.append(this.loadingIndicator);
            }
        },

        removeLoadingIndicator: function () {
            if (this.loadingIndicator) {
                this.loadingIndicator.fadeOut(300, function () {
                    $(this).remove();
                });
            }
        },

        bindEvents: function () {
            $(this.audioElement).on("loadeddata", () => {
                if (this.audioElement.src && !this.waveformData) {
                    this.disableInteraction();
                    this.addLoadingIndicator();
                    fetch(this.audioElement.src)
                        .then(response => response.arrayBuffer())
                        .then(arrayBuffer => {
                            if (this.settings.useQueue) {
                                this.addToQueue(arrayBuffer);
                            } else {
                                this.loadAudioData(arrayBuffer);
                            }
                        });
                }
            });

            $(this.audioElement).on("emptied", () => {
                this.disableInteraction();
                this.addLoadingIndicator();
            });

            $(this.audioElement).on("timeupdate", () => {
                if (!this.isDragging && this.audioElement.duration && !isNaN(this.audioElement.duration)) {
                    const progress = this.audioElement.currentTime / this.audioElement.duration;
                    this.updateProgress(progress);

                    if (this.settings.onProgressChange) {
                        this.settings.onProgressChange(progress);
                    }
                }
            });

            this.element
                .on("mousedown touchstart", (e) => this.handleStart(e))
                .on("mousemove touchmove", (e) => this.handleMove(e))
                .on("mouseup mouseleave touchend", (e) => this.handleEnd(e));
        },

        handleStart: function (e) {
            e.preventDefault();
            if (!this.interactionEnabled) return;

            this.isDragging = true;
            const x = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;

            // Store initial touch position for better swipe handling
            this.lastTouchX = x;

            requestAnimationFrame(() => {
                this.updateVisualProgress(x);
            });
        },

        handleMove: function (e) {
            e.preventDefault();
            if (!this.isDragging || !this.interactionEnabled) return;

            const x = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;

            // Use requestAnimationFrame for smooth updates
            requestAnimationFrame(() => {
                this.updateVisualProgress(x);
            });
        },

        handleEnd: function (e) {
            e.preventDefault();
            if (this.isDragging && this.interactionEnabled) {
                this.isDragging = false;
                if (this.settings.onSeek) {
                    this.settings.onSeek(this.tempProgress);
                }
            }
        },

        updateVisualProgress: function (x) {
            const rect = this.element[0].getBoundingClientRect();
            const padding = 0;
            const effectiveWidth = rect.width;

            let relativeX;
            if (this.settings.rtl) {
                relativeX = rect.right - x;
            } else {
                relativeX = x - rect.left;
            }

            relativeX = Math.max(0, Math.min(effectiveWidth, relativeX));

            let progress = relativeX / effectiveWidth;

            progress = Math.max(0, Math.min(1, progress));

            this.tempProgress = progress;
            this.updateProgress(progress);

            if (this.settings.onProgressChange) {
                this.settings.onProgressChange(progress);
            }
        },

        addToQueue: function (audioData) {
            if (this.settings.useQueue) {
                this.renderQueue.push(audioData);
                if (!this.isRendering) {
                    this.processQueue();
                }
            } else {
                this.processAudioData(audioData);
            }
        },

        processQueue: function () {
            if (this.renderQueue.length === 0) {
                this.isRendering = false;
                return;
            }

            this.isRendering = true;
            const nextAudioData = this.renderQueue.shift();
            this.processAudioData(nextAudioData);
        },

        processAudioData: function (audioData) {
            this.loadAudioData(audioData).then(() => {
                if (this.settings.useQueue && this.renderQueue.length > 0) {
                    this.processQueue();
                } else {
                    this.isRendering = false;
                }
            }).catch(error => {
                console.error("Error processing audio data:", error);
                if (this.settings.useQueue && this.renderQueue.length > 0) {
                    this.processQueue();
                } else {
                    this.isRendering = false;
                }
            });
        },

        async loadAudioData (arrayBuffer) {
            try {
                this.addLoadingIndicator();

                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                const channelData = Array.from(audioBuffer.getChannelData(0));

                const worker = createInlineWorker(workerFunction);

                return new Promise((resolve, reject) => {
                    worker.onmessage = (e) => {
                        const {type, data, progress} = e.data;

                        if (type === 'progress') {
                            const loadingIndicator = this.element.find('.waveform-loading-indicator span');
                            loadingIndicator.html(`${this.settings.loadingText} ${progress}%`);
                        } else if (type === 'complete') {
                            this.waveformData = data;
                            this.removeLoadingIndicator();
                            this.render();

                            if (this.audioElement.duration && !isNaN(this.audioElement.duration)) {
                                this.enableInteraction();
                            }

                            if (this.settings.onRendered) {
                                this.settings.onRendered(this);
                            }

                            worker.terminate();
                            resolve();
                        }
                    };

                    worker.onerror = (error) => {
                        console.error('Worker error:', error);
                        worker.terminate();
                        reject(error);
                    };

                    worker.postMessage({
                        channelData,
                        segments: this.settings.segments,
                        samplingQuality: this.settings.samplingQuality
                    });
                });

            } catch (error) {
                console.error("Error processing audio data:", error);
                throw error;
            }
        },

        enableInteraction: function () {
            this.interactionEnabled = true;
            this.element.css('cursor', 'pointer');
        },

        disableInteraction: function () {
            this.interactionEnabled = false;
            this.element.css('cursor', 'not-allowed');
        },

        export: function () {
            if (!this.waveformData) {
                console.warn("No waveform data available to export");
                return null;
            }

            return {
                version: VERSION,
                data: this.waveformData,
                settings: {
                    samplingQuality: this.settings.samplingQuality,
                    rtl: this.settings.rtl
                }
            };
        },

        restore: function (exportedData) {
            if (!exportedData || !exportedData.data || !Array.isArray(exportedData.data)) {
                console.error("Invalid waveform data format");
                return false;
            }

            try {
                this.waveformData = exportedData.data;

                if (exportedData.settings) {
                    if (exportedData.settings.samplingQuality) {
                        this.settings.samplingQuality = exportedData.settings.samplingQuality;
                    }

                    if (exportedData.settings.rtl !== undefined) {
                        this.settings.rtl = exportedData.settings.rtl;
                    }
                }

                this.render();
                return true;
            } catch (error) {
                console.error("Error restoring waveform data:", error);
                return false;
            }
        },

        destroy: function () {
            // Cleanup
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }

            this.element.off();
            $(window).off('resize.waveform');
            $(this.canvas).remove();
            this.element.removeData("waveform");
        }

    };

    $.fn.waveform = function (options) {
        return this.each(function () {
            if (!$.data(this, "waveform")) {
                $.data(this, "waveform", new WaveformPlayer(this, options));
            }
        });
    };
})(jQuery);
