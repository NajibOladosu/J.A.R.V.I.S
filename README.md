# 🤖 JARVIS AI Assistant

A futuristic cross-platform AI assistant built with ElectronJS and GPT4All, featuring a sleek tech-blue themed interface and comprehensive voice integration.

## ✨ Features

### 🧠 AI Capabilities
- **Local LLM Integration**: Powered by GPT4All for privacy-focused AI interactions
- **Natural Language Processing**: Advanced intent parsing and command understanding
- **Structured Response Handling**: JSON-based communication for reliable action execution

### 📁 File Management
- Create, read, search, and manage documents
- Cross-platform file operations
- Safe file handling with user confirmation for destructive actions

### ⏰ Task Management
- Set reminders and alarms with custom messages
- Background alarm monitoring
- Persistent alarm storage and managementÍ

### 🖥️ System Integration
- System information monitoring (CPU, memory, disk usage)
- Safe command execution with security restrictions
- Cross-platform application launching

### 🎤 Voice Features
- Text-to-speech (TTS) for AI responses
- Voice input recognition (requires internet for Google Speech Recognition)
- Voice control toggle and settings

### 🎨 User Interface
- **Futuristic Design**: Tech-blue themed with glowing animations
- **Dark/Light Themes**: Multiple theme options including tech blue
- **System Tray Integration**: Minimize to tray for background operation
- **Responsive Layout**: Adaptive design for different screen sizes

## 🚀 Quick Start

### Prerequisites
- **Python 3.9+** with pip
- **Node.js 16+** with npm
- **macOS, Windows, or Linux**

### Installation & Running

#### 🔧 **Full Setup**
```bash
python3 start_jarvis.py
```
This will automatically:
- Check and install all dependencies  
- Start the Python backend server
- Launch the Electron frontend
- Handle graceful shutdown

**⚠️ First Run Note**: The AI model download (1.98GB) happens automatically on first startup and may take several minutes depending on your internet connection.

### Manual Setup (Optional)

If you prefer to set up manually:

1. **Install Python dependencies:**
   ```bash
   cd python-backend
   pip3 install -r requirements.txt
   ```

2. **Install Node.js dependencies:**
   ```bash
   cd electron-app
   npm install
   ```

3. **Start the backend:**
   ```bash
   cd python-backend
   python3 ipc_server.py
   ```

4. **Start the frontend (in a new terminal):**
   ```bash
   cd electron-app
   npm start
   ```

## 🧪 Testing

Run the comprehensive test suite:

```bash
python3 run_tests.py
```

This will run:
- Frontend file integrity checks
- Backend startup validation
- Python unit tests
- JavaScript unit tests (Jest)

## 🏗️ Architecture

### System Overview
```
┌─────────────┐    IPC    ┌──────────────────┐    API    ┌─────────────────┐
│  Electron   │ ←────────→ │  Python MCP      │ ←────────→ │  GPT4All (LLM)  │
│  Frontend   │           │ (Command Router) │           │ + Task Handlers │
└─────────────┘           └──────────────────┘           └─────────────────┘
       ↑                         ↑      ↑                         ↑
       │                         │      │                         │
       ▼                         ▼      ▼                         ▼
  User Input           OS APIs: File I/O, Alarms, Apps    Python Functions
 (Text/Voice)                subprocess, psutil, TTS     (Task Executors)
```

### Components

#### Backend (Python)
- **`llm_interface.py`**: GPT4All integration and prompt handling
- **`intent_parser.py`**: Natural language intent extraction
- **`task_router.py`**: Routes parsed intents to appropriate handlers
- **`ipc_server.py`**: FastAPI server with WebSocket support
- **`tasks/`**: Modular task handlers for different functionalities

#### Frontend (Electron)
- **`main.js`**: Main Electron process with IPC and system integration
- **`renderer.html`**: Futuristic UI with chat interface
- **`components/`**: Modular JavaScript components (chat, settings)
- **`styles/`**: CSS with tech-blue theme and animations

## 🎮 Usage Examples

