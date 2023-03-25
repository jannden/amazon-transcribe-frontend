import MicrophoneStream from "microphone-stream";
import { Buffer } from "buffer";
import { io } from "socket.io-client";

// UPDATE THIS ACCORDING TO YOUR BACKEND:
const ws = "ws://localhost:8080";

let microphoneStream = undefined;
let socket = undefined;

const audioElement = document.createElement("audio");
let mediaSource;
document.body.appendChild(audioElement);
let sourceBuffer;
let receivedDataLength = 0;
let pendingChunks = [];
let sourceBuffersUpdating = 0;

const encodePCMChunk = (chunk) => {
  const input = MicrophoneStream.toRaw(chunk);
  var offset = 0;
  var buffer = new ArrayBuffer(input.length * 2);
  var view = new DataView(buffer);
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return Buffer.from(buffer);
};

const createMicrophoneStream = async () => {
  microphoneStream = new MicrophoneStream();
  microphoneStream.setStream(
    await window.navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    })
  );
};

export const startRecording = async (callback) => {
  mediaSource = new MediaSource();
  audioElement.src = URL.createObjectURL(mediaSource);

  if (microphoneStream) {
    stopRecording();
  }

  socket = io(ws);

  socket.on("connect", function () {
    sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
    sourceBuffer.addEventListener("updateend", () => {
      if (pendingChunks.length > 0 && !sourceBuffer.updating) {
        const buffer = pendingChunks.shift();
        sourceBuffer.appendBuffer(buffer);
      }
      sourceBuffersUpdating--;
      if (sourceBuffersUpdating === 0 && !mediaSource.updating) {
        mediaSource.endOfStream();
        audioElement.play();
      }
    });
    if (microphoneStream && socket.connected) {
      socket.emit("start-audio", true);
      console.log("start-audio");
      microphoneStream.on("data", function (chunk) {
        socket.emit("binary-data", encodePCMChunk(chunk));
      });
    }
  });

  socket.on("transcript", function (data) {
    console.log("transcript", data);
    callback(data);
  });

  socket.on("translation", function (data) {
    console.log("translation", data);
    callback(data);
  });

  socket.on("binary-data", (chunk) => {
    console.log(`Received ${receivedDataLength} bytes`);
    receivedDataLength += chunk.byteLength;
    sourceBuffersUpdating++;
    pendingChunks.push(chunk);
    if (!sourceBuffer.updating) {
      const buffer = pendingChunks.shift();
      sourceBuffer.appendBuffer(buffer);
    }
  });

  socket.on("end-transcript", () => {
    console.log("Transcript complete");
    socket.disconnect();
  });

  createMicrophoneStream();
};

export const stopRecording = function () {
  if (microphoneStream) {
    microphoneStream.stop();
    microphoneStream.destroy();
    microphoneStream = undefined;
    socket.emit("end-audio", true);
    console.log("end-audio");
  }
};
