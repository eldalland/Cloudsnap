// Import Amplify with pinned versions to ensure single instance
import { Amplify, Hub } from 'https://esm.sh/@aws-amplify/core@6.16.2';
import { signInWithRedirect, signOut, getCurrentUser, fetchAuthSession } from 'https://esm.sh/@aws-amplify/auth@6.20.0';

// Initialize Amplify and OAuth listener
async function initializeAuth() {
  try {
    // Configure Amplify FIRST
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: 'us-east-1_BILlNM20K',
          userPoolClientId: '1gvbhal6ruarketr3oc08s1vph',
          loginWith: {
            oauth: {
              domain: 'us-east-1billnm20k.auth.us-east-1.amazoncognito.com',
              scopes: ['openid', 'email', 'profile'],
              redirectSignIn: [window.location.origin],
              redirectSignOut: [window.location.origin],
              responseType: 'code'
            }
          }
        }
      }
    });
    console.log("✅ Amplify configured in script.js");

    // NOW import the OAuth listener after config is set
    await import('https://esm.sh/@aws-amplify/auth@6.20.0/enable-oauth-listener');
    console.log("✅ OAuth listener loaded and ready");
    
    return true;
  } catch (error) {
    console.error("❌ Error initializing auth:", error);
    return false;
  }
}

// Wait for auth to initialize before proceeding
const authReady = await initializeAuth();
// Get token from Auth session
async function getCognitoToken() {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) throw new Error("No active credentials");
    return idToken;
  } catch (err) {
    console.error("❌ Auth Error:", err);
    alert("Session expired. Please log in.");
    return null;
  }
}

// Show UI for authenticated user
function showLoggedInUI(username) {
  document.getElementById("loggedOutView")?.classList.add("hidden");
  document.getElementById("loggedInView")?.classList.remove("hidden");
  const userEl = document.getElementById("loggedInUser");
  if (userEl) userEl.textContent = username;
  document.getElementById("showUploadBtn")?.classList.remove("hidden");
  document.getElementById("startUploadBtn")?.classList.remove("hidden");
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
  document.getElementById("showUploadBtn")?.classList.add("hidden");
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
  try {
    const user = await getCurrentUser();
    console.log("✅ Current user:", user.username);
    showLoggedInUI(user.username);
  } catch (err) {
    console.log("ℹ️ No user signed in yet");
    showLoggedOutUI();
  }
}

// Setup auth UI and listeners - only run after auth is initialized
if (authReady) {
  // Listen for Hub auth events (fires after OAuth code exchange completes)
  Hub.listen('auth', ({ payload }) => {
    console.log("🔔 Hub auth event:", payload.event, payload.data ?? '');
    if (payload.event === 'signedIn') {
      getCurrentUser().then(user => showLoggedInUI(user.username)).catch(() => {});
    } else if (payload.event === 'signedOut') {
      showLoggedOutUI();
    } else if (payload.event === 'signInWithRedirect_failure') {
      console.error("❌ OAuth failure detail:", JSON.stringify(payload.data, null, 2));
    }
  });

  // Get DOM elements
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn) {
    loginBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      console.log("🔑 Login clicked");
      try {
        await signInWithRedirect();
      } catch (err) {
        console.error("❌ Sign in error:", err);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      console.log("🚪 Logout clicked");
      try {
        await signOut();
        location.reload();
      } catch (err) {
        console.error("❌ Sign out error:", err);
        location.reload();
      }
    });
  }

  await checkUserSession(); 
  console.log("✅ CloudSnap ready");
} else {
  console.error("❌ Auth initialization failed - UI will not work");
}



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
    
    setTimeout(() => {
      retrieveProcessedImages();
    }, 3800);
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
    imageDiv.innerHTML = `
      <p><strong>Photo ${index + 1}</strong> (ID: ${image.photo_id.substring(0, 8)}...)</p>
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