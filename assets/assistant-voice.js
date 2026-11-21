(() => {
  const mic = document.querySelector('#voiceMic');
  const read = document.querySelector('#voiceRead');
  const status = document.querySelector('#voiceStatus');
  const chat = mic.closest('.chat');
  const input = document.querySelector('#chatInput');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  const canSpeak = Boolean(synth && window.SpeechSynthesisUtterance);
  const canListen = Boolean(window.isSecureContext && Recognition);
  const hint = canListen ? 'Pulsa Hablar y di tu pregunta.' : 'Puedes escribir tu pregunta. El dictado no está disponible en este navegador.';
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
    speech.lang = 'es-CO';
    utterance = speech;
    speech.onend = speech.onerror = event => {
      if (utterance !== speech) return;
      utterance = null;
      update(event.type === 'error' ? 'La lectura no está disponible. Puedes leer la respuesta en el chat.' : hint);
    };
    update('Leyendo la respuesta…');
    try { synth.speak(speech); }
    catch { utterance = null; update('La respuesta está disponible en el chat.'); }
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
