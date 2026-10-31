export async function POST(req) {
  const formData = await req.formData();

  const response = await fetch('http://127.0.0.1:5001/transcribe', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  return Response.json(data);
}