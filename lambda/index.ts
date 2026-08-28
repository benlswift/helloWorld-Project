export const handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Hello from Ben's Lambda!"
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};