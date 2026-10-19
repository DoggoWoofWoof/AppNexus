# Ask and voice

## What is in the prototype

**Ask** is the centre tab. Today also has an Ask bar, and a question typed into Targets search offers to go to Ask. A rep can ask in three ways:

- **Typing.** Questions about their own book: "What has declined?", "Which accounts are leaking the most?", "Brief me on Mount Sinai West", "What's overdue?".
- **Push-to-talk.** Tap the mic, speak, pause. The words appear as they are heard, and the question is sent when the rep stops.
- **Hands-free.** The app reads each answer aloud, then listens again, until the rep says "stop" or turns hands-free off. This is the free-flowing, Gemini Live-style feel, built without a realtime backend.

Every answer has the same shape. That makes it quick to read, and it is the same card a live voice mode would fill:

1. **One sentence** that answers the question.
2. **What it covers**, for example "Patients who left the system · Last 12 months · Sample data".
3. **The ranked figures** behind it. Each row opens the profile, and people can be added straight to the plan.
4. **Do this:** one next step, such as opening the person to see, opening the leakage view, or reviewing the plan. The person can be added to the plan from the same spot.
5. **Ask next:** two or three follow-up questions.

Follow-ups keep the thread. After "Brief me on Dr. Maya Patel", the question "Where does she refer?" is about the same person. A new territory-wide question, such as "What has declined?", starts fresh.

In the prototype, answers are worked out on the device from sample figures. When the browser has no speech recognition, or the mic is blocked, the app says so. It then offers **Try a sample voice question**, which plays a clearly labelled simulated question.

## Recommendation

**Ship push-to-talk and hands-free first. Add a realtime "Live" mode as a second step**, once the data services answer fast enough.

Why not make an always-on live conversation the default from day one:

- **Speed.** A live conversation needs a reply within about a second. The current Ask service takes far longer than that (tens of seconds in our test), and a long silence in a voice conversation feels broken. The data side has to get faster first.
- **Where reps are.** Hospital corridors and waiting rooms are noisy and not private. An open mic that picks up talk about physicians and accounts is a question customers' compliance teams will ask about.
- **Numbers.** Ranked figures are easier to read than to hear, and voice models misspeak numbers more often than text. Let the cards carry the figures and the voice give the gist.
- **Cost.** A realtime voice session is billed for the time it is open, not per question.

Where Live mode clearly wins: **driving between accounts**, and **prepping in the car** before a visit, when the rep needs to keep their eyes off the screen and their hands free.

## How Live mode would work

```
 phone                              DocNexus backend                  voice model
 ─────                              ────────────────                  ───────────
 mic audio  ───────────────────────────────────────────────────────▶ Gemini Live API
                                                                      or OpenAI Realtime
 cards on screen ◀── tool result ◀── ask / brief / leakage / plan ◀── tool call
 spoken reply ◀────────────────────────────────────────────────────── audio out
```

1. The app opens a realtime session with a short-lived token issued by our backend. No model API key is ever stored on the phone.
2. The model is given **tools**, not data. Each tool is an existing DocNexus service: Ask, account brief, HCP brief, leakage, the rep's plan and follow-ups.
3. When the rep asks something, the model calls a tool. The tool result is drawn on screen as the same answer card as above. The model then speaks a one-line summary.
4. Actions that change data ("add her to Thursday", "log that visit") come back as a **proposed change the rep confirms with a tap**. The model never writes on its own.
5. Barge-in is supported: the rep can talk over the answer to redirect it.

### Options

| | Push-to-talk (now) | Gemini Live API | OpenAI Realtime |
| --- | --- | --- | --- |
| Feel | Turn by turn | Continuous, can be interrupted | Continuous, can be interrupted |
| Speech to text | On-device (iOS Speech, Android SpeechRecognizer) | In the model | In the model |
| Answers from | DocNexus Ask service | Tool calls to DocNexus services | Tool calls to DocNexus services |
| Connection | Normal HTTPS | WebSocket audio stream | WebRTC or WebSocket |
| Cost model | Per question | Per minute of open session | Per minute of open session |
| Works offline | Speech to text partly; answers no | No | No |

Choosing between Gemini Live and OpenAI Realtime is a **business decision for Teresha**. Two inputs matter:

- **Existing vendor agreements:** whether a data processing agreement or BAA is already in place.
- **A side-by-side test:** a short run on noisy-corridor audio with medical names.

The app side is the same either way: tools, cards and confirmations.

## In the React Native app

| Piece | How |
| --- | --- |
| Speech to text (push-to-talk) | Native speech recognition through an Expo module. The prototype's `voice.js` mirrors its start, stop and result events. |
| Read aloud | `expo-speech` |
| Live mode audio | WebRTC (OpenAI) or a WebSocket with raw mic audio (Gemini). Both need a development build, not Expo Go. |
| Answer cards | One `AnswerCard` component, used by typed, push-to-talk and Live answers alike |
| Hands-free on the road | Car-friendly prompts, short spoken answers and large stop targets. Later: CarPlay and Android Auto. |

## Open questions

- Should spoken questions and transcripts be stored? If yes, for how long, and are they visible to managers?
- Which customers need on-device-only speech recognition for compliance?
- What is the target response time for the Ask service before Live mode is worth turning on?
