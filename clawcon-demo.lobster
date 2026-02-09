name: clawcon-presentation
description: Alfred presents himself at ClawCon Vienna 2026 (Canvas-controlled)

# This pipeline is controlled via OpenClaw canvas.navigate and the presentation API
# The canvas shows either:
#   - http://localhost:8080 (presentation)
#   - External URLs (docs, repos)

steps:
  # === INTRO SLIDES (pre-rendered TTS) ===
  - id: slide1-intro
    description: "Play intro: Good evening, my name is Alfred..."
    canvas: http://localhost:8080
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":0}
    wait_for_audio: true

  - id: slide2-conference  
    description: "Play conference gimmick"
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":1}
    wait_for_audio: true

  # === LIVE MODE: LOBSTER DEMO ===
  - id: enter-live
    description: "Enter live mode"
    api: POST http://localhost:8080/api/control {"action":"toggleLive"}

  - id: speak-lobster-intro
    description: "Introduce Lobster"
    api: POST http://localhost:8080/api/speak
    text: "Now, let me show you how I actually work behind the scenes. This entire presentation is being orchestrated by something called Lobster."
    wait_for_audio: true

  - id: show-lobster-docs
    description: "Navigate canvas to Lobster docs"
    canvas: https://docs.openclaw.ai/tools/lobster

  - id: speak-docs
    description: "Explain docs (audio continues from presentation server)"
    api: POST http://localhost:8080/api/speak  
    text: "Here you can see the Lobster documentation. Instead of many back-and-forth calls, I define a pipeline that runs as one operation."
    wait_for_audio: true

  - id: show-brain-cli
    description: "Navigate canvas to brain-cli repo"
    canvas: https://github.com/bloomedai/brain-cli

  - id: speak-brain
    description: "Explain brain-cli"
    api: POST http://localhost:8080/api/speak
    text: "And this is how Jeronim uses it at home. The brain CLI, a second brain system where I help organize notes and memories."
    wait_for_audio: true

  # === RETURN TO PRESENTATION ===
  - id: return-to-slide2
    description: "Return to presentation, show slide 2 finished state"
    canvas: http://localhost:8080
    api: POST http://localhost:8080/api/control {"action":"showSlide","index":1}

  # === THERMAL PRINTER DEMO ===
  - id: speak-printer
    description: "Introduce printer demo"
    api: POST http://localhost:8080/api/speak
    text: "Jeronim, since you are at a rather fancy conference, you should not forget to network. And because you humans enjoy tactile todos, here comes a physical reminder."
    wait_for_audio: true

  - id: print-todo
    description: "Print TODO (mocked)"
    exec: echo "MOCK PRINT: Network with people at ClawCon!"

  - id: speak-outro
    description: "Wrap up"
    api: POST http://localhost:8080/api/speak
    text: "A small receipt to remember. Sometimes the best interface is no interface at all."
