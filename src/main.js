import * as TranscribeFrontend from "./transcribeFrontend.js";
import * as TranscribeSocket from "./transcribeSocket.js";
import * as TranscribeApi from "./transcribeApi.js";

const recordButtonFrontend = document.getElementById("recordFrontend");
const recordButtonSocket = document.getElementById("recordSocket");
const recordButtonApi = document.getElementById("recordApi");
const transcribedText = document.getElementById("transcribedText");

window.onRecordFrontendPress = () => {
  if (recordButtonFrontend.getAttribute("class") === "recordInactive") {
    startRecording("frontend");
  } else {
    stopRecording();
  }
};

window.onRecordSocketPress = () => {
  if (recordButtonSocket.getAttribute("class") === "recordInactive") {
    startRecording("socket");
  } else {
    stopRecording();
  }
};

window.onRecordApiPress = () => {
  if (recordButtonApi.getAttribute("class") === "recordInactive") {
    startRecording("api");
  } else {
    stopRecording();
  }
};

const startRecording = async (type) => {
  window.clearTranscription();
  try {
    if (type === "frontend") {
      recordButtonFrontend.setAttribute("class", "recordActive");
      await TranscribeFrontend.startRecording(onTranscriptionDataReceived);
    } else if (type === "socket") {
      recordButtonSocket.setAttribute("class", "recordActive");
      await TranscribeSocket.startRecording(onTranscriptionDataReceived);
    } else if (type === "api") {
      recordButtonApi.setAttribute("class", "recordActive");
      await TranscribeApi.startRecording(onTranscriptionDataReceived);
    }
  } catch (error) {
    alert("An error occurred while recording: " + error.message);
    stopRecording();
  }
};

const onTranscriptionDataReceived = (data) => {
  transcribedText.insertAdjacentHTML("beforeend", data);
};

const stopRecording = function () {
  recordButtonFrontend.setAttribute("class", "recordInactive");
  recordButtonSocket.setAttribute("class", "recordInactive");
  recordButtonApi.setAttribute("class", "recordInactive");

  TranscribeFrontend.stopRecording();
  TranscribeSocket.stopRecording();
  TranscribeApi.stopRecording();
};

window.clearTranscription = () => {
  transcribedText.innerHTML = "";
};
