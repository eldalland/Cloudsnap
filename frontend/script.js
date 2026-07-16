// ========== COGNITO OAUTH CONFIGURATION ==========
const COGNITO_CONFIG = {
  domain: 'https://cloudsnap.auth.us-east-1.amazoncognito.com',
  clientId: '1gvbhal6ruarketr3oc08s1vph',
  redirectUri: window.location.origin,
  scope: 'openid email profile',
  region: 'us-east-1',
  userPoolId: 'us-east-1_EpPHJV9AQ'
};

// ========== OAUTH HELPER FUNCTIONS ==========

// Generate random string for PKCE
function generateRandomString(length) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

// SHA256 hash for PKCE
async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}

// Base64 URL encode
function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate PKCE challenge
async function generatePKCE() {
  const verifier = generateRandomString(128);
  const hashed = await sha256(verifier);
  const challenge = base64UrlEncode(hashed);
  return { verifier, challenge };
}

// Initiate OAuth login
async function signIn() {
  try {
    const { verifier, challenge } = await generatePKCE();
    const state = generateRandomString(32);
    
    // Store PKCE verifier and state
    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('oauth_state', state);
    
    // Build OAuth authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: COGNITO_CONFIG.clientId,
      redirect_uri: COGNITO_CONFIG.redirectUri,
      scope: COGNITO_CONFIG.scope,
      state: state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
    
    const authUrl = `https://${COGNITO_CONFIG.domain}/oauth2/authorize?${params}`;
    console.log("🔑 Redirecting to Cognito login...");
    window.location.href = authUrl;
  } catch (err) {
    console.error("❌ Login error:", err);
  }
}

