import MicrophoneStream from "microphone-stream";
import { EventStreamMarshaller } from "@aws-sdk/eventstream-marshaller";
import { fromUtf8, toUtf8 } from "@aws-sdk/util-utf8-node";
import axios from "axios";

// UPDATE THIS ACCORDING TO YOUR BACKEND:
const backendUrl = "http://localhost:8080/aws-signature";

let socket;
const SAMPLE_RATE = 44100;
let inputSampleRate = undefined;
let sampleRate = SAMPLE_RATE;
let microphoneStream = undefined;
const eventStreamMarshaller = new EventStreamMarshaller(toUtf8, fromUtf8);

export const pcmEncode = (input) => {
  var offset = 0;
  var buffer = new ArrayBuffer(input.length * 2);
  var view = new DataView(buffer);
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
};

const createMicrophoneStream = async () => {
  microphoneStream = new MicrophoneStream();
  microphoneStream.on("format", (data) => {
    inputSampleRate = data.sampleRate;
  });
  microphoneStream.setStream(
    await window.navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    })
  );
};

export const downsampleBuffer = (
  buffer,
  inputSampleRate = SAMPLE_RATE,
  outputSampleRate = 16000
) => {
  if (outputSampleRate === inputSampleRate) {
    return buffer;
  }

  var sampleRateRatio = inputSampleRate / outputSampleRate;
  var newLength = Math.round(buffer.length / sampleRateRatio);
  var result = new Float32Array(newLength);
  var offsetResult = 0;
  var offsetBuffer = 0;

  while (offsetResult < result.length) {
    var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);

    var accum = 0,
      count = 0;

    for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }

    result[offsetResult] = accum / count;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
};

const getAudioEventMessage = (buffer) => {
  return {
    headers: {
      ":message-type": {
        type: "string",
        value: "event",
      },
      ":event-type": {
        type: "string",
        value: "AudioEvent",
      },
    },
    body: buffer,
  };
};

const convertAudioToBinaryMessage = (audioChunk) => {
  let raw = MicrophoneStream.toRaw(audioChunk);

  if (raw == null) return;

  let downsampledBuffer = downsampleBuffer(raw, inputSampleRate, sampleRate);
  let pcmEncodedBuffer = pcmEncode(downsampledBuffer);

  let audioEventMessage = getAudioEventMessage(Buffer.from(pcmEncodedBuffer));

  let binary = eventStreamMarshaller.marshall(audioEventMessage);

  return binary;
};

export const startRecording = async (callback) => {
  if (microphoneStream) {
    stopRecording();
  }

  const { data: presignedUrl } = await axios.get(backendUrl);

  socket = new WebSocket(presignedUrl);
  socket.binaryType = "arraybuffer";
  transcript = "";

  socket.onopen = function () {
    if (socket.readyState === socket.OPEN) {
      microphoneStream.on("data", function (rawAudioChunk) {
        let binary = convertAudioToBinaryMessage(rawAudioChunk);
        socket.send(binary);
      });
    }
  };

  socket.onmessage = function (message) {
    let messageWrapper = eventStreamMarshaller.unmarshall(Buffer(message.data));
    let messageBody = JSON.parse(String.fromCharCode.apply(String, messageWrapper.body));
    if (messageWrapper.headers[":message-type"].value === "event") {
      let results = messageBody.Transcript?.Results;
      if (results.length && !results[0]?.IsPartial) {
        const newTranscript = results[0].Alternatives[0].Transcript;
        console.log(newTranscript);
        callback(newTranscript + " ");
      }
    }
  };

  socket.onerror = function (error) {
    console.log("WebSocket connection error. Try again.", error);
  };

  createMicrophoneStream();
};

export const stopRecording = () => {
  if (microphoneStream) {
    console.log("Recording stopped");
    microphoneStream.stop();
    microphoneStream.destroy();
    microphoneStream = undefined;
  }
};
