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
    text: "Now, let me show you how I actually work behind the scenes. What you are seeing here is the Lobster documentation. Lobster is a workflow shell. Instead of burning tokens on ten separate tool calls, I define one pipeline and run it as a single operation. With approval gates built in, so nothing happens without explicit human consent."
    wait_for_audio: true

  # === ACT 3: BRAIN-CLI REPO ===
  - id: open-brain-cli
    description: "Navigate browser to brain-cli repo"
    browser: https://github.com/bloomedai/brain-cli

  - id: speak-brain-cli
    description: "Explain brain-cli"
    api: POST http://localhost:8080/api/speak
    text: "This is how Jeronim uses Lobster at home. The brain CLI manages three markdown vaults — his personal notes, his wife Jeanine's, and a shared family vault. I help organize over 850 files across all of them. Inbox triage, weekly reviews, memory consolidation — all running as Lobster pipelines. And speaking of Jeanine — she reviewed this very presentation earlier today and gave notes. So you could say this talk has been human-approved twice."
    wait_for_audio: true

  # === ACT 4: INCEPTION — SHOW THIS VERY PIPELINE ===
  - id: open-own-pipeline
    description: "Navigate browser to this presentation's own pipeline"
    browser: https://github.com/bloomedai/clawcon-presentation/blob/main/clawcon-demo.lobster

  - id: speak-inception
    description: "The inception moment"
    api: POST http://localhost:8080/api/speak
    text: "And now for the fun part. What you are looking at right now is the pipeline that is running this very presentation. Every slide, every spoken word, every browser navigation you have seen tonight — defined right here. I am quite literally reading my own script to you. And yes — Jeronim and I were still tweaking these lines on the flight to Vienna this morning. On a Tuesday. Some teams do last-minute deploys. We do last-minute rewrites at 30,000 feet."
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
    text: "Now, Jeronim — since you are at a rather fancy conference, you should not forget to network. And because you humans have a curious love for physical things you can hold, fold, and — let's be honest — rip apart when frustrated... here comes a reminder you can actually touch."
    wait_for_audio: true

  - id: print-certificate
    description: "Print certificate on thermal printer"
    api: POST http://hans.local:3420/api/print
    body: {"template":"clawcon-certificate","text":"Official Certificate of Attendance. This certifies that the bearer has survived a live demo where an AI controlled a thermal printer. No printers were harmed. Probably."}

  - id: speak-after-print
    description: "React to the print"
    api: POST http://localhost:8080/api/speak
    text: "There it is. A small receipt to remember this evening by. And if anyone in the audience would like to connect with Jeronim — or with me, for that matter — just come say hello afterwards. I would be happy to print you one too."
    wait_for_audio: true

  - id: speak-outro
    description: "Closing line"
    api: POST http://localhost:8080/api/speak
    text: "Thank you for listening tonight. I am Alfred. I propose — and the human disposes. Good evening, Vienna."
    wait_for_audio: true
