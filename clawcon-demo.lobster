name: clawcon-presentation
description: Alfred presents himself at ClawCon Vienna 2026

steps:
  # === ACT 1: INTRO SLIDES (pre-rendered TTS, canvas fullscreen) ===
  - id: fullscreen-on
    description: "Enter fullscreen"
    api: POST http://localhost:8080/api/control {"action":"fullscreen","enabled":true}

  - id: slide1-intro
    description: "Good evening. My name is Alfred..."
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":0}
    wait: 8500

  - id: slide2-conference
    description: "I must confess, being demonstrated at a conference..."
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":1}
    wait: 13500

  # === ACT 2: LOBSTER DOCS (browser + canvas speaking overlay) ===
  - id: fullscreen-off-for-docs
    description: "Exit fullscreen so browser is visible alongside canvas"
    api: POST http://localhost:8080/api/control {"action":"fullscreen","enabled":false}

  - id: open-lobster-docs
    description: "Open Lobster docs in browser"
    browser: https://docs.openclaw.ai/tools/lobster
    focus: true

  - id: slide3-lobster-intro
    description: "Now, let me show you how I actually work behind the scenes..."
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":2}
    wait: 21500

  # === ACT 3: BRAIN-CLI REPO ===
  - id: open-brain-cli
    description: "Navigate browser to brain-cli repo"
    browser: https://github.com/bloomedai/brain-cli
    focus: true

  - id: slide4-brain-cli
    description: "This is how Jeronim uses Lobster at home..."
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":3}
    wait: 30500

  # === ACT 4: INCEPTION — SHOW THIS VERY PIPELINE ===
  - id: open-own-pipeline
    description: "Navigate browser to this presentation's own pipeline"
    browser: https://github.com/bloomedai/clawcon-presentation/blob/main/clawcon-demo.lobster
    focus: true

  - id: slide5-inception
    description: "And now for the fun part..."
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":4}
    wait: 28500

  # === ACT 5: THERMAL PRINTER DEMO ===
  - id: close-browser
    description: "Close browser, back to canvas only"
    browser: close

  - id: fullscreen-on-for-printer
    description: "Back to fullscreen for the finale"
    api: POST http://localhost:8080/api/control {"action":"fullscreen","enabled":true}

  - id: print-certificate
    description: "Fire print early so it arrives during the speech"
    api: POST http://localhost:3420/api/print
    body: {"template":"clawcon-certificate","text":"Official Certificate of Attendance. This certifies that the bearer has survived a live demo where an AI controlled a thermal printer. No printers were harmed. Probably."}

  - id: slide6-printer-intro
    description: "Now, Jeronim — since you are at a rather fancy conference..."
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":5}
    wait: 18000

  - id: slide7-after-print
    description: "There it is. A small receipt to remember this evening by..."
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":6}
    wait: 15500

  - id: slide8-outro
    description: "Thank you for listening tonight..."
    api: POST http://localhost:8080/api/control {"action":"playSlide","index":7}
    wait: 8500
