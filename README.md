# TranslateX - Universal Translator

A modern, real-time translation application that automatically translates English text to Spanish and French. Built with React, TypeScript, and Tailwind CSS, designed for English and Chinese speakers.

## ✨ Features

- **Real-time Translation**: Automatic translation as you type (with debouncing)
- **Multiple Translation Services**: Support for Google Translate API, OpenAI API, or mock service
- **Bilingual UI**: Switch between English and Chinese interface
- **Copy to Clipboard**: One-click copy functionality for all text areas
- **Modern Design**: Beautiful, responsive UI with smooth animations
- **Error Handling**: Graceful error handling with user-friendly messages
- **Loading States**: Visual feedback during translation processes

## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables** (optional for mock service)
   ```bash
   cp env.example .env
   # Edit .env and add your API keys
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   ```
   http://localhost:5173
   ```

## 🔧 Translation Services

### Mock Service (Default)
The app comes with a mock translation service for development. It simply prefixes text with `[ES]` and `[FR]` for Spanish and French respectively.

### Google Translate API (Recommended)
1. Get an API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Translate API
3. Add your key to `.env`:
   ```
   VITE_GOOGLE_TRANSLATE_API_KEY=your_api_key_here
   ```
4. Update `src/services/translationService.ts`:
   ```typescript
   // Change this line:
   return await mockTranslate(text);
   // To this:
   return await googleTranslate(text);
   ```

### OpenAI API (Alternative)
1. Get an API key from [OpenAI](https://platform.openai.com/)
2. Add your key to `.env`:
   ```
   VITE_OPENAI_API_KEY=your_api_key_here
   ```
3. Update `src/services/translationService.ts`:
   ```typescript
   // Change this line:
   return await mockTranslate(text);
   // To this:
   return await openAITranslate(text);
   ```

## 🛠️ Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Internationalization**: react-i18next
- **Build Tool**: Vite
- **HTTP Client**: Axios

## 📁 Project Structure

```
src/
├── i18n/
│   └── config.ts          # Internationalization setup
├── services/
│   └── translationService.ts  # Translation API integrations
├── App.tsx                # Main application component
├── main.tsx              # React entry point
├── index.css             # Global styles with Tailwind
└── vite-env.d.ts         # Vite type definitions
```

## 🌍 Internationalization

The app supports English and Chinese interfaces:

- **English**: Default language
- **Chinese**: Traditional Chinese translation for UI elements
- **Toggle**: Click the language switch button in the header

All UI text is managed through `src/i18n/config.ts` for easy modification.

## 🎨 Customization

### Adding New Languages
1. Update `src/i18n/config.ts` with new language resources
2. Add translation logic in `src/services/translationService.ts`
3. Update the UI in `src/App.tsx` to include new language columns

### Styling
The app uses Tailwind CSS. Modify classes in components or extend the theme in `tailwind.config.js`.

### Translation Services
Add new translation providers by implementing the `TranslationResult` interface in `src/services/translationService.ts`.

## 📦 Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment.

## 🔒 Security Notes

- Never commit API keys to version control
- Use environment variables for sensitive data
- Consider implementing rate limiting for production use
- Validate and sanitize user input on the backend

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/your-username/translatex/issues) page
2. Create a new issue with detailed information
3. Provide steps to reproduce any bugs

---

Built with ❤️ for the global community 