const BASE_URL = 'http://localhost:5000/api/auth';
const ADMIN_SECRET = 'your_admin_secret_key_here'; // From .env

const test = async () => {
  try {
    // 1. Register Artisan
    console.log('--- Testing Artisan Registration ---');
    const artisanRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Artisan',
        email: `artisan_${Date.now()}@test.com`,
        phone: '1234567890',
        password: 'password123',
        role: 'artisan',
        location: 'New York',
        domain: 'Plumbing'
      })
    });
    const artisanData = await artisanRes.json();
    console.log('Status:', artisanRes.status);
    console.log('Response:', artisanData);

    // 2. Register Manufacturer
    console.log('\n--- Testing Manufacturer Registration ---');
    const manufacturerRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Jane',
        lastName: 'Manufacturer',
        email: `manuf_${Date.now()}@test.com`,
        phone: '0987654321',
        password: 'password123',
        role: 'manufacturer',
        companyName: 'Acme Corp'
      })
    });
    const manufacturerData = await manufacturerRes.json();
    console.log('Status:', manufacturerRes.status);
    console.log('Response:', manufacturerData);

    // 3. Try to Register Admin Publicly (Should Fail)
    console.log('\n--- Testing Public Admin Registration (Should Fail) ---');
    const adminFailRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Hacker',
        lastName: 'Admin',
        email: `hacker_${Date.now()}@test.com`,
        phone: '111222333',
        password: 'password123',
        role: 'admin'
      })
    });
    const adminFailData = await adminFailRes.json();
    console.log('Status:', adminFailRes.status); // Should be 403
    console.log('Response:', adminFailData);

    // 4. Create Admin via Secret Endpoint
    console.log('\n--- Testing Secret Admin Creation ---');
    const adminRes = await fetch(`${BASE_URL}/admin/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Super',
        lastName: 'Admin',
        email: `admin_${Date.now()}@test.com`,
        phone: '555555555',
        password: 'password123'
      })
    });
    const adminData = await adminRes.json();
    console.log('Status:', adminRes.status);
    console.log('Response:', adminData);

    // 5. Login
    console.log('\n--- Testing Login ---');
    if (adminData.email) {
        const loginRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: adminData.email,
            password: 'password123'
        })
        });
        const loginData = await loginRes.json();
        console.log('Status:', loginRes.status);
        console.log('Token received:', !!loginData.token);
    }

  } catch (error) {
    console.error('Error:', error);
  }
};

test();
