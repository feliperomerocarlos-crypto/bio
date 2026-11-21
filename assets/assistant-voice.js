(() => {
  const mic = document.querySelector('#voiceMic');
  const read = document.querySelector('#voiceRead');
  const status = document.querySelector('#voiceStatus');
  const chat = mic.closest('.chat');
  const input = document.querySelector('#chatInput');
  const mouth = createAvatarMouth(chat.querySelector('.chat-head .voice-avatar'));
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  const canSpeak = Boolean(synth && window.SpeechSynthesisUtterance);
  const canListen = Boolean(window.isSecureContext && Recognition);
  const hint = canListen ? 'Pulsa Hablar y di tu pregunta.' : 'Puedes escribir tu pregunta. El dictado no está disponible en este navegador.';
  const voiceSelect = document.querySelector('#assistantVoice');
  const voiceChoice = document.querySelector('#voiceChoice');
  let spanishVoices = [];
  let savedVoice = '';
  try { savedVoice = localStorage.getItem('bvAssistantVoice') || ''; } catch {}

  function refreshVoices() {
    spanishVoices = (synth?.getVoices?.() || []).filter(voice => /^es(?:[-_]|$)/i.test(voice.lang));
    // SpeechSynthesisVoice expone el nombre y el idioma, pero carece de un campo de género.
    const masculine = /\b(?:male|masculino|hombre|gonzalo|alonso|pablo|raul|diego|jorge|carlos|andres|alvaro|antonio|juan|miguel|carmelo|martin)\b/i;
    const named = spanishVoices.filter(v => masculine.test(v.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
    const preferred = named.find(v => /^es[-_]CO$/i.test(v.lang)) || named[0];
    voiceSelect.replaceChildren(new Option('Predeterminada del dispositivo', ''));
    for (const voice of spanishVoices) voiceSelect.add(new Option(voice.name, voice.voiceURI));
    voiceSelect.value = spanishVoices.some(v => v.voiceURI === savedVoice) ? savedVoice :
      savedVoice === 'default' ? '' : preferred?.voiceURI || '';
    voiceChoice.hidden = !canSpeak || !spanishVoices.length;
  }

  voiceSelect.addEventListener('change', () => {
    savedVoice = voiceSelect.value || 'default';
    try { localStorage.setItem('bvAssistantVoice', savedVoice); } catch {}
  });
  refreshVoices();
  synth?.addEventListener?.('voiceschanged', refreshVoices);

  let recognition;
  let utterance;
  let revision = 0;

  function update(message) {
    mic.hidden = !canListen;
    mic.disabled = chatBusy;
    mic.textContent = recognition ? 'Cancelar micrófono' : 'Hablar';
    const latest = history.at(-1);
    read.hidden = !canSpeak || latest?.role !== 'assistant' || chatBusy;
    read.textContent = utterance ? 'Detener lectura' : 'Escuchar respuesta';
    chat.dataset.voice = recognition ? 'listening' : utterance ? 'speaking' : 'idle';
    status.textContent = message;
  }

  function stop() {
    revision++;
    mouth.stop();
    const previous = recognition;
    recognition = null;
    if (previous) previous.abort();
    if (utterance) {
      utterance = null;
      synth.cancel();
    }
    update(hint);
  }

  function speak(text) {
    const speech = new SpeechSynthesisUtterance(text);
    const selectedVoice = spanishVoices.find(voice => voice.voiceURI === voiceSelect.value);
    if (selectedVoice) speech.voice = selectedVoice;
    speech.lang = selectedVoice?.lang || 'es-CO';
    utterance = speech;
    speech.onstart = speech.onresume = () => { if (utterance === speech) mouth.start(); };
    speech.onpause = () => { if (utterance === speech) mouth.stop(); };
    speech.onboundary = event => { if (utterance === speech && event.name === 'word') mouth.word(); };
    speech.onend = speech.onerror = event => {
      if (utterance !== speech) return;
      mouth.stop();
      utterance = null;
      update(event.type === 'error' ? 'La lectura no está disponible. Puedes leer la respuesta en el chat.' : hint);
    };
    update('Leyendo la respuesta…');
    try { synth.speak(speech); }
    catch { mouth.stop(); utterance = null; update('La respuesta está disponible en el chat.'); }
  }

  read.addEventListener('click', () => {
    const wasReading = Boolean(utterance);
    stop();
    if (!wasReading && history.at(-1)?.role === 'assistant') speak(history.at(-1).content);
  });

  mic.addEventListener('click', () => {
    const wasListening = Boolean(recognition);
    stop();
    if (wasListening || chatBusy) return;
    const session = new Recognition();
    recognition = session;
    session.lang = 'es-CO';
    session.interimResults = false;
    session.continuous = false;
    session.onerror = event => {
      if (recognition !== session) return;
      recognition = null;
      update(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'El micrófono está bloqueado. Puedes permitirlo en tu navegador o escribir.'
        : 'No se pudo escuchar la pregunta. Puedes volver a hablar o escribir.');
    };
    session.onend = () => {
      if (recognition === session) { recognition = null; update(hint); }
    };
    session.onresult = async event => {
      if (recognition !== session) return;
      const result = event.results[event.resultIndex];
      if (!result?.isFinal) return;
      const text = result[0].transcript.trim();
      stop();
      if (!text || chatBusy) return;
      if (input.value.trim() || text.length > input.maxLength) {
        update('Ya hay un borrador o la pregunta es muy larga. Envía el texto escrito o dicta una pregunta breve.');
        return;
      }
      const reply = sendMessage(text);
      const turn = revision;
      const answer = await reply;
      if (answer && turn === revision && canSpeak && !document.hidden) speak(answer.text);
    };
    update('Escuchando… Tu pregunta se enviará cuando termines de hablar.');
    try { session.start(); }
    catch { recognition = null; update('No se pudo abrir el micrófono. Puedes escribir.'); }
  });

  document.addEventListener('bv-chat-start', () => { stop(); mic.disabled = true; read.hidden = true; });
  document.addEventListener('bv-chat-ready', () => update(hint));
  document.querySelector('#clearChat').addEventListener('click', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  window.addEventListener('hashchange', stop);
  update(hint);
})();