// Handle OAuth callback
async function handleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  
  if (error) {
    console.error("❌ OAuth error:", error, urlParams.get('error_description'));
    return false;
  }
  
  if (!code) {
    return false; // Not a callback
  }
  
  // Verify state
  const savedState = sessionStorage.getItem('oauth_state');
  if (state !== savedState) {
    console.error("❌ State mismatch - possible CSRF attack");
    return false;
  }
  
  console.log("✅ OAuth callback received, exchanging code for tokens...");
  
  // Exchange code for tokens
  const verifier = sessionStorage.getItem('pkce_verifier');
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO_CONFIG.clientId,
    code: code,
    redirect_uri: COGNITO_CONFIG.redirectUri,
    code_verifier: verifier
  });
  
  try {
    const response = await fetch(`https://${COGNITO_CONFIG.domain}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenParams
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Token exchange failed:", errorData);
      return false;
    }
    
    const tokens = await response.json();
    console.log("✅ Tokens received");
    
    // Store tokens
    localStorage.setItem('id_token', tokens.id_token);
    localStorage.setItem('access_token', tokens.access_token);
    if (tokens.refresh_token) {
      localStorage.setItem('refresh_token', tokens.refresh_token);
    }
    
    // Clean up OAuth state
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.removeItem('oauth_state');
    
    // Clean URL
    window.history.replaceState({}, 'CloudSnap', window.location.pathname);
    document.title = 'CloudSnap';
    
    return true;
  } catch (err) {
    console.error("❌ Token exchange error:", err);
    return false;
  }
}

// Get current user from ID token
function getCurrentUser() {
  const idToken = localStorage.getItem('id_token');
  if (!idToken) return null;
  
  try {
    // Decode JWT (simple base64 decode, no verification needed for client-side display)
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    
    // Check if token is expired
    if (payload.exp * 1000 < Date.now()) {
      console.log("⚠️ Token expired");
      clearTokens();
      return null;
    }
    
    return {
      username: payload['cognito:username'] || payload.email || 'User',
      email: payload.email,
      sub: payload.sub
    };
  } catch (err) {
    console.error("❌ Error decoding token:", err);
    return null;
  }
}

// Get ID token for API calls
function getIdToken() {
  return localStorage.getItem('id_token');
}

// Sign out
function signOut() {
  clearTokens();
  
  // Redirect to Cognito logout
  const logoutParams = new URLSearchParams({
    client_id: COGNITO_CONFIG.clientId,
    logout_uri: COGNITO_CONFIG.redirectUri
  });
  
  const logoutUrl = `https://${COGNITO_CONFIG.domain}/logout?${logoutParams}`;
  console.log("🚪 Logging out...");
  window.location.href = logoutUrl;
}

// Clear stored tokens
function clearTokens() {
  localStorage.removeItem('id_token');
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

console.log("✅ Cognito OAuth initialized");

// ========== UI FUNCTIONS ==========

// Get token from Auth session (for API calls)
async function getCognitoToken() {
  const idToken = getIdToken();
  if (!idToken) {
    alert("Session expired. Please log in.");
    return null;
  }
  
  /* Debug: Log token details
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    console.log("📝 Token payload:", {
      aud: payload.aud,
      client_id: payload.client_id,
      'cognito:username': payload['cognito:username'],
      exp: new Date(payload.exp * 1000).toISOString(),
      iss: payload.iss
    });
  } catch (e) {
    console.error("❌ Failed to decode token:", e);
  }
  */
  return idToken;
}

// Show UI for authenticated user
function showLoggedInUI(username) {
  document.getElementById("loggedOutView")?.classList.add("hidden");
  document.getElementById("loggedInView")?.classList.remove("hidden");
  const userEl = document.getElementById("loggedInUser");
  if (userEl) userEl.textContent = username;
  document.getElementById("loginBtnNav")?.classList.add("hidden");  
  document.getElementById("showUploadBtn")?.classList.remove("hidden");
  document.getElementById("startUploadBtn")?.classList.remove("hidden");
  document.getElementById("logoutBtn")?.classList.remove("hidden");
  const greeting = document.getElementById("navGreeting");
  if (greeting) {
    greeting.textContent = `Hello, ${username}`;
    greeting.classList.remove("hidden");
  }
  console.log("✅ Logged in UI shown for:", username);
}

// Show UI for unauthenticated user
function showLoggedOutUI() {
  document.getElementById("loggedOutView")?.classList.remove("hidden");
  document.getElementById("loggedInView")?.classList.add("hidden");
  document.getElementById("upload")?.classList.add("hidden");
  document.getElementById("loginBtnNav")?.classList.remove("hidden");  
  document.getElementById("showUploadBtn")?.classList.add("hidden");
  document.getElementById("logoutBtn")?.classList.add("hidden");
  document.getElementById("startUploadBtn")?.classList.add("hidden");
  const greeting = document.getElementById("navGreeting");
  if (greeting) {
    greeting.textContent = "";
    greeting.classList.add("hidden");
  }
  console.log("ℹ️ Logged out UI shown");
}

// Check current user session
async function checkUserSession() {
  // First, check if this is an OAuth callback
  const callbackHandled = await handleCallback();
  
  if (callbackHandled) {
    console.log("✅ OAuth callback processed");
  }
  
  // Now check if user is logged in
  const user = getCurrentUser();
  if (user) {
    console.log("✅ Current user:", user.username);
    showLoggedInUI(user.username);
  } else {
    console.log("ℹ️ No user signed in");
    showLoggedOutUI();
  }
}

// Get DOM elements
const loginBtn = document.getElementById("loginBtn");
const loginBtnNav = document.getElementById("loginBtnNav");
const logoutBtn = document.getElementById("logoutBtn");

if (loginBtn) {
  loginBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    console.log("🔑 Login button clicked");
    await signIn();
  });
}

if (loginBtnNav) {
  loginBtnNav.addEventListener("click", async (e) => {
    e.preventDefault();
    console.log("🔑 Login button clicked");
    await signIn();
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("🚪 Logout button clicked");
    signOut();
  });
}

// Initialize on page load
await checkUserSession();
console.log("✅ CloudSnap ready");



// --- CORE APPLICATION UPLOAD & VIEW WORKFLOW ---

const API_GATEWAY_URL = "https://cco10loarj.execute-api.us-east-1.amazonaws.com";

// Get DOM elements after page loads
const input = document.getElementById("imageInput");
const fileName = document.getElementById("fileName");
const uploadBtn = document.getElementById("uploadBtn");
const steps = document.querySelectorAll(".step");
const originalPreview = document.getElementById("originalPreview");
const resizedPreview = document.getElementById("resizedPreview");
const uploadSection = document.getElementById("upload");
const showUploadBtn = document.getElementById("showUploadBtn");
const startUploadBtn = document.getElementById("startUploadBtn");
const closeUploadBtn = document.getElementById("closeUploadBtn");

