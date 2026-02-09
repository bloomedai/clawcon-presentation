name: clawcon-presentation
description: Alfred presents himself at ClawCon Vienna 2026

steps:
  # === PRE-RENDERED INTRO ===
  - id: slide1-intro
    command: |
      curl -s http://localhost:8080/api/control -X POST \
        -H 'Content-Type: application/json' \
        -d '{"action": "playSlide", "index": 0}'
    description: "Play intro: Good evening, my name is Alfred..."

  - id: slide2-conference
    command: |
      curl -s http://localhost:8080/api/control -X POST \
        -H 'Content-Type: application/json' \
        -d '{"action": "playSlide", "index": 1}'
    description: "Play conference gimmick: being demonstrated is like a magician..."

  # === LIVE MODE: LOBSTER DEMO ===
  - id: enter-live-mode
    command: |
      curl -s http://localhost:8080/api/control -X POST \
        -H 'Content-Type: application/json' \
        -d '{"action": "toggleLive"}'
    description: "Enter live mode for interactive demo"

  - id: speak-lobster-intro
    command: |
      curl -s http://localhost:8080/api/speak -X POST \
        -H 'Content-Type: application/json' \
        -d '{"text": "Now, let me show you how I actually work behind the scenes. This entire presentation is being orchestrated by something called Lobster — a workflow engine that lets me chain together multiple steps as a single, deterministic operation."}'
    description: "Introduce Lobster concept"

  - id: show-lobster-docs
    command: |
      curl -s http://localhost:8080/api/control -X POST \
        -H 'Content-Type: application/json' \
        -d '{"action": "navigate", "url": "https://docs.openclaw.ai/tools/lobster"}'
    description: "Show Lobster documentation in canvas"

  - id: speak-about-docs
    command: |
      curl -s http://localhost:8080/api/speak -X POST \
        -H 'Content-Type: application/json' \
        -d '{"text": "Here you can see the Lobster documentation. The key insight is that instead of many back-and-forth calls, I can define a pipeline that runs as one operation with explicit approval checkpoints."}'
    description: "Explain the docs"

  - id: show-brain-cli
    command: |
      curl -s http://localhost:8080/api/control -X POST \
        -H 'Content-Type: application/json' \
        -d '{"action": "navigate", "url": "https://github.com/bloomedai/brain-cli"}'
    description: "Show brain-cli repository"

  - id: speak-about-brain
    command: |
      curl -s http://localhost:8080/api/speak -X POST \
        -H 'Content-Type: application/json' \
        -d '{"text": "And this is how Jeronim uses it at home — the brain CLI. Its a second brain system where I help organize notes, todos, and memories. The pipelines process markdown files through AI workflows."}'
    description: "Explain the brain-cli"

  # === RETURN TO PRESENTATION ===
  - id: return-to-presentation
    command: |
      curl -s http://localhost:8080/api/control -X POST \
        -H 'Content-Type: application/json' \
        -d '{"action": "navigate", "url": "http://localhost:8080"}'
    description: "Return to presentation"

  # === THERMAL PRINTER DEMO ===
  - id: speak-printer-intro
    command: |
      curl -s http://localhost:8080/api/speak -X POST \
        -H 'Content-Type: application/json' \
        -d '{"text": "Jeronim, I should remind you and create todos when I notice something important. Since you are at a rather fancy conference, you should not forget to network with people. And because you humans seem to enjoy tactile todos and tearing up paper, here comes a physical reminder."}'
    description: "Introduce the printer demo"

  - id: print-todo
    command: |
      echo '{"action": "print", "text": "TODO: Network with people at ClawCon!", "status": "mocked"}'
    description: "Print TODO on thermal printer (mocked)"
    # Real command would be: lp -d BisoficePrinter -o raw <<< "$(echo -e '\x1b@TODO: Network!\n\n\n')"

  - id: speak-outro
    command: |
      curl -s http://localhost:8080/api/speak -X POST \
        -H 'Content-Type: application/json' \
        -d '{"text": "And there you have it. A small receipt to remember. Because sometimes the best interface is no interface at all — just a piece of paper you can put in your pocket or throw away when done."}'
    description: "Wrap up the demo"
