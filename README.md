# Fluent AI Sidebar

![Fluent AI Sidebar in action](assets/icon.png)

A cross-platform AI Sidebar Agent with OCR capabilities, designed to boost your productivity. Capture any text on your screen, and let AI translate, explain, rephrase, or even reply for you.

## ✨ Features

-   **Instant OCR Capture**: Press `F8` to select any region on your screen. The engine extracts text in a flash, using native Windows OCR for blazing speed or Tesseract.js on other platforms.
-   **AI-Powered Actions**: Instantly perform actions on captured text:
    -   **Explain**: Understand complex code or text.
    -   **Translate**: Translate to English or French.
    -   **Reply**: Draft professional replies to messages.
    -   **Rephrase**: Improve clarity and professionalism.
    -   **Answer**: Get answers from the text.
-   **Seamless Fluent Design**: A beautiful sidebar that docks to your screen and feels like a native part of your OS.
-   **Clipboard Watcher**: Automatically process text you copy to your clipboard for an even faster workflow.
-   **Built-in History**: Your captures and AI responses are saved locally for easy access.
-   **Cross-Platform**: Built with Electron to run on Windows, macOS, and Linux.
-   **Configurable**: Settings are easily managed through the tray icon menu, including "Always on Top" and "Launch on Startup".

## 🛠️ Setup & Installation

Follow these steps to get the project running on your local machine.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/fluent-ai-sidebar.git
    cd fluent-ai-sidebar
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up your API Key:**
    -   The application uses the Google Gemini API. You will need to get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
    -   The first time you run the app, it will prompt you to enter this key.

## 🚀 Usage

1.  **Start the application:**
    ```bash
    npm start
    ```

2.  **Capture Text:**
    -   Press the `F8` key to activate the capture mode.
    -   Click and drag to select a region of your screen.

3.  **Interact with the Sidebar:**
    -   Once a capture is made, the sidebar will appear.
    -   Click "Extract Text" to perform OCR.
    -   Use the action buttons (Explain, Translate, etc.) to process the text with AI.

4.  **Tray Menu:**
    -   Right-click the tray icon for options like toggling "Always on Top", "Clipboard Watcher", and "Launch on Startup".

## 📦 Building the Application

To package the application for your current platform, run the following command:

```bash
npm run package
```

The distributable files will be located in the `/dist` directory.

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
