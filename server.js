const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`
  );
});

