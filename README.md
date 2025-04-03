To run this:

1. Set up your environment variables:
   ```bash
   cp example.env .env.local
   ```
   Then edit `.env` and replace the dummy API keys with your actual keys from:
   - OpenAI: https://platform.openai.com/api-keys
   - AssemblyAI: https://www.assemblyai.com/dashboard/account
   - Hume: https://app.hume.ai/login

2. Start the development server:
   ```bash
   npm run dev
   ```

Note: Never commit your actual `.env` file to git - it's already in `.gitignore` to prevent this.



Run tests with `npx tsx [testFile]`