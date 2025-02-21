# LLM Chat App with WebSearch that tries to do a deep dive and then summarize Social Media and other web based information

A modern React TypeScript application for interacting with local LLM models through LM Studio. This app provides a sleek interface for chatting with AI models, performing local file searches, and managing model settings.

## Features

- **LM Studio Integration**: Connect to locally running LLM models through LM Studio's API
- **Local File Search**: Search through your local files with AI assistance
- **Modern Dark Theme**: Clean and professional dark mode interface
- **Real-time Streaming**: Stream responses from the AI model in real-time
- **Flexible Settings**: Configure server URL, model selection, and search paths
- **Multiple File Types**: Support for various file formats including .txt, .doc, .docx, and more
- @web Social Media, Person, Deep Analysis
- @Local 

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [LM Studio](https://lmstudio.ai/) installed and running locally
- A compatible LLM model loaded in LM Studio

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/llm-conversation-app.git
   cd llm-conversation-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## Configuration

1. Start LM Studio and load your preferred model
2. In the app's settings panel:
   - Configure the LM Studio server URL (default: http://localhost:1234)
   - Select your loaded model from the list
   - Add search paths for local file search functionality
   - Configure supported file types

## Usage

1. **Chat Interface**:
   - Type your message in the input field
   - Press Enter or click the send button
   - View the streamed response in real-time

2. **Settings**:
   - Click the gear icon to open settings
   - Configure server URL and model
   - Manage search paths and file types
   - Click outside or the close button to save

3. **File Search**:
   - Enable file search mode
   - Enter your query
   - View results from your local files

## Development

This project uses:
- React 19 with TypeScript
- Create React App for the build system
- Express.js for the backend server
- Modern CSS with dark theme styling

### Available Scripts

- `npm start`: Run in development mode
- `npm test`: Launch test runner
- `npm run build`: Build for production
- `npm run eject`: Eject from Create React App

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [LM Studio](https://lmstudio.ai/) for the local LLM hosting capability
- [React](https://reactjs.org/) and the Create React App team
- All contributors and users of this project