### Basic Commands
- "Create a document called meeting-notes.txt"
- "Find all PDF files in my documents"
- "Set a reminder for 30 minutes to check the oven"
- "Show me the current system information"
- "Open calculator"

### Voice Interaction
1. Click the microphone button or press the voice toggle
2. Speak your command clearly
3. JARVIS will process and respond with both text and voice

### Quick Actions
Use the side panel for one-click actions:
- Create Document
- Find Files
- Set Reminder
- System Info

## ⚙️ Settings & Customization

Access settings via:
- **Menu**: JARVIS → Preferences
- **Keyboard**: `Cmd/Ctrl + ,`
- **UI**: Settings button in title bar

### Available Options
- **Theme**: Dark, Light, or Tech Blue
- **Voice**: Enable/disable TTS and voice recognition
- **System**: Auto-start with system, backend port configuration
- **Export/Import**: Backup and restore settings

## 🔒 Security & Privacy

- **Local Processing**: All AI processing happens locally via GPT4All
- **Safe Commands**: Whitelist of allowed system commands
- **User Confirmation**: Required for destructive file operations
- **No Data Collection**: No telemetry or data sent to external servers

## 🛠️ Development

### Project Structure
```
JARVIS/
├── python-backend/          # Backend server and AI logic
│   ├── tasks/              # Task handler modules
│   ├── logs/               # Application logs
│   └── requirements.txt    # Python dependencies
├── electron-app/           # Frontend Electron application
│   ├── src/               # Source code
│   ├── assets/            # Images and icons
│   └── package.json       # Node.js dependencies
├── tests/                 # Test suites
├── start_jarvis.py        # Main startup script
└── run_tests.py          # Test runner
```

### Adding New Features

1. **Backend Tasks**: Create new modules in `python-backend/tasks/`
2. **Frontend Components**: Add to `electron-app/src/components/`
3. **UI Themes**: Extend `electron-app/src/styles/theme.css`
4. **Tests**: Add to `tests/` directory

### API Endpoints

The backend exposes these main endpoints:
- `POST /chat`: Main chat interface
- `POST /action`: Direct action execution
- `GET /actions`: List available actions
- `WebSocket /ws`: Real-time communication

## 📋 System Requirements

### Minimum Requirements
- **OS**: macOS 10.14+, Windows 10+, or Ubuntu 18.04+
- **RAM**: 4GB (8GB recommended for GPT4All)
- **Storage**: 2GB free space for models and data
- **Network**: Optional (for voice recognition only)

### Recommended
- **RAM**: 8GB+ for optimal AI performance
- **SSD**: For faster model loading
- **Microphone**: For voice input features

## 🔧 Troubleshooting

### Common Issues

**Backend won't start:**
- Check Python version (3.9+ required)
- Install dependencies: `pip3 install -r python-backend/requirements.txt`
- Check if port 8000 is available

**Frontend won't launch:**
- Check Node.js version (16+ required)
- Install dependencies: `cd electron-app && npm install`
- Clear npm cache: `npm cache clean --force`

**Voice features not working:**
- Check microphone permissions
- Ensure internet connection (for speech recognition)
- Try toggling voice settings

**GPT4All model not loading:**
- Check available disk space (models are ~4GB)
- Verify internet connection for initial model download
- Check system RAM (8GB+ recommended)

### Logs and Debugging

- Backend logs: `python-backend/logs/jarvis.log`
- Enable debug mode: Start with `--dev` flag
- Console debugging: Press `F12` in Electron app

## 🤝 Contributing

We welcome contributions! Areas where help is needed:

1. **Additional Task Handlers**: Email, calendar, weather, etc.
2. **UI Improvements**: Animations, themes, accessibility
3. **Voice Enhancement**: Better speech recognition, more TTS voices
4. **Cross-platform**: Platform-specific optimizations
5. **Documentation**: Tutorials, API docs, user guides

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **GPT4All**: For providing local LLM capabilities
- **Electron**: For cross-platform desktop app framework
- **FastAPI**: For the robust Python backend
- **The Open Source Community**: For the amazing tools and libraries

---

**Made with ❤️ for AI enthusiasts who value privacy and local processing.**