function showUploadSection() {
  if (uploadSection) {
    uploadSection.classList.remove("hidden");
    uploadSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function closeUploadSection() {
  if (uploadSection) {
    uploadSection.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

if (showUploadBtn) showUploadBtn.addEventListener("click", showUploadSection);
if (startUploadBtn) startUploadBtn.addEventListener("click", showUploadSection);
if (closeUploadBtn) closeUploadBtn.addEventListener("click", closeUploadSection);

if (input) {
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;

    if (fileName) fileName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (originalPreview) originalPreview.src = event.target.result;
      if (resizedPreview) resizedPreview.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

if (uploadBtn) {
  uploadBtn.addEventListener("click", async () => {
    const file = input?.files?.[0];

    if (!file) {
      alert('Please select an image to upload.');
      return;
    }

    await uploadImage(file);

    steps.forEach(step => step.classList.remove("active"));
    steps.forEach((step, index) => {
      setTimeout(() => {
        step.classList.add("active");
      }, index * 700);
    });
    
    // Wait longer for Step Functions to process images (10 seconds)
    setTimeout(() => {
      retrieveProcessedImages();
    }, 10000);
  });
}

async function uploadImage(file) {
  if (!file) return alert('Please select a file first.');

  try {
    const token = await getCognitoToken();
    if (!token) return;

    const apiResponse = await fetch(`${API_GATEWAY_URL}/get-presigned-url`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`API Gateway error: ${apiResponse.statusText}`);
    }
    
    const data = await apiResponse.json();
    const s3PresignedUrl = data.uploadUrl;

    const s3Upload = await fetch(s3PresignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type' : file.type,
        'x-amz-server-side-encryption': 'aws:kms',
        'x-amz-server-side-encryption-aws-kms-key-id': 'arn:aws:kms:us-east-1:337763382699:key/2a0566eb-80cb-4a5b-be8c-bdd6abfe5b03'
      },
      body: file 
    });

    if (s3Upload.ok) {
      alert('Image successfully uploaded to S3!');
    } else {
      const errorText = await s3Upload.text();
      console.error("S3 Upload Error:", errorText);
      alert(`S3 Upload failed with status: ${s3Upload.status}. Check console for details!`);
    }

  } catch (error) {
    console.error("Upload error:", error);
    alert(`An error occurred: ${error.message}`);
  }
}

async function retrieveProcessedImages() {
  try {
    console.log("Retrieving processed images...");
    
    const token = await getCognitoToken();
    if (!token) return;

    const response = await fetch(`${API_GATEWAY_URL}/get-processed-images`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to retrieve images: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("Retrieved images:", data);
    
    if (data.images && data.images.length > 0) {
      displayDownloadButtons(data.images);
    } else {
      alert('No processed images found yet. Please wait a moment and try again.');
    }
    
  } catch (error) {
    console.error("Error retrieving images:", error);
    alert('Error retrieving images. Check console for details.');
  }
}

function displayDownloadButtons(images) {
  const downloadsContainer = document.getElementById('downloadsContainer');
  if (!downloadsContainer) return;
  
  downloadsContainer.innerHTML = '<h3>Download Your Images</h3>';
  
  images.forEach((image, index) => {
    const imageDiv = document.createElement('div');
    imageDiv.className = 'image-download-card';
    let displayName = `(ID: ${image.photo_id.substring(0, 8)}...)`
    if (image.variants && image.variants.website) {
      const urlParts = image.variants.website.split('/website/');
      if (urlParts.length > 1) {
        displayName = decodeURIComponent(urlParts[1]); // Decodes %20 or special characters back to readable text
      }
    }

    imageDiv.innerHTML = `
      <p><strong>Photo ${index + 1}</strong> ${displayName}</p>
      <div class="variant-buttons">
        ${Object.entries(image.variants)
          .map(([platform, url]) => `
            <a href="${url}" download class="download-btn">
              Download ${platform.charAt(0).toUpperCase() + platform.slice(1)}
            </a>
          `)
          .join('')}
      </div>
    `;
    downloadsContainer.appendChild(imageDiv);
  });
  
  downloadsContainer.classList.remove('hidden');
  downloadsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}