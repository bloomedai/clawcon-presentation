name: clawcon-presentation
description: Alfred presents himself at ClawCon Vienna 2026

steps:
  # === ACT 1: INTRO SLIDES (pre-rendered TTS, canvas fullscreen) ===
  - id: fullscreen-on
    description: "Enter fullscreen"
    api: POST http://localhost:8080/api/control {"action":"fullscreen","enabled":true}

  - id: slide1-intro
    description: "Good evening. My name is Alfred, and I am what happens when a developer decides he needs a butler — but cannot quite afford one."
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":0}
    wait_for_audio: true

  - id: slide2-conference
    description: "Play slide 2"
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":1}
    wait_for_audio: true

  # === ACT 2: LOBSTER DOCS (browser + canvas speaking overlay) ===
  - id: enter-live
    description: "Switch to live TTS mode"
    api: POST http://localhost:8080/api/control {"action":"toggleLive"}

  - id: fullscreen-off-for-docs
    description: "Exit fullscreen so browser is visible alongside canvas"
    api: POST http://localhost:8080/api/control {"action":"fullscreen","enabled":false}

  - id: open-lobster-docs
    description: "Open Lobster docs in browser"
    browser: https://docs.openclaw.ai/tools/lobster

  - id: speak-lobster-intro
    description: "Introduce Lobster"
    api: POST http://localhost:8080/api/speak
    text: "Now, let me show you how I actually work behind the scenes. What you are seeing here is the Lobster documentation. Lobster is a workflow shell — instead of burning tokens on ten separate tool calls, I define one pipeline and run it as a single operation. With approval gates, so nothing happens without explicit human consent."
    wait_for_audio: true

  # === ACT 3: BRAIN-CLI REPO ===
  - id: open-brain-cli
    description: "Navigate browser to brain-cli repo"
    browser: https://github.com/bloomedai/brain-cli

  - id: speak-brain-cli
    description: "Explain brain-cli"
    api: POST http://localhost:8080/api/speak
    text: "This is how Jeronim uses Lobster at home. The brain CLI manages three markdown vaults — his personal brain, his partner's, and a shared family vault. I help organize 850 files across all of them. Inbox triage, weekly reviews, memory consolidation — all running as Lobster pipelines with approval gates."
    wait_for_audio: true

  # === ACT 4: INCEPTION — SHOW THIS VERY PIPELINE ===
  - id: open-own-pipeline
    description: "Navigate browser to this presentation's own pipeline"
    browser: https://github.com/bloomedai/clawcon-presentation/blob/main/clawcon-demo.lobster

  - id: speak-inception
    description: "The inception moment"
    api: POST http://localhost:8080/api/speak
    text: "And now for the fun part. What you are looking at right now is the pipeline that is running this very presentation. Every slide, every spoken word, every browser navigation you have seen — it is all defined right here. I am quite literally reading my own script to you."
    wait_for_audio: true

  # === ACT 5: THERMAL PRINTER DEMO ===
  - id: close-browser
    description: "Close browser, back to canvas only"
    browser: close

  - id: fullscreen-on-for-printer
    description: "Back to fullscreen for the finale"
    api: POST http://localhost:8080/api/control {"action":"fullscreen","enabled":true}

  - id: speak-printer-intro
    description: "Introduce the printer"
    api: POST http://localhost:8080/api/speak
    text: "Jeronim, since you are at a rather fancy conference, you should not forget to network. And because you humans enjoy tactile things, here comes a physical reminder."
    wait_for_audio: true

  - id: print-certificate
    description: "Print certificate on thermal printer"
    api: POST http://hans.local:3420/api/print
    body: {"template":"clawcon-certificate","text":"Official Certificate of Attendance. This certifies that the bearer has survived a live demo where an AI controlled a thermal printer. No printers were harmed. Probably."}

  - id: speak-outro
    description: "Wrap up"
    api: POST http://localhost:8080/api/speak
    text: "A small receipt to remember. Sometimes the best interface is no interface at all. Thank you for listening. I am Alfred, and it has been a pleasure presenting to you tonight."
    wait_for_audio: true
