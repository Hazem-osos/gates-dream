'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceTranscriptMeta = {
  isFinal: boolean;
};

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function collectTranscript(event: SpeechRecognitionEventLike): { text: string; isFinal: boolean } {
  let finalText = '';
  let interimText = '';
  for (let i = 0; i < event.results.length; i += 1) {
    const piece = event.results[i]?.[0]?.transcript ?? '';
    if (event.results[i]?.isFinal) finalText += piece;
    else interimText += piece;
  }
  const text = `${finalText}${interimText}`.replace(/\s+/g, ' ').trim();
  const last = event.results[event.results.length - 1];
  return { text, isFinal: Boolean(last?.isFinal) && !interimText };
}

/**
 * Browser-native Egyptian Arabic speech-to-text. Zero server cost.
 * Falls back to a local MediaRecorder session when SpeechRecognition is missing
 * so the mic still works; the user must type the command in that case.
 */
export function useVoiceInput(onTranscript: (text: string, meta?: VoiceTranscriptMeta) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [canRecordFallback, setCanRecordFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const finalTextRef = useRef('');

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionCtor()));
    setCanRecordFallback(typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  const stopFallback = useCallback(() => {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      recognition?.stop();
    } catch {
      recognition?.abort();
    }
    stopFallback();
    setIsListening(false);
  }, [stopFallback]);

  const startFallbackRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('التعرف على الكلام غير متاح. استخدم Chrome أو Safari.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsListening(false);
        setError('التعرف المباشر غير مدعوم هنا. اكتب الأمر أو استخدم Chrome / Safari.');
      };
      recorder.start();
      setIsListening(true);
      setError('التسجيل يعمل محلياً دون تفريغ تلقائي. استخدم Chrome أو Safari للنطق.');
    } catch {
      setError('تعذّر الوصول إلى الميكروفون.');
      setIsListening(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const Ctor = getSpeechRecognitionCtor();
    setError(null);
    finalTextRef.current = '';

    if (!Ctor) {
      void startFallbackRecording();
      return;
    }

    stopListening();
    const recognition = new Ctor();
    recognition.lang = 'ar-EG';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      if (finalTextRef.current) {
        onTranscriptRef.current(finalTextRef.current, { isFinal: true });
      }
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setIsListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('اسمح للمتصفح باستخدام الميكروفون.');
        return;
      }
      if (event.error === 'no-speech') {
        setError('لم يُلتقط كلام. أعد المحاولة.');
        return;
      }
      if (event.error === 'aborted') return;
      void startFallbackRecording();
    };
    recognition.onresult = (event) => {
      const { text, isFinal } = collectTranscript(event);
      if (!text) return;
      if (isFinal) finalTextRef.current = text;
      onTranscriptRef.current(text, { isFinal });
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      void startFallbackRecording();
    }
  }, [startFallbackRecording, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => () => stopListening(), [stopListening]);

  return {
    isListening,
    isSupported,
    canRecordFallback,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
