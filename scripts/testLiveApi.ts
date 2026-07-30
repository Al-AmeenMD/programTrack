import "dotenv/config";
import assert from "node:assert/strict";

async function main() {
  console.log("--- Testing live HTTP server at http://localhost:3000 ---");

  // Login
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@developmenthub.ng",
      password: "admin123",
    }),
  });

  console.log("Login status:", loginRes.status);
  const cookie = loginRes.headers.get("set-cookie");
  assert(cookie, "Set-Cookie header required");

  // Get programs
  const progRes = await fetch("http://localhost:3000/api/programs", {
    headers: { Cookie: cookie },
  });
  const progJson = await progRes.json();
  console.log("Programs status:", progRes.status, "Count:", progJson.data?.length);

  const programId = progJson.data?.[0]?.id;
  assert(programId, "Must have at least one program");

  // Test POST /api/programs/:id/courses
  const createCourseRes = await fetch(`http://localhost:3000/api/programs/${programId}/courses`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: `Test Track ${Date.now()}` }),
  });

  const courseJson = await createCourseRes.json();
  console.log("Create course status:", createCourseRes.status, courseJson);

  assert.equal(createCourseRes.status, 201, "Should return 201 Created");
  console.log("SUCCESS: Live HTTP server endpoint POST /api/programs/:id/courses returned 201!");

  // Clean up created course
  if (courseJson.data?.id) {
    await fetch(`http://localhost:3000/api/courses/${courseJson.data.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    console.log("Cleaned up created test course");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
