// Web Speech API is not in TypeScript's DOM lib. Chrome/Edge expose it as
// SpeechRecognition / webkitSpeechRecognition; the voice components feature-detect it.
declare var SpeechRecognition: any;
declare var webkitSpeechRecognition: any;